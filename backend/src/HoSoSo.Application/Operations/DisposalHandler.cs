using FluentValidation;
using HoSoSo.Application.Common;
using HoSoSo.Application.Intake;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Operations;

public sealed record DisposalDto(Guid Id, Guid DossierId, string DossierCode, string DossierTitle, string Reason, string Status, string RetentionLabel, short? RetentionYears,
    string? LegalReference, string RequestedByName, DateTimeOffset RequestedAt, string? DecidedByName, DateTimeOffset? DecidedAt, Guid? DecisionDocumentId, string DecisionNote,
    string? ExecutedByName, DateTimeOffset? ExecutedAt);
public sealed record EligibleDossierDto(Guid DossierId, string Code, string Title, DateTimeOffset ArchivedAt, string RetentionLabel, short RetentionYears, DateTimeOffset EligibleSince);
public sealed record RequestDisposalRequest(Guid DossierId, string Reason);
public sealed record ApproveDisposalRequest(Guid DecisionDocumentId, string? Note);
public sealed record RejectDisposalRequest(string Note);
public sealed record DisposalResult(DisposalDto Disposal, int FilesDisposed, int BlobsDeleted, int DocumentsKept);

/// <summary>
/// BE-87. Hủy hồ sơ hết thời hạn bảo quản: đề nghị → phê duyệt kèm văn bản quyết định → thực hiện. Đây là đường DUY NHẤT xóa nội dung tệp.
/// Hệ thống không tự hủy và không tự đặt thời hạn: chỉ hồ sơ đã lưu trữ, có quy tắc bảo quản ĐÃ XÁC NHẬN (người xác nhận + căn cứ pháp lý)
/// và đã đủ số năm, không đang được mượn, mới được đề nghị. Người phê duyệt khác người đề nghị.
/// Thực hiện xóa nội dung (tệp, ảnh trang, chữ OCR) của các giấy tờ nội bộ chỉ thuộc hồ sơ này; giữ dòng metadata, nhật ký và văn bản quyết định.
/// </summary>
public sealed class DisposalHandler(IHoSoDb db, IScopeFilter scope, ICurrentUser user, IClock clock, IDisposalProcessor processor)
{
    private static readonly string[] ActiveLoans = [LoanStatus.Approved, LoanStatus.Lent, LoanStatus.Overdue];

    private sealed record FileKeyRow(Guid id, string? storage_key);

    public async Task<IReadOnlyList<DisposalDto>> ListAsync(string? status, CancellationToken ct)
    {
        var organization = RequireOrganization();
        var query = from r in db.Read<DisposalRequest>() join d in db.Read<Dossier>() on r.DossierId equals d.Id where d.OrganizationCode == organization select r;
        if (status is { Length: > 0 }) query = query.Where(r => r.Status == status);
        return await ToDtosAsync(await query.OrderByDescending(r => r.RequestedAt).Take(200).ToListAsync(ct), ct);
    }

    public async Task<DisposalDto> GetAsync(Guid id, CancellationToken ct)
    {
        var organization = RequireOrganization();
        var row = await (from r in db.Read<DisposalRequest>() join d in db.Read<Dossier>() on r.DossierId equals d.Id
                         where r.Id == id && d.OrganizationCode == organization select r).SingleOrDefaultAsync(ct) ?? throw AppException.NotFound("đề nghị hủy");
        return (await ToDtosAsync([row], ct)).Single();
    }

    /// <summary>Hồ sơ đã lưu trữ, có quy tắc bảo quản đã xác nhận và đã đủ năm, chưa có đề nghị hủy: danh sách để văn thư chọn đề nghị.</summary>
    public async Task<IReadOnlyList<EligibleDossierDto>> EligibleAsync(CancellationToken ct)
    {
        var organization = RequireOrganization();
        var now = clock.UtcNow;
        var rules = await db.Read<RetentionRule>().Where(r => r.Status == "confirmed" && r.RetentionYears != null).ToListAsync(ct);
        if (rules.Count == 0) return [];
        var latest = now.AddYears(-rules.Min(r => r.RetentionYears!.Value));
        var candidates = await scope.Dossiers(db.Read<Dossier>())
            .Where(d => d.OrganizationCode == organization && d.Status == "archived" && d.ArchivedAt <= latest
                        && !db.Read<DisposalRequest>().Any(x => x.DossierId == d.Id && (x.Status == "requested" || x.Status == "approved" || x.Status == "executing" || x.Status == "executed")))
            .OrderBy(d => d.ArchivedAt).Take(500).ToListAsync(ct);
        var result = new List<EligibleDossierDto>();
        foreach (var d in candidates)
        {
            var rule = Resolve(d, rules);
            if (rule is null) continue;
            var since = d.ArchivedAt!.Value.AddYears(rule.RetentionYears!.Value);
            if (since <= now) result.Add(new EligibleDossierDto(d.Id, d.Code, d.Title, d.ArchivedAt!.Value, rule.RetentionLabel, rule.RetentionYears!.Value, since));
        }
        return result;
    }

