using System.Data.Common;
using FluentValidation;
using HoSoSo.Application.Common;
using HoSoSo.Application.Documents;
using HoSoSo.Application.Intake;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Operations;

public sealed record ArchiveItemDto(Guid DossierId, string Code, string Title, int PageCount, string? Location, string CheckResult, string Note);
public sealed record ArchiveSubmissionDto(Guid Id, string Code, string Status, string CreatedByName, DateTimeOffset CreatedAt, string? SubmittedByName, DateTimeOffset? SubmittedAt,
    string? ReceivedByName, DateTimeOffset? ReceivedAt, bool HasMinutes, string Note, string ReturnNote, int DossierCount, int PageCount, IReadOnlyList<ArchiveItemDto>? Items);
public sealed record CreateSubmissionRequest(IReadOnlyList<Guid> DossierIds, string? Note);
public sealed record ItemIssueRequest(Guid DossierId, string Note);
public sealed record ReturnSubmissionRequest(string Note, IReadOnlyList<ItemIssueRequest>? Issues);
public sealed record ArchiveIssue(Guid DossierId, string Code, string Problem);
public sealed record MinutesFile(Stream Content, string FileName, long ByteSize);

/// <summary>
/// BE-84, BE-85. Nộp lưu theo đợt: văn thư gom các hồ sơ đã đạt (ready_archive), nộp, người nhận tiếp nhận cả đợt hoặc trả lại kèm lỗi.
/// Tiếp nhận là một giao dịch: mỗi hồ sơ chuyển bước "archive" trong một savepoint; chỉ cần một hồ sơ lỗi là hoàn tác cả đợt
/// (không hồ sơ nào đổi trạng thái), lỗi từng hồ sơ được ghi lại để sửa rồi thử lại. Tiếp nhận xong thì sinh biên bản PDF lưu như một giấy tờ.
/// </summary>
public sealed class ArchiveHandler(IHoSoDb db, IScopeFilter scope, ICurrentUser user, IClock clock, IDocumentRenderer renderer, IFileStorage storage, IPdfTools pdf)
{
    public const string Draft = "draft", Submitted = "submitted", Received = "received", Returned = "returned";
    public const int MaxDossiers = 200;
    private static readonly string[] OpenStatuses = [Draft, Submitted];

    private sealed record PageRow(Guid dossier_id, int pages);

    public async Task<IReadOnlyList<ArchiveSubmissionDto>> ListAsync(string? status, CancellationToken ct)
    {
        var organization = RequireOrganization();
        var query = db.Read<ArchiveSubmission>().Where(s => s.OrganizationCode == organization);
        if (status is { Length: > 0 }) query = query.Where(s => s.Status == status);
        var rows = await query.OrderByDescending(s => s.CreatedAt).Take(200).ToListAsync(ct);
        return await ToDtosAsync(rows, includeItems: false, ct);
    }

    public async Task<ArchiveSubmissionDto> GetAsync(Guid id, CancellationToken ct)
    {
        var organization = RequireOrganization();
        var row = await db.Read<ArchiveSubmission>().SingleOrDefaultAsync(s => s.Id == id && s.OrganizationCode == organization, ct) ?? throw AppException.NotFound("đợt nộp lưu");
        return (await ToDtosAsync([row], includeItems: true, ct)).Single();
    }

