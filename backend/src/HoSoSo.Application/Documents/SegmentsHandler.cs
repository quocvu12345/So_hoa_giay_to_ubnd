using System.Text.Json;
using FluentValidation;
using HoSoSo.Application.Common;
using HoSoSo.Application.Intake;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Documents;

public sealed record SegmentDto(Guid Id, int PageFrom, int PageTo, string Status, string ProposedBy, Guid? TargetDocumentId);
public sealed record SegmentList(Guid FileId, int PageCount, IReadOnlyList<SegmentDto> Segments);
public sealed record SegmentInput(int PageFrom, int PageTo);
public sealed record ProposeSegmentsRequest(IReadOnlyList<SegmentInput> Segments);
public sealed record ConfirmSplitRequest(IReadOnlyDictionary<Guid, string>? Titles);
public sealed record ChildDocument(Guid DocumentId, Guid FileId, Guid JobId, int PageFrom, int PageTo, string Title);
public sealed record SplitResult(Guid SourceDocumentId, IReadOnlyList<ChildDocument> Children);

/// <summary>
/// BE-51. Một PDF quét nhiều văn bản độc lập (đơn 1–2, biên bản 3–5...) được tách thành các văn bản con.
/// Đề xuất: dải trang không chồng, không hở, phủ đủ số trang. Xác nhận: cắt trang thành tệp mới cho từng phần
/// (mỗi phần vào hộp tiếp nhận và được AI đọc riêng), văn bản nguồn chuyển "split". Tệp gốc không bao giờ bị sửa.
/// </summary>
public sealed class SegmentsHandler(IHoSoDb db, IScopeFilter scope, ICurrentUser user, IClock clock, IFileStorage storage, IPdfTools pdf)
{
    public async Task<SegmentList> ListAsync(Guid documentId, CancellationToken ct)
    {
        var (_, file) = await SourceAsync(documentId, ct);
        var pages = await PageCountAsync(file, ct);
        var segments = await db.Read<DocumentSegment>().Where(s => s.SourceDocumentId == documentId && s.Status != "rejected").OrderBy(s => s.PageFrom)
            .Select(s => new SegmentDto(s.Id, s.PageFrom, s.PageTo, s.Status, s.ProposedBy, s.TargetDocumentId)).ToListAsync(ct);
        return new SegmentList(file.Id, pages, segments);
    }

    public async Task<SegmentList> ProposeAsync(Guid documentId, ProposeSegmentsRequest r, CancellationToken ct)
    {
        var (document, file) = await SourceAsync(documentId, ct);
        if (document.IntakeStatus != IntakeStatus.Inbox) throw AppException.Conflict("Chỉ tách được PDF còn trong hộp tiếp nhận.");
        var pages = await PageCountAsync(file, ct);
        var ordered = r.Segments.OrderBy(s => s.PageFrom).ToList();
        var errors = Validate(ordered, pages);
        if (errors.Count > 0) throw new ValidationFailedException(errors);

        var old = await db.Set<DocumentSegment>().Where(s => s.SourceFileId == file.Id && s.Status == "proposed").ToListAsync(ct);
        db.Set<DocumentSegment>().RemoveRange(old);
        foreach (var s in ordered)
            db.Set<DocumentSegment>().Add(new DocumentSegment { SourceDocumentId = documentId, SourceFileId = file.Id, PageFrom = s.PageFrom, PageTo = s.PageTo, ProposedBy = "user" });
        await db.SaveChangesAsync(ct);
        return await ListAsync(documentId, ct);
    }