    public async Task<DisposalDto> RequestAsync(RequestDisposalRequest r, CancellationToken ct)
    {
        var me = user.RequireUserId();
        var organization = RequireOrganization();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await MutationLocks.DossierAsync(db, r.DossierId, ct);
        var dossier = await scope.Dossiers(db.Set<Dossier>()).SingleOrDefaultAsync(d => d.Id == r.DossierId && d.OrganizationCode == organization, ct) ?? throw AppException.NotFound("hồ sơ");
        var rule = await EnsureEligibleAsync(dossier, ct);
        if (await db.Read<DisposalRequest>().AnyAsync(x => x.DossierId == dossier.Id && (x.Status == "requested" || x.Status == "approved" || x.Status == "executing" || x.Status == "executed"), ct))
            throw new AppException(409, "disposal_conflict", "Hồ sơ này đã có đề nghị hủy đang xử lý hoặc đã được hủy.");
        var request = new DisposalRequest { DossierId = dossier.Id, RetentionRuleId = rule.Id, Reason = r.Reason.Trim(), RequestedBy = me };
        dossier.RetentionRuleId = rule.Id;   // ghi lại quy tắc đã dùng làm căn cứ
        db.Set<DisposalRequest>().Add(request);
        Notify("disposal.requested", request, organization);
        await db.SaveChangesAsync(ct);   // hai người cùng đề nghị: chỉ mục duy nhất → 409 disposal_conflict
        await transaction.CommitAsync(ct);
        return await GetAsync(request.Id, ct);
    }