    public async Task<ArchiveSubmissionDto> CreateAsync(CreateSubmissionRequest r, CancellationToken ct)
    {
        var me = user.RequireUserId();
        var organization = RequireOrganization();
        var ids = r.DossierIds.Distinct().ToArray();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // Khóa các hồ sơ theo thứ tự cố định để hai văn thư cùng gom một hồ sơ không thể vượt qua phép kiểm "đã nằm trong đợt khác".
        var locked = await db.Database.SqlQuery<Guid>($"SELECT id AS \"Value\" FROM hoso.dossiers WHERE id = ANY({ids}) ORDER BY id FOR UPDATE").ToListAsync(ct);
        var visible = await scope.Dossiers(db.Read<Dossier>()).Where(d => ids.Contains(d.Id)).Select(d => new { d.Id, d.Code, d.Status, d.OrganizationCode }).ToListAsync(ct);
        var problems = new List<ArchiveIssue>();
        foreach (var id in ids)
        {
            var d = visible.FirstOrDefault(x => x.Id == id);
            if (d is null || d.OrganizationCode != organization || !locked.Contains(id)) problems.Add(new ArchiveIssue(id, "", "Không tìm thấy hồ sơ hoặc hồ sơ không thuộc phạm vi của bạn."));
            else if (d.Status != "ready_archive") problems.Add(new ArchiveIssue(id, d.Code, "Hồ sơ chưa ở bước chờ nộp lưu."));
        }
        var busy = await (from i in db.Read<ArchiveSubmissionItem>() join s in db.Read<ArchiveSubmission>() on i.SubmissionId equals s.Id
                          where ids.Contains(i.DossierId) && OpenStatuses.Contains(s.Status) select new { i.DossierId, s.Code }).ToListAsync(ct);
        foreach (var b in busy) problems.Add(new ArchiveIssue(b.DossierId, visible.FirstOrDefault(x => x.Id == b.DossierId)?.Code ?? "", $"Hồ sơ đã nằm trong đợt {b.Code} chưa hoàn tất."));
        if (problems.Count > 0)
            throw new AppException(422, "archive_invalid", $"Không tạo được đợt: {problems.Count} hồ sơ không hợp lệ.", problems);

        var code = (await db.Database.SqlQuery<string>($"SELECT hoso.next_archive_code() AS \"Value\"").ToListAsync(ct)).Single();
        var pages = (await PagesAsync(ids, ct));
        var submission = new ArchiveSubmission { Code = code, OrganizationCode = organization, CreatedBy = me, Note = r.Note?.Trim() ?? "" };
        db.Set<ArchiveSubmission>().Add(submission);
        await db.SaveChangesAsync(ct);
        foreach (var id in ids)
            db.Set<ArchiveSubmissionItem>().Add(new ArchiveSubmissionItem { SubmissionId = submission.Id, DossierId = id, PageCount = pages.GetValueOrDefault(id) });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return await GetAsync(submission.Id, ct);
    }