    /// <summary>Quy tắc dải trang: bắt đầu ở trang 1, liền nhau không chồng không hở, kết thúc ở trang cuối, ít nhất hai phần.</summary>
    internal static Dictionary<string, string[]> Validate(IReadOnlyList<SegmentInput> ordered, int pages)
    {
        var errors = new Dictionary<string, string[]>();
        if (ordered.Count < 2) { errors["segments"] = ["Cần ít nhất 2 phần để tách. Nếu cả tệp là một văn bản thì không cần tách."]; return errors; }
        for (var i = 0; i < ordered.Count; i++)
        {
            var s = ordered[i];
            if (s.PageFrom < 1 || s.PageTo < s.PageFrom) { errors[$"segments[{i}]"] = ["Trang đầu phải từ 1 và không lớn hơn trang cuối."]; return errors; }
            if (i == 0 && s.PageFrom != 1) { errors["segments"] = ["Phần đầu phải bắt đầu từ trang 1 (không được bỏ sót trang)."]; return errors; }
            if (i > 0 && s.PageFrom <= ordered[i - 1].PageTo) { errors["segments"] = [$"Trang {s.PageFrom} bị tính vào hai phần (chồng nhau)."]; return errors; }
            if (i > 0 && s.PageFrom > ordered[i - 1].PageTo + 1) { errors["segments"] = [$"Từ trang {ordered[i - 1].PageTo + 1} đến {s.PageFrom - 1} chưa thuộc phần nào (bị hở)."]; return errors; }
        }
        if (ordered[^1].PageTo != pages)
            errors["segments"] = [ordered[^1].PageTo > pages ? $"Tệp chỉ có {pages} trang." : $"Các phần mới tới trang {ordered[^1].PageTo}, tệp có {pages} trang (chưa phủ hết)."];
        return errors;
    }

    public async Task<SplitResult> ConfirmAsync(Guid segmentId, ConfirmSplitRequest request, CancellationToken ct)
    {
        var chosen = await db.Read<DocumentSegment>().SingleOrDefaultAsync(s => s.Id == segmentId, ct) ?? throw AppException.NotFound("đoạn trang");
        var (document, file) = await SourceAsync(chosen.SourceDocumentId, ct);
        if (document.IntakeStatus != IntakeStatus.Inbox) throw AppException.Conflict("Văn bản này đã được tách hoặc đã xếp vào hồ sơ.");
        var segments = await db.Set<DocumentSegment>().Where(s => s.SourceFileId == file.Id && s.Status == "proposed").OrderBy(s => s.PageFrom).ToListAsync(ct);
        if (segments.Count == 0) throw AppException.Conflict("Không còn đề xuất tách nào để xác nhận.");
        var pages = await PageCountAsync(file, ct);
        var errors = Validate(segments.Select(s => new SegmentInput(s.PageFrom, s.PageTo)).ToList(), pages);
        if (errors.Count > 0) throw new ValidationFailedException(errors);   // tệp đổi sau khi đề xuất

        // 1. Cắt trang và lưu tệp mới (lưu theo mã băm nên làm trước giao dịch là an toàn; tệp mồ côi dọn ở bảo trì kho).
        var cuts = new List<(DocumentSegment Segment, StoredFile Stored)>();
        await using (var source = await storage.OpenReadAsync(file.StorageKey!, ct))
        {
            using var buffer = new MemoryStream();
            await source.CopyToAsync(buffer, ct);
            foreach (var s in segments)
            {
                buffer.Position = 0;
                byte[] cut;
                try { cut = pdf.ExtractPages(buffer, s.PageFrom, s.PageTo); }
                catch (InvalidPdfException exception) { throw new AppException(422, "pdf_unreadable", exception.Message); }
                using var cutStream = new MemoryStream(cut);
                cuts.Add((s, await storage.SaveAsync(cutStream, ct)));
            }
        }
        var hashes = cuts.Select(c => c.Stored.Sha256).ToList();
        var existing = await db.Read<FileRecord>().Where(f => f.FileRole == "scan" && hashes.Contains(f.Sha256)).Select(f => f.DocumentId).FirstOrDefaultAsync(ct);
        if (existing != default)
            throw new AppException(409, ErrorCodes.DuplicateFile, "Một phần trang giống hệt một PDF đã có trong hệ thống. Mở giấy tờ đó thay vì tách lại.", new { documentId = existing });

        // 2. Giao dịch: văn bản con, tệp, job đọc AI, đánh dấu đoạn đã xác nhận, văn bản nguồn chuyển "split".
        var me = user.RequireUserId();
        var now = clock.UtcNow;
        var children = new List<ChildDocument>();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var created = new List<(DocumentSegment Segment, Document Doc, FileRecord File, OcrJob Job)>();
        foreach (var (segment, stored) in cuts)
        {
            var title = request.Titles is not null && request.Titles.TryGetValue(segment.Id, out var custom) && !string.IsNullOrWhiteSpace(custom)
                ? custom.Trim() : $"{document.Title} · trang {segment.PageFrom}–{segment.PageTo}";
            var child = new Document { Origin = "internal", Title = title.Length > 300 ? title[..300] : title, DocumentForm = "Chưa xác định", IntakeStatus = IntakeStatus.Inbox, UploadedBy = me };
            var childFile = new FileRecord
            {
                DocumentId = child.Id, FileRole = "scan", OriginalName = $"{Path.GetFileNameWithoutExtension(file.OriginalName)}_tr{segment.PageFrom}-{segment.PageTo}.pdf",
                MediaType = "application/pdf", ByteSize = stored.ByteSize, Sha256 = stored.Sha256, StorageKey = stored.StorageKey,
                PageCount = segment.PageTo - segment.PageFrom + 1, ScanBatchId = file.ScanBatchId, UploadedBy = me, UploadedAt = now,
            };
            var job = new OcrJob
            {
                FileId = childFile.Id, Priority = IntakeHandler.InteractivePriority, RequestedBy = me, PageCount = childFile.PageCount,
                Options = JsonSerializer.Serialize(new { correlation_id = user.CorrelationId, classify = true, split_from = document.Id }),
            };
            created.Add((segment, child, childFile, job));
        }
        db.Set<Document>().AddRange(created.Select(c => c.Doc));
        await db.SaveChangesAsync(ct);
        db.Set<FileRecord>().AddRange(created.Select(c => c.File));
        await db.SaveChangesAsync(ct);
        db.Set<OcrJob>().AddRange(created.Select(c => c.Job));
        foreach (var c in created)
        {
            c.Segment.TargetDocumentId = c.Doc.Id;
            c.Segment.Status = "confirmed";
            c.Segment.ConfirmedBy = me;
            c.Segment.ConfirmedAt = now;
            children.Add(new ChildDocument(c.Doc.Id, c.File.Id, c.Job.Id, c.Segment.PageFrom, c.Segment.PageTo, c.Doc.Title));
        }
        document.IntakeStatus = IntakeStatus.Split;
        document.UpdatedAt = now;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new SplitResult(document.Id, children);
    }