    public async Task<DisposalDto> ApproveAsync(Guid id, ApproveDisposalRequest r, CancellationToken ct)
    {
        var me = user.RequireUserId();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await MutationLocks.DocumentAsync(db, r.DecisionDocumentId, ct);
        var dossierId = await db.Read<DisposalRequest>().Where(x => x.Id == id).Select(x => (Guid?)x.DossierId).SingleOrDefaultAsync(ct)
            ?? throw AppException.NotFound("đề nghị hủy");
        await MutationLocks.DossierAsync(db, dossierId, ct);
        var (request, dossier) = await LoadAsync(id, ct);
        if (request.Status != "requested") throw AppException.Conflict("Chỉ phê duyệt được đề nghị đang chờ.");
        if (request.RequestedBy == me) throw new AppException(403, ErrorCodes.Forbidden, "Người phê duyệt phải khác người đề nghị hủy.");
        if (!await scope.Dossiers(db.Read<Dossier>()).AnyAsync(d => d.Id == dossier.Id, ct)) throw AppException.NotFound("hồ sơ");
        await EnsureEligibleAsync(dossier, ct);

        // Văn bản quyết định phải là giấy tờ đã có trong hệ thống, nhìn thấy được, và nằm NGOÀI hồ sơ bị hủy (nếu không nó cũng bị hủy theo).
        var document = await scope.Documents(db.Read<Document>()).Where(d => d.Id == r.DecisionDocumentId).Select(d => new { d.Id }).SingleOrDefaultAsync(ct)
            ?? throw new AppException(422, "decision_document_invalid", "Không tìm thấy văn bản quyết định hoặc bạn không có quyền xem văn bản đó.");
        if (await db.Read<DossierDocument>().AnyAsync(l => l.DossierId == dossier.Id && l.DocumentId == document.Id, ct))
            throw new AppException(422, "decision_document_invalid", "Văn bản quyết định không được nằm trong chính hồ sơ bị hủy.");

        request.Status = "approved";
        request.DecidedBy = me;
        request.DecidedAt = clock.UtcNow;
        request.DecisionDocumentId = document.Id;
        request.DecisionNote = r.Note?.Trim() ?? "";
        Notify("disposal.approved", request, dossier.OrganizationCode);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<DisposalDto> RejectAsync(Guid id, RejectDisposalRequest r, CancellationToken ct)
    {
        var me = user.RequireUserId();
        var (request, dossier) = await LoadAsync(id, ct);
        if (request.Status != "requested") throw AppException.Conflict("Chỉ từ chối được đề nghị đang chờ.");
        request.Status = "rejected";
        request.DecidedBy = me;
        request.DecidedAt = clock.UtcNow;
        request.DecisionNote = r.Note.Trim();
        Notify("disposal.rejected", request, dossier.OrganizationCode);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    /// <summary>
    /// Chặn nội dung và ghi hàng đợi xóa trong một giao dịch; chỉ xóa blob sau COMMIT. Worker tiếp tục khi kho lỗi hoặc request bị ngắt.
    /// </summary>
    public async Task<DisposalResult> ExecuteAsync(Guid id, CancellationToken ct)
    {
        var me = user.RequireUserId();
        // Giữ liên kết giấy tờ ổn định trong lúc chọn nội dung cần hủy.
        var initial = await LoadAsync(id, ct);
        var documentLocks = await db.Read<DossierDocument>().Where(l => l.DossierId == initial.Dossier.Id).OrderBy(l => l.DocumentId).Select(l => l.DocumentId).ToListAsync(ct);
        db.ChangeTracker.Clear();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        foreach (var documentId in documentLocks) await MutationLocks.DocumentAsync(db, documentId, ct);
        await MutationLocks.DossierAsync(db, initial.Dossier.Id, ct);
        var (request, dossier) = await LoadAsync(id, ct);
        if (request.Status == "executing")
            throw AppException.Conflict("Đề nghị này đang thực hiện; hệ thống sẽ tiếp tục thử lại khi kho tệp sẵn sàng.");
        if (request.Status != "approved")
            throw AppException.Conflict(request.Status == "executed" ? "Đề nghị này đã được thực hiện." : "Chỉ thực hiện được đề nghị đã phê duyệt kèm văn bản quyết định.");
        await EnsureEligibleAsync(dossier, ct);
        var now = clock.UtcNow;

        // Chốt trạng thái trước tiên bằng một câu lệnh có điều kiện: hai yêu cầu thực hiện cùng lúc chỉ một yêu cầu được nhận.
        var claimed = await db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE hoso.disposal_requests SET status = 'executing', executed_by = {me} WHERE id = {request.Id} AND status = 'approved'", ct);
        if (claimed != 1) throw AppException.Conflict("Đề nghị này vừa được thực hiện bởi người khác.");
        // Giấy tờ chỉ thuộc hồ sơ này và do nội bộ tạo: giấy tờ công khai, giấy tờ dùng chung nhiều hồ sơ, văn bản quyết định và biên bản nộp lưu được giữ nguyên.
        var documents = await db.Database.SqlQuery<Guid>($"""
            SELECT d.id AS "Value" FROM hoso.dossier_documents dd JOIN hoso.documents d ON d.id = dd.document_id
            WHERE dd.dossier_id = {dossier.Id} AND d.origin = 'internal'
              AND NOT EXISTS (SELECT 1 FROM hoso.dossier_documents o WHERE o.document_id = d.id AND o.dossier_id <> {dossier.Id})
              AND NOT EXISTS (SELECT 1 FROM hoso.disposal_requests x WHERE x.decision_document_id = d.id)
              AND NOT EXISTS (SELECT 1 FROM hoso.archive_submissions a WHERE a.minutes_document_id = d.id)
            """).ToListAsync(ct);
        var totalDocuments = await db.Read<DossierDocument>().CountAsync(l => l.DossierId == dossier.Id, ct);
        var documentIds = documents.ToArray();

        // Worker khóa job trước khi ghi trang; lấy khóa cùng thứ tự job → file để tránh deadlock.
        // Khóa giấy tờ phía trên cũng ngăn API tạo job mới trong lúc hủy.
        await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE hoso.ocr_jobs SET status = 'cancelled', started_at = coalesce(started_at, {now}), finished_at = {now}, locked_by = NULL WHERE file_id IN (SELECT id FROM hoso.files WHERE document_id = ANY({documentIds})) AND status IN ('queued','running')", ct);
        var files = await db.Database.SqlQuery<FileKeyRow>($"SELECT id, storage_key FROM hoso.files WHERE document_id = ANY({documentIds}) AND disposed_at IS NULL FOR UPDATE").ToListAsync(ct);
        var fileIds = files.Select(f => f.id).ToArray();
        var keys = files.Where(f => f.storage_key is not null).Select(f => f.storage_key!).ToList();
        keys.AddRange(await db.Database.SqlQuery<string>($"SELECT preview_storage_key AS \"Value\" FROM hoso.page_images WHERE file_id = ANY({fileIds}) AND preview_storage_key IS NOT NULL").ToListAsync(ct));

        await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE hoso.files SET disposed_at = {now}, storage_key = NULL WHERE id = ANY({fileIds})", ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM hoso.page_images WHERE file_id = ANY({fileIds})", ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM hoso.ocr_pages WHERE job_id IN (SELECT id FROM hoso.ocr_jobs WHERE file_id = ANY({fileIds}))", ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE hoso.ai_field_suggestions SET quote = '', value = '' WHERE suggestion_id IN (SELECT id FROM hoso.ai_suggestions WHERE document_id = ANY({documentIds}))", ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE hoso.ai_suggestions SET quote = '' WHERE document_id = ANY({documentIds})", ct);

        // Bản giấy cũng bị hủy cùng: bỏ vị trí lưu kho (lịch sử vị trí vẫn còn, ghi lý do).
        var moveNote = $"Hủy theo đề nghị {request.Id}";
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT set_config('hoso.move_note', {moveNote}, true)", ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE hoso.dossiers SET storage_location_id = NULL, physical_location = NULL, updated_at = {now} WHERE id = {dossier.Id}", ct);


        foreach (var key in keys.Distinct())
            await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO hoso.disposal_blob_deletions(request_id, storage_key) VALUES ({id}, {key}) ON CONFLICT DO NOTHING", ct);
        var kept = totalDocuments - documentIds.Length;
        await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE hoso.disposal_requests SET files_disposed = {fileIds.Length}, documents_kept = {kept} WHERE id = {id}", ct);
        await transaction.CommitAsync(ct); // Tới đây metadata và danh sách xóa đã bền vững. Chưa xóa blob nào.

        await processor.ProcessAsync(id, ct); // Cố gắng hoàn tất ngay; lỗi kho được worker thử lại.
        return await ResultAsync(id, ct);
    }

    private async Task<DisposalResult> ResultAsync(Guid id, CancellationToken ct)
    {
        var counts = await db.Read<DisposalRequest>().Where(r => r.Id == id).Select(r => new { r.FilesDisposed, r.DocumentsKept }).SingleAsync(ct);
        var deleted = (await db.Database.SqlQuery<int>($"SELECT count(*)::int AS \"Value\" FROM hoso.disposal_blob_deletions WHERE request_id = {id} AND deleted").ToListAsync(ct)).Single();
        return new DisposalResult(await GetAsync(id, ct), counts.FilesDisposed, deleted, counts.DocumentsKept);
    }

    // ---- nội bộ ----
    private async Task<(DisposalRequest Request, Dossier Dossier)> LoadAsync(Guid id, CancellationToken ct)
    {
        var organization = RequireOrganization();
        var request = await db.Set<DisposalRequest>().SingleOrDefaultAsync(r => r.Id == id, ct) ?? throw AppException.NotFound("đề nghị hủy");
        var dossier = await db.Set<Dossier>().SingleAsync(d => d.Id == request.DossierId, ct);
        if (dossier.OrganizationCode != organization) throw AppException.NotFound("đề nghị hủy");
        return (request, dossier);
    }

    /// <summary>Hồ sơ đủ điều kiện hủy hay chưa; trả quy tắc bảo quản làm căn cứ.</summary>
    private async Task<RetentionRule> EnsureEligibleAsync(Dossier dossier, CancellationToken ct)
    {
        if (dossier.Status != "archived") throw new AppException(422, "disposal_not_eligible", "Chỉ hủy được hồ sơ đã lưu trữ.");
        var rules = await db.Read<RetentionRule>().Where(r => r.Status == "confirmed" && r.RetentionYears != null).ToListAsync(ct);
        var rule = Resolve(dossier, rules) ?? throw new AppException(422, "retention_missing",
            "Hồ sơ chưa có thời hạn bảo quản đã được xác nhận (cần người xác nhận và căn cứ pháp lý). Xác nhận quy tắc bảo quản trong danh mục trước, hệ thống không tự đặt thời hạn.");
        var eligibleSince = dossier.ArchivedAt!.Value.AddYears(rule.RetentionYears!.Value);
        if (eligibleSince > clock.UtcNow)
            throw new AppException(422, "retention_not_elapsed", $"Hồ sơ chưa hết thời hạn bảo quản \"{rule.RetentionLabel}\" (đến {eligibleSince.ToOffset(TimeSpan.FromHours(7)):dd/MM/yyyy}).");
        await EnsureNoActiveLoanAsync(dossier.Id, ct);
        return rule;
    }

    private async Task EnsureNoActiveLoanAsync(Guid dossierId, CancellationToken ct)
    {
        if (await db.Read<Loan>().AnyAsync(l => l.DossierId == dossierId && ActiveLoans.Contains(l.Status), ct))
            throw new AppException(409, "loan_conflict", "Hồ sơ đang được mượn hoặc có khoản mượn đã duyệt chưa giao. Nhận trả hồ sơ trước khi hủy.");
    }

    /// <summary>Quy tắc đã gán cho hồ sơ; nếu chưa gán thì quy tắc đã xác nhận duy nhất của nhóm công việc (không đoán khi có nhiều quy tắc).</summary>
    private static RetentionRule? Resolve(Dossier d, IReadOnlyList<RetentionRule> confirmed)
    {
        if (d.RetentionRuleId is { } assigned) return confirmed.FirstOrDefault(r => r.Id == assigned);
        var byGroup = confirmed.Where(r => r.WorkGroupCode == d.WorkGroupCode && r.DocumentTypeCode is null).ToList();
        return byGroup.Count == 1 ? byGroup[0] : null;
    }

    private async Task<IReadOnlyList<DisposalDto>> ToDtosAsync(List<DisposalRequest> rows, CancellationToken ct)
    {
        var dossierIds = rows.Select(r => r.DossierId).Distinct().ToList();
        var ruleIds = rows.Select(r => r.RetentionRuleId).Distinct().ToList();
        var userIds = rows.SelectMany(r => new[] { r.RequestedBy, r.DecidedBy, r.ExecutedBy }).Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToList();
        var dossiers = await db.Read<Dossier>().Where(d => dossierIds.Contains(d.Id)).ToDictionaryAsync(d => d.Id, ct);
        var rules = await db.Read<RetentionRule>().Where(r => ruleIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, ct);
        var names = await db.Read<User>().Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.DisplayName, ct);
        string? Name(Guid? id) => id is { } v ? names.GetValueOrDefault(v) : null;
        return rows.Select(r => new DisposalDto(r.Id, r.DossierId, dossiers[r.DossierId].Code, dossiers[r.DossierId].Title, r.Reason, r.Status, rules[r.RetentionRuleId].RetentionLabel,
            rules[r.RetentionRuleId].RetentionYears, rules[r.RetentionRuleId].LegalReference, Name(r.RequestedBy) ?? "", r.RequestedAt, Name(r.DecidedBy), r.DecidedAt,
            r.DecisionDocumentId, r.DecisionNote, Name(r.ExecutedBy), r.ExecutedAt)).ToList();
    }

