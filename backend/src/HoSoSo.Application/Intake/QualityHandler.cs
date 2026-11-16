using FluentValidation;
using HoSoSo.Application.Common;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Intake;

public sealed record QualityIssueDto(Guid Id, Guid? BatchId, string? BatchCode, Guid? DocumentId, Guid? FileId, int? PageNo, string IssueType, string Severity,
    string Description, string Status, DateTimeOffset RaisedAt, DateTimeOffset? ResolvedAt);
public sealed record SuspectPage(Guid DocumentId, Guid FileId, string FileName, int PageNo, IReadOnlyList<string> Flags, string Status);
public sealed record QualityOverview(IReadOnlyList<QualityIssueDto> Issues, IReadOnlyList<SuspectPage> SuspectPages);

public sealed record CreateIssueRequest(Guid? BatchId, Guid? DocumentId, Guid? FileId, int? PageNo, string IssueType, string? Severity, string? Description);
public sealed record ResolveIssueRequest(string Status, string? Note);
public sealed record PageQualityRequest(string Status, string? Note);

/// <summary>
/// BE-53. Lỗi ảnh quét (trống, mờ, nghiêng, mất trang...). Worker AI tự gắn cờ trang đáng ngờ (page_images); văn thư xác nhận,
/// ghi lỗi, đánh dấu cần quét lại. Lô quét chỉ đóng được khi không còn lỗi đang mở (xem IntakeHandler.CloseBatchAsync).
/// </summary>
public sealed class QualityHandler(IHoSoDb db, IScopeFilter scope, ICurrentUser user, IClock clock)
{
    public static readonly string[] IssueTypes = ["blank", "blurry", "skewed", "cropped", "duplicate", "missing_page", "wrong_order", "other"];

    public async Task<QualityOverview> ListAsync(Guid? batchId, string? status, CancellationToken ct)
    {
        var organization = user.OrganizationCode;
        var issues = db.Read<QualityIssue>();
        var batches = db.Read<ScanBatch>().Where(b => b.OrganizationCode == organization);
        var query = from i in issues
                    join b in batches on i.ScanBatchId equals b.Id into bs
                    from b in bs.DefaultIfEmpty()
                    where (b != null || (i.DocumentId != null && scope.Documents(db.Read<Document>()).Any(d => d.Id == i.DocumentId)))
                          && (batchId == null || i.ScanBatchId == batchId) && (status == null || i.Status == status)
                    orderby i.RaisedAt descending
                    select new QualityIssueDto(i.Id, i.ScanBatchId, b.Code, i.DocumentId, i.FileId, i.PageNo, i.IssueType, i.Severity, i.Description, i.Status, i.RaisedAt, i.ResolvedAt);
        var list = await query.Take(300).ToListAsync(ct);

        var visibleDocs = scope.Documents(db.Read<Document>());
        var suspect = await (from p in db.Read<PageImage>()
                             join f in db.Read<FileRecord>() on p.FileId equals f.Id
                             join d in visibleDocs on f.DocumentId equals d.Id
                             where (p.QualityStatus == "suspect" || p.QualityStatus == "rescan_required") && (batchId == null || f.ScanBatchId == batchId)
                             orderby f.UploadedAt descending, p.PageNo
                             select new SuspectPage(d.Id, f.Id, f.OriginalName, p.PageNo, p.QualityFlags, p.QualityStatus)).Take(300).ToListAsync(ct);
        return new QualityOverview(list, suspect);
    }