    // ---- nội bộ ----
    private async Task<(Document Document, FileRecord File)> SourceAsync(Guid documentId, CancellationToken ct)
    {
        var me = user.RequireUserId();
        // Chỉ người tải lên được tách. Văn bản đã tách rồi không còn nằm trong hộp tiếp nhận (không "thấy được"), nên kiểm trước để báo đúng 409.
        var owned = await db.Read<Document>().Where(d => d.Id == documentId && d.UploadedBy == me && d.Origin == "internal").Select(d => d.IntakeStatus).SingleOrDefaultAsync(ct);
        if (owned is null) throw AppException.NotFound("giấy tờ");
        if (owned == IntakeStatus.Split) throw AppException.Conflict("Văn bản này đã được tách thành các văn bản con.");
        var document = await scope.Documents(db.Set<Document>()).SingleOrDefaultAsync(d => d.Id == documentId, ct) ?? throw AppException.NotFound("giấy tờ");
        // Tách theo bản quét hiện hành (BE-126: bản đã bị thay không còn là nguồn).
        var file = await DocumentFiles.CurrentScans(db.Set<FileRecord>()).Where(f => f.DocumentId == documentId).OrderByDescending(f => f.VersionNo).FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("tệp quét của giấy tờ");
        if (file.StorageKey is null) throw AppException.NotFound("nội dung tệp");
        return (document, file);
    }

    private async Task<int> PageCountAsync(FileRecord file, CancellationToken ct)
    {
        if (file.PageCount is { } known) return known;
        try
        {
            await using var stream = await storage.OpenReadAsync(file.StorageKey!, ct);
            using var buffer = new MemoryStream();
            await stream.CopyToAsync(buffer, ct);
            buffer.Position = 0;
            var count = pdf.CountPages(buffer);
            file.PageCount = count;
            await db.SaveChangesAsync(ct);
            return count;
        }
        catch (InvalidPdfException exception) { throw new AppException(422, "pdf_unreadable", exception.Message); }
    }
}

public sealed class ProposeSegmentsValidator : AbstractValidator<ProposeSegmentsRequest>
{
    public ProposeSegmentsValidator() => RuleFor(x => x.Segments).NotNull().WithMessage("Gửi danh sách dải trang.").Must(s => s is null || s.Count <= 100).WithMessage("Tối đa 100 phần.");
}