    private void Notify(string type, DisposalRequest request, string organization) =>
        db.Set<OutboxMessage>().Add(new OutboxMessage
        {
            Type = type,
            Payload = System.Text.Json.JsonSerializer.Serialize(new { disposalId = request.Id, dossierId = request.DossierId, requestedBy = request.RequestedBy, organization, actorId = user.UserId }),
        });

    private string RequireOrganization() => user.OrganizationCode ?? throw new AppException(403, ErrorCodes.Forbidden, "Phân công đang dùng không gắn với cơ quan nào.");
}

public sealed class RequestDisposalValidator : AbstractValidator<RequestDisposalRequest>
{
    public RequestDisposalValidator()
    {
        RuleFor(x => x.DossierId).NotEmpty().WithMessage("Chọn hồ sơ cần hủy.");
        RuleFor(x => x.Reason).Must(v => v is not null && v.Trim().Length >= 10).WithMessage("Nêu lý do hủy (ít nhất 10 ký tự).").MaximumLength(1000).WithMessage("Lý do tối đa 1000 ký tự.");
    }
}

public sealed class ApproveDisposalValidator : AbstractValidator<ApproveDisposalRequest>
{
    public ApproveDisposalValidator() => RuleFor(x => x.DecisionDocumentId).NotEmpty().WithMessage("Chọn văn bản quyết định hủy.");
}

public sealed class RejectDisposalValidator : AbstractValidator<RejectDisposalRequest>
{
    public RejectDisposalValidator() => RuleFor(x => x.Note).Must(v => v is not null && v.Trim().Length >= 10).WithMessage("Từ chối cần ghi lý do (ít nhất 10 ký tự).");
}