    public async Task<QualityIssueDto> CreateAsync(CreateIssueRequest r, CancellationToken ct)
    {
        if (r.BatchId is null && r.DocumentId is null && r.FileId is null)
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["batchId"] = ["Chọn lô quét, giấy tờ hoặc tệp bị lỗi."] });
        Guid? documentId = r.DocumentId;
        if (r.FileId is { } fid)
        {
            var file = await db.Read<FileRecord>().Where(f => f.Id == fid).Select(f => new { f.DocumentId, f.ScanBatchId }).SingleOrDefaultAsync(ct) ?? throw AppException.NotFound("tệp");
            documentId ??= file.DocumentId;
        }
        if (documentId is { } did && !await scope.Documents(db.Read<Document>()).AnyAsync(d => d.Id == did, ct)) throw AppException.NotFound("giấy tờ");
        string? batchCode = null;
        if (r.BatchId is { } bid)
        {
            batchCode = await db.Read<ScanBatch>().Where(b => b.Id == bid && b.OrganizationCode == user.OrganizationCode).Select(b => b.Code).SingleOrDefaultAsync(ct)
                ?? throw AppException.NotFound("lô quét");
        }
        var issue = new QualityIssue
        {
            ScanBatchId = r.BatchId, DocumentId = documentId, FileId = r.FileId, PageNo = r.PageNo, IssueType = r.IssueType,
            Severity = r.Severity ?? "medium", Description = r.Description?.Trim() ?? "", RaisedBy = user.RequireUserId(),
        };
        db.Set<QualityIssue>().Add(issue);
        await db.SaveChangesAsync(ct);
        return new QualityIssueDto(issue.Id, issue.ScanBatchId, batchCode, issue.DocumentId, issue.FileId, issue.PageNo, issue.IssueType, issue.Severity,
            issue.Description, issue.Status, issue.RaisedAt, null);
    }

    public async Task<QualityIssueDto> ResolveAsync(Guid id, ResolveIssueRequest r, CancellationToken ct)
    {
        var issue = await db.Set<QualityIssue>().SingleOrDefaultAsync(i => i.Id == id, ct) ?? throw AppException.NotFound("lỗi ảnh");
        await EnsureVisibleAsync(issue, ct);
        if (issue.Status != "open") throw AppException.Conflict("Lỗi này đã được xử lý.");
        if (r.Status == "wont_fix" && (r.Note?.Trim().Length ?? 0) < 10)
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["note"] = ["Chấp nhận bỏ qua lỗi cần ghi lý do từ 10 ký tự."] });
        issue.Status = r.Status;
        issue.ResolvedBy = user.RequireUserId();
        issue.ResolvedAt = clock.UtcNow;
        if (!string.IsNullOrWhiteSpace(r.Note)) issue.Description = $"{issue.Description}{(issue.Description.Length > 0 ? " · " : "")}Xử lý: {r.Note.Trim()}";
        await db.SaveChangesAsync(ct);
        return new QualityIssueDto(issue.Id, issue.ScanBatchId, null, issue.DocumentId, issue.FileId, issue.PageNo, issue.IssueType, issue.Severity, issue.Description, issue.Status, issue.RaisedAt, issue.ResolvedAt);
    }

    /// <summary>Đặt trạng thái chất lượng một trang. "rescan_required" tự mở lỗi để lô không đóng được cho tới khi quét lại.</summary>
    public async Task<SuspectPage> SetPageQualityAsync(Guid fileId, int pageNo, PageQualityRequest r, CancellationToken ct)
    {
        var file = await (from f in db.Read<FileRecord>()
                          join d in scope.Documents(db.Read<Document>()) on f.DocumentId equals d.Id
                          where f.Id == fileId select new { f.Id, f.DocumentId, f.OriginalName, f.ScanBatchId, f.PageCount }).SingleOrDefaultAsync(ct)
            ?? throw AppException.NotFound("tệp");
        if (pageNo < 1 || (file.PageCount is { } pc && pageNo > pc))
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["pageNo"] = ["Số trang không nằm trong tệp."] });
        var page = await db.Set<PageImage>().SingleOrDefaultAsync(p => p.FileId == fileId && p.PageNo == pageNo, ct);
        if (page is null) { page = new PageImage { FileId = fileId, PageNo = pageNo }; db.Set<PageImage>().Add(page); }
        page.QualityStatus = r.Status;
        if (r.Status == "rescan_required")
        {
            var already = await db.Read<QualityIssue>().AnyAsync(i => i.FileId == fileId && i.PageNo == pageNo && i.Status == "open", ct);
            if (!already)
            {
                db.Set<QualityIssue>().Add(new QualityIssue
                {
                    ScanBatchId = file.ScanBatchId, DocumentId = file.DocumentId, FileId = fileId, PageNo = pageNo,
                    IssueType = page.QualityFlags.FirstOrDefault() ?? "other", Severity = "high",
                    Description = r.Note?.Trim() ?? "Trang cần quét lại", RaisedBy = user.RequireUserId(),
                });
            }
        }
        else if (r.Status is "ok" or "rescanned")
        {
            var now = clock.UtcNow;
            var open = await db.Set<QualityIssue>().Where(i => i.FileId == fileId && i.PageNo == pageNo && i.Status == "open").ToListAsync(ct);
            foreach (var i in open) { i.Status = "fixed"; i.ResolvedBy = user.RequireUserId(); i.ResolvedAt = now; }
        }
        await db.SaveChangesAsync(ct);
        return new SuspectPage(file.DocumentId, fileId, file.OriginalName, pageNo, page.QualityFlags, page.QualityStatus);
    }

    private async Task EnsureVisibleAsync(QualityIssue issue, CancellationToken ct)
    {
        var inOrg = issue.ScanBatchId is { } b && await db.Read<ScanBatch>().AnyAsync(x => x.Id == b && x.OrganizationCode == user.OrganizationCode, ct);
        var viaDoc = issue.DocumentId is { } d && await scope.Documents(db.Read<Document>()).AnyAsync(x => x.Id == d, ct);
        if (!inOrg && !viaDoc) throw AppException.NotFound("lỗi ảnh");
    }
}

public sealed class CreateIssueValidator : AbstractValidator<CreateIssueRequest>
{
    public CreateIssueValidator()
    {
        RuleFor(x => x.IssueType).Must(v => QualityHandler.IssueTypes.Contains(v)).WithMessage("Loại lỗi: blank, blurry, skewed, cropped, duplicate, missing_page, wrong_order hoặc other.");
        RuleFor(x => x.Severity).Must(v => v is null or "low" or "medium" or "high").WithMessage("Mức độ: low, medium hoặc high.");
        RuleFor(x => x.PageNo).GreaterThan(0).When(x => x.PageNo is not null).WithMessage("Số trang phải lớn hơn 0.");
        RuleFor(x => x.Description).MaximumLength(1000).WithMessage("Mô tả tối đa 1000 ký tự.");
    }
}

public sealed class ResolveIssueValidator : AbstractValidator<ResolveIssueRequest>
{
    public ResolveIssueValidator() => RuleFor(x => x.Status).Must(v => v is "fixed" or "wont_fix").WithMessage("Trạng thái chỉ nhận fixed hoặc wont_fix.");
}

public sealed class PageQualityValidator : AbstractValidator<PageQualityRequest>
{
    public PageQualityValidator() => RuleFor(x => x.Status).Must(v => v is "ok" or "suspect" or "rescan_required" or "rescanned")
        .WithMessage("Trạng thái chỉ nhận ok, suspect, rescan_required hoặc rescanned.");
}