    public async Task<ArchiveSubmissionDto> SubmitAsync(Guid id, CancellationToken ct)
    {
        var me = user.RequireUserId();
        var s = await LoadAsync(id, ct);
        if (s.Status != Draft) throw AppException.Conflict("Chỉ nộp được đợt đang soạn.");
        var itemIds = await db.Read<ArchiveSubmissionItem>().Where(i => i.SubmissionId == id).Select(i => i.DossierId).ToListAsync(ct);
        if (itemIds.Count == 0) throw AppException.Conflict("Đợt chưa có hồ sơ nào.");
        var stale = await db.Read<Dossier>().Where(d => itemIds.Contains(d.Id) && d.Status != "ready_archive").Select(d => d.Code).ToListAsync(ct);
        if (stale.Count > 0) throw AppException.Conflict($"Có hồ sơ không còn chờ nộp lưu: {string.Join(", ", stale)}. Bỏ khỏi đợt rồi nộp lại.");
        s.Status = Submitted;
        s.SubmittedBy = me;
        s.SubmittedAt = clock.UtcNow;
        Notify("archive.submitted", s);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task DeleteDraftAsync(Guid id, CancellationToken ct)
    {
        var s = await LoadAsync(id, ct);
        if (s.Status != Draft) throw AppException.Conflict("Chỉ xóa được đợt đang soạn.");
        db.Set<ArchiveSubmission>().Remove(s);   // các dòng hồ sơ xóa theo (ON DELETE CASCADE); hồ sơ được giải phóng để gom vào đợt khác
        await db.SaveChangesAsync(ct);
    }

    public async Task<ArchiveSubmissionDto> ReceiveAsync(Guid id, CancellationToken ct)
    {
        var me = user.RequireUserId();
        var assignment = user.RequireAssignment();
        var s = await LoadAsync(id, ct);
        if (s.Status != Submitted) throw AppException.Conflict("Chỉ tiếp nhận được đợt đã nộp.");
        var items = await db.Read<ArchiveSubmissionItem>().Where(i => i.SubmissionId == id).OrderBy(i => i.DossierId).ToListAsync(ct);
        var codes = await db.Read<Dossier>().Where(d => items.Select(i => i.DossierId).Contains(d.Id)).ToDictionaryAsync(d => d.Id, d => d.Code, ct);
        var note = $"Nộp lưu theo đợt {s.Code}";
        var issues = new List<ArchiveIssue>();

        await using (var transaction = await db.Database.BeginTransactionAsync(ct))
        {
            var current = (await db.Database.SqlQuery<string>($"SELECT status AS \"Value\" FROM hoso.archive_submissions WHERE id = {id} FOR UPDATE").ToListAsync(ct)).Single();
            if (current != Submitted) throw AppException.Conflict("Đợt này vừa được xử lý bởi người khác.");
            var n = 0;
            foreach (var item in items)
            {
                var savepoint = $"archive_item_{n++}";
                await transaction.CreateSavepointAsync(savepoint, ct);
                try
                {
                    await db.Database.SqlQuery<string>($"SELECT hoso.transition_dossier({item.DossierId}, {me}, {assignment}, 'archive', {note}, NULL) AS \"Value\"").ToListAsync(ct);
                    await transaction.ReleaseSavepointAsync(savepoint, ct);
                }
                catch (Exception e) when (SqlState(e) is { } state && Reason(state) is { } reason)
                {
                    await transaction.RollbackToSavepointAsync(savepoint, ct);
                    issues.Add(new ArchiveIssue(item.DossierId, codes.GetValueOrDefault(item.DossierId, ""), reason));
                }
            }

            if (issues.Count == 0)
            {
                s.Status = Received;
                s.ReceivedBy = me;
                s.ReceivedAt = clock.UtcNow;
                Notify("archive.received", s);
                await db.SaveChangesAsync(ct);
                // Lần này mọi hồ sơ đều qua: xóa dấu lỗi của các lần thử trước.
                await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE hoso.archive_submission_items SET check_result = 'ok', note = '' WHERE submission_id = {id}", ct);
                await transaction.CommitAsync(ct);
            }
            else
            {
                await transaction.RollbackAsync(ct);   // không hồ sơ nào đổi trạng thái
            }
        }

        if (issues.Count > 0)
        {
            db.ChangeTracker.Clear();
            await RecordIssuesAsync(id, issues, ct);
            throw new AppException(422, "archive_issues",
                $"Chưa tiếp nhận được: {issues.Count}/{items.Count} hồ sơ có vấn đề. Chưa có hồ sơ nào đổi trạng thái. Xử lý rồi tiếp nhận lại, hoặc trả lại đợt.", issues);
        }

        await EnsureMinutesAsync(id, ct);
        return await GetAsync(id, ct);
    }

    public async Task<ArchiveSubmissionDto> ReturnAsync(Guid id, ReturnSubmissionRequest r, CancellationToken ct)
    {
        var s = await LoadAsync(id, ct);
        if (s.Status != Submitted) throw AppException.Conflict("Chỉ trả lại được đợt đã nộp.");
        var members = await db.Read<ArchiveSubmissionItem>().Where(i => i.SubmissionId == id).Select(i => i.DossierId).ToListAsync(ct);
        var unknown = (r.Issues ?? []).Where(i => !members.Contains(i.DossierId)).ToList();
        if (unknown.Count > 0) throw new ValidationFailedException(new Dictionary<string, string[]> { ["issues"] = ["Có hồ sơ nêu lỗi không thuộc đợt này."] });
        s.Status = Returned;
        s.ReturnNote = r.Note.Trim();
        foreach (var issue in r.Issues ?? [])
        {
            var item = await db.Set<ArchiveSubmissionItem>().SingleAsync(i => i.SubmissionId == id && i.DossierId == issue.DossierId, ct);
            item.CheckResult = "issue";
            item.Note = issue.Note.Trim();
        }
        Notify("archive.returned", s);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    /// <summary>BE-85. Biên bản của đợt đã tiếp nhận. Sinh một lần rồi lưu; nếu lần sinh đầu bị lỡ thì lần tải đầu tiên sinh bù.</summary>
    public async Task<MinutesFile> MinutesAsync(Guid id, CancellationToken ct)
    {
        var s = await LoadAsync(id, ct, track: false);
        if (s.Status != Received) throw AppException.Conflict("Biên bản chỉ có sau khi đợt được tiếp nhận.");
        var documentId = s.MinutesDocumentId ?? await EnsureMinutesAsync(id, ct);
        var file = await db.Read<FileRecord>().Where(f => f.DocumentId == documentId).OrderByDescending(f => f.VersionNo).FirstAsync(ct);
        return new MinutesFile(await storage.OpenReadAsync(file.StorageKey!, ct), file.OriginalName, file.ByteSize);
    }

    // ---- nội bộ ----
    private async Task<Guid> EnsureMinutesAsync(Guid id, CancellationToken ct)
    {
        var me = user.RequireUserId();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // Khóa đợt: hai yêu cầu cùng sinh bù không tạo hai biên bản.
        var existing = (await db.Database.SqlQuery<Guid?>($"SELECT minutes_document_id AS \"Value\" FROM hoso.archive_submissions WHERE id = {id} FOR UPDATE").ToListAsync(ct)).Single();
        if (existing is { } already) return already;

        var s = await db.Read<ArchiveSubmission>().SingleAsync(x => x.Id == id, ct);
        var names = await db.Read<User>().Where(u => u.Id == s.SubmittedBy || u.Id == s.ReceivedBy).ToDictionaryAsync(u => u.Id, u => u.DisplayName, ct);
        var organization = (await db.Database.SqlQuery<string>($"SELECT name AS \"Value\" FROM hoso.organizations WHERE code = {s.OrganizationCode}").ToListAsync(ct)).SingleOrDefault() ?? s.OrganizationCode;
        var rows = await (from i in db.Read<ArchiveSubmissionItem>() join d in db.Read<Dossier>() on i.DossierId equals d.Id
                          where i.SubmissionId == id orderby d.Code select new MinutesDossier(d.Code, d.Title, i.PageCount, d.PhysicalLocation)).ToListAsync(ct);
        var bytes = renderer.ArchiveMinutes(new MinutesModel(s.Code, organization, s.ReceivedAt!.Value, names.GetValueOrDefault(s.SubmittedBy!.Value, "?"), names.GetValueOrDefault(s.ReceivedBy!.Value, "?"), rows, s.Note));
        await using var stream = new MemoryStream(bytes);
        var pages = pdf.CountPages(stream);
        stream.Position = 0;
        var stored = await storage.SaveAsync(stream, ct);

        var document = new Document { Origin = "internal", Title = $"Biên bản nộp lưu {s.Code}", DocumentForm = "Biên bản", IntakeStatus = IntakeStatus.Filed, UploadedBy = me };
        db.Set<Document>().Add(document);
        await db.SaveChangesAsync(ct);
        db.Set<FileRecord>().Add(new FileRecord
        {
            DocumentId = document.Id, FileRole = "derivative", OriginalName = $"bien-ban-{s.Code}.pdf", MediaType = "application/pdf", ByteSize = stored.ByteSize,
            Sha256 = stored.Sha256, StorageKey = stored.StorageKey, PageCount = pages, UploadedBy = me, UploadedAt = clock.UtcNow,
        });
        await db.SaveChangesAsync(ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE hoso.archive_submissions SET minutes_document_id = {document.Id} WHERE id = {id}", ct);
        await transaction.CommitAsync(ct);
        return document.Id;
    }

    private async Task RecordIssuesAsync(Guid id, List<ArchiveIssue> issues, CancellationToken ct)
    {
        var failed = issues.Select(i => i.DossierId).ToArray();
        await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE hoso.archive_submission_items SET check_result = 'ok', note = '' WHERE submission_id = {id} AND NOT (dossier_id = ANY({failed}))", ct);
        foreach (var issue in issues)
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE hoso.archive_submission_items SET check_result = 'issue', note = {issue.Problem} WHERE submission_id = {id} AND dossier_id = {issue.DossierId}", ct);
    }

    private async Task<Dictionary<Guid, int>> PagesAsync(Guid[] dossierIds, CancellationToken ct)
    {
        // Số trang của giấy tờ = số trang của bản mới nhất còn nội dung; hồ sơ = tổng các thành phần.
        var rows = await db.Database.SqlQuery<PageRow>($"""
            SELECT dd.dossier_id, coalesce(sum(f.page_count), 0)::int AS pages
            FROM hoso.dossier_documents dd
            JOIN LATERAL (SELECT page_count FROM hoso.files WHERE document_id = dd.document_id AND disposed_at IS NULL AND page_count IS NOT NULL
                          ORDER BY version_no DESC LIMIT 1) f ON true
            WHERE dd.relation_kind = 'component' AND dd.dossier_id = ANY({dossierIds})
            GROUP BY dd.dossier_id
            """).ToListAsync(ct);
        return rows.ToDictionary(r => r.dossier_id, r => r.pages);
    }

    private async Task<IReadOnlyList<ArchiveSubmissionDto>> ToDtosAsync(List<ArchiveSubmission> rows, bool includeItems, CancellationToken ct)
    {
        var ids = rows.Select(r => r.Id).ToList();
        var userIds = rows.SelectMany(r => new[] { r.CreatedBy, r.SubmittedBy, r.ReceivedBy }).Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToList();
        var names = await db.Read<User>().Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.DisplayName, ct);
        var items = await (from i in db.Read<ArchiveSubmissionItem>() join d in db.Read<Dossier>() on i.DossierId equals d.Id
                           where ids.Contains(i.SubmissionId) orderby d.Code
                           select new { i.SubmissionId, Item = new ArchiveItemDto(d.Id, d.Code, d.Title, i.PageCount, d.PhysicalLocation, i.CheckResult, i.Note) }).ToListAsync(ct);
        string? Name(Guid? id) => id is { } v ? names.GetValueOrDefault(v) : null;
        return rows.Select(r =>
        {
            var mine = items.Where(x => x.SubmissionId == r.Id).Select(x => x.Item).ToList();
            return new ArchiveSubmissionDto(r.Id, r.Code, r.Status, Name(r.CreatedBy) ?? "", r.CreatedAt, Name(r.SubmittedBy), r.SubmittedAt, Name(r.ReceivedBy), r.ReceivedAt,
                r.MinutesDocumentId is not null, r.Note, r.ReturnNote, mine.Count, mine.Sum(i => i.PageCount), includeItems ? mine : null);
        }).ToList();
    }

    private async Task<ArchiveSubmission> LoadAsync(Guid id, CancellationToken ct, bool track = true)
    {
        var organization = RequireOrganization();
        var query = track ? db.Set<ArchiveSubmission>() : db.Set<ArchiveSubmission>().AsNoTracking();
        return await query.SingleOrDefaultAsync(s => s.Id == id && s.OrganizationCode == organization, ct) ?? throw AppException.NotFound("đợt nộp lưu");
    }

    private void Notify(string type, ArchiveSubmission s) =>
        db.Set<OutboxMessage>().Add(new OutboxMessage
        {
            Type = type,
            Payload = System.Text.Json.JsonSerializer.Serialize(new { submissionId = s.Id, code = s.Code, organization = s.OrganizationCode, actorId = user.UserId, createdBy = s.CreatedBy, submittedBy = s.SubmittedBy }),
        });

    private string RequireOrganization() => user.OrganizationCode ?? throw new AppException(403, ErrorCodes.Forbidden, "Phân công đang dùng không gắn với cơ quan nào.");

    private static string? SqlState(Exception e)
    {
        for (var x = e; x is not null; x = x.InnerException!)
            if (x is DbException { SqlState: { } state }) return state;
        return null;
    }

    /// <summary>Lỗi nghiệp vụ của hàm chuyển bước (HS00x) thành lời giải thích; lỗi khác không bị nuốt.</summary>
    private static string? Reason(string state) => state switch
    {
        "HS001" => "Hồ sơ ngoài phạm vi phân công của bạn.",
        "HS002" => "Hồ sơ không còn ở bước chờ nộp lưu (đã được xử lý hoặc bị trả lại).",
        "HS003" => "Thao tác cần ghi ý kiến.",
        "HS004" => "Hồ sơ còn thành phần thiếu hoặc chưa đối chiếu.",
        "HS005" => "Hồ sơ vừa được người khác thay đổi.",
        "HS006" => "Hồ sơ không còn tồn tại.",
        _ => null,
    };
}

public sealed class CreateSubmissionValidator : AbstractValidator<CreateSubmissionRequest>
{
    public CreateSubmissionValidator()
    {
        RuleFor(x => x.DossierIds).NotNull().WithMessage("Chọn các hồ sơ cần nộp lưu.")
            .Must(ids => ids is { Count: > 0 and <= ArchiveHandler.MaxDossiers }).WithMessage($"Một đợt có từ 1 đến {ArchiveHandler.MaxDossiers} hồ sơ.");
        RuleFor(x => x.Note).MaximumLength(500).WithMessage("Ghi chú tối đa 500 ký tự.");
    }
}

public sealed class ReturnSubmissionValidator : AbstractValidator<ReturnSubmissionRequest>
{
    public ReturnSubmissionValidator()
    {
        RuleFor(x => x.Note).Must(v => v is not null && v.Trim().Length >= 10).WithMessage("Trả lại cần nêu lý do (ít nhất 10 ký tự).");
        RuleForEach(x => x.Issues).ChildRules(i => i.RuleFor(y => y.Note).Must(v => v is not null && v.Trim().Length >= 3).WithMessage("Mỗi lỗi cần mô tả ngắn."));
    }
}
