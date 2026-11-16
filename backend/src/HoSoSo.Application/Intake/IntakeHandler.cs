using System.Text.Json;
using HoSoSo.Application.Common;
using HoSoSo.Application.Documents;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HoSoSo.Application.Intake;

/// <summary>BE-40, BE-41, BE-42: lô quét, tải PDF lên (chống trùng), hộp tiếp nhận.</summary>
public sealed class IntakeHandler(IHoSoDb db, IScopeFilter scope, ICurrentUser user, IClock clock, IFileStorage storage, IVirusScanner scanner, IPdfTools pdf, ILogger<IntakeHandler> logger)
{
    public const int InteractivePriority = 3;
    public static readonly TimeSpan UndoWindow = TimeSpan.FromDays(30);
    private static readonly TimeSpan VietnamOffset = TimeSpan.FromHours(7);

    // ---- Lô quét ----
    public async Task<BatchSummary> CreateBatchAsync(CreateBatchRequest r, CancellationToken ct)
    {
        var me = user.RequireUserId();
        var organization = r.OrganizationCode ?? user.OrganizationCode ?? throw new ValidationFailedException(
            new Dictionary<string, string[]> { ["organizationCode"] = ["Chọn cơ quan của lô quét."] });
        if (organization != user.OrganizationCode) throw AppException.OutOfScope();
        var year = clock.UtcNow.ToOffset(VietnamOffset).Year;
        var code = (await db.Database.SqlQuery<string>($"SELECT hoso.next_scan_batch_code({year}) AS \"Value\"").ToListAsync(ct)).Single();
        var batch = new ScanBatch
        {
            Code = code, OrganizationCode = organization, DepartmentCode = r.DepartmentCode, HandedOverBy = r.HandedOverBy?.Trim(),
            BoxLabel = r.BoxLabel?.Trim(), ExpectedSheetCount = r.ExpectedSheetCount, ReceivedBy = me, Note = r.Note?.Trim() ?? "",
        };
        db.Set<ScanBatch>().Add(batch);
        await db.SaveChangesAsync(ct);
        return (await ListBatchesAsync(ct)).Single(b => b.Id == batch.Id);
    }

    public async Task<IReadOnlyList<BatchSummary>> ListBatchesAsync(CancellationToken ct)
    {
        var organization = user.OrganizationCode;
        var files = db.Read<FileRecord>();
        var issues = db.Read<QualityIssue>();
        return await db.Read<ScanBatch>().Where(b => b.OrganizationCode == organization)
            .OrderByDescending(b => b.OpenedAt)
            .Select(b => new BatchSummary(b.Id, b.Code, b.OrganizationCode, b.DepartmentCode, b.BoxLabel, b.HandedOverBy, b.ExpectedSheetCount,
                b.ScannedPageCount, files.Count(f => f.ScanBatchId == b.Id), b.Status, b.OpenedAt, b.ClosedAt,
                issues.Count(i => i.ScanBatchId == b.Id && i.Status == "open")))
            .ToListAsync(ct);
    }

    public async Task<BatchDetail> GetBatchAsync(Guid id, CancellationToken ct)
    {
        var summary = (await ListBatchesAsync(ct)).FirstOrDefault(b => b.Id == id) ?? throw AppException.NotFound("lô quét");
        var jobs = db.Read<OcrJob>();
        var files = await db.Read<FileRecord>().Where(f => f.ScanBatchId == id).OrderBy(f => f.UploadedAt)
            .Select(f => new BatchFile(f.DocumentId, f.Id, f.OriginalName, f.PageCount,
                jobs.Where(j => j.FileId == f.Id && j.JobType == "read_classify").OrderByDescending(j => j.CreatedAt).Select(j => j.Status).FirstOrDefault(),
                f.UploadedAt)).ToListAsync(ct);
        return new BatchDetail(summary, files);
    }

    public async Task<BatchSummary> CloseBatchAsync(Guid id, CancellationToken ct)
    {
        var batch = await db.Set<ScanBatch>().SingleOrDefaultAsync(b => b.Id == id && b.OrganizationCode == user.OrganizationCode, ct)
            ?? throw AppException.NotFound("lô quét");
        if (batch.Status == "closed") throw AppException.Conflict("Lô quét này đã đóng.");
        var open = await db.Read<QualityIssue>().CountAsync(i => i.ScanBatchId == id && i.Status == "open", ct);
        if (open > 0) throw AppException.Conflict($"Còn {open} lỗi ảnh chưa xử lý. Quét lại hoặc đánh dấu chấp nhận trước khi đóng lô.");
        batch.ScannedPageCount = await db.Read<FileRecord>().Where(f => f.ScanBatchId == id).SumAsync(f => f.PageCount ?? 0, ct);
        batch.Status = "closed";
        batch.ClosedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        return (await ListBatchesAsync(ct)).Single(b => b.Id == id);
    }

    // ---- Tải PDF lên ----
    /// <summary>
    /// Kiểm tra đúng là PDF (đầu tệp %PDF-), lưu theo SHA-256, chống trùng, tạo giấy tờ ở hộp tiếp nhận và xếp job đọc vào hàng đợi.
    /// Trùng PDF đã nạp: 409 duplicate_file kèm giấy tờ cũ, không tạo gì thêm.
    /// </summary>
    public async Task<UploadResult> UploadAsync(Stream content, string fileName, Guid? batchId, CancellationToken ct)
    {
        var me = user.RequireUserId();
        var name = Path.GetFileName(fileName ?? "").Trim();
        if (name.Length == 0 || name.Length > 255 || !name.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["file"] = ["Chỉ nhận tệp PDF (đuôi .pdf, tên tối đa 255 ký tự)."] });
        if (!content.CanSeek) throw new ArgumentException("Luồng tệp phải tua lại được.", nameof(content));
        var header = new byte[5];
        var read = await content.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, ct);
        content.Seek(0, SeekOrigin.Begin);
        if (read < 5 || !header.AsSpan().SequenceEqual("%PDF-"u8))
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["file"] = ["Tệp không phải PDF hợp lệ. Xuất lại tệp từ máy quét hoặc phần mềm tạo PDF."] });

        var pageCount = await CheckPageLimitAsync(content, ct);
        await CheckVirusAsync(content, ct);

        ScanBatch? batch = null;
        if (batchId is { } bid)
        {
            batch = await db.Set<ScanBatch>().SingleOrDefaultAsync(b => b.Id == bid && b.OrganizationCode == user.OrganizationCode, ct) ?? throw AppException.NotFound("lô quét");
            if (batch.Status == "closed") throw AppException.Conflict("Lô quét đã đóng, không thêm tệp được.");
        }

        var stored = await storage.SaveAsync(content, ct);
        var duplicate = await db.Read<FileRecord>().Where(f => f.FileRole == "scan" && f.Sha256 == stored.Sha256)
            .Select(f => new { f.DocumentId, f.Id, f.OriginalName, f.UploadedAt }).FirstOrDefaultAsync(ct);
        if (duplicate is not null)
        {
            // BE-92. Chỉ chỉ đường tới giấy tờ cũ khi người tải THẤY được nó. Giấy tờ ngoài phạm vi (hộp tiếp nhận riêng, hồ sơ đơn vị khác)
            // không được lộ mã, tên tệp gốc (có thể chứa tên người, số định danh) hay giờ tải.
            if (await scope.Documents(db.Read<Document>()).AnyAsync(d => d.Id == duplicate.DocumentId, ct))
            {
                throw new AppException(409, ErrorCodes.DuplicateFile, "PDF này đã được tải lên trước đó. Mở giấy tờ cũ thay vì tải lại.",
                    new { documentId = duplicate.DocumentId, fileId = duplicate.Id, fileName = duplicate.OriginalName, uploadedAt = duplicate.UploadedAt });
            }
            logger.LogWarning("duplicate_outside_scope");
            throw new AppException(409, ErrorCodes.DuplicateFile, "Tệp này đã có trong hệ thống ở nơi bạn không có quyền xem nên không tải lại được. Liên hệ văn thư hoặc quản trị để được hướng dẫn.");
        }

        var title = Path.GetFileNameWithoutExtension(name);
        var document = new Document
        {
            Origin = "internal", Title = title.Length > 0 ? title : name, DocumentForm = "Chưa xác định",
            IntakeStatus = IntakeStatus.Inbox, UploadedBy = me,
        };
        var file = new FileRecord
        {
            DocumentId = document.Id, FileRole = "scan", OriginalName = name, MediaType = "application/pdf",
            ByteSize = stored.ByteSize, Sha256 = stored.Sha256, StorageKey = stored.StorageKey, PageCount = pageCount,
            ScanBatchId = batch?.Id, UploadedBy = me, UploadedAt = clock.UtcNow,
        };
        var job = new OcrJob
        {
            FileId = file.Id, Priority = InteractivePriority, RequestedBy = me,
            Options = JsonSerializer.Serialize(new { correlation_id = user.CorrelationId, classify = true }),
        };
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        db.Set<Document>().Add(document);
        await db.SaveChangesAsync(ct);
        db.Set<FileRecord>().Add(file);
        await db.SaveChangesAsync(ct);
        db.Set<OcrJob>().Add(job);
        if (batch is { Status: "open" }) batch.Status = "scanning";
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new UploadResult(document.Id, file.Id, job.Id, name, stored.ByteSize);
    }

    /// <summary>Chặn cuối khi đếm trang lúc tải lên (chế độ InProcess). Khi chạy sandbox, tiến trình con bị giết đúng hạn của nó trước mốc này.</summary>
    private static readonly TimeSpan CountTimeout = TimeSpan.FromSeconds(60);   // lớn hơn hạn của sandbox PDF (PdfSandbox:TimeoutSeconds, mặc định 30 giây) để sandbox kết luận trước

    /// <summary>
    /// SEC-05. Từ chối PDF nhiều trang hơn giới hạn (<c>Limits:MaxPdfPages</c>) ngay khi tải lên, và ghi sẵn số trang cho giao diện.
    /// Chỉ giới hạn mới bị từ chối: tệp đọc không được (hỏng, mã hóa) vẫn được nhận như trước, để worker AI báo lỗi có ngữ cảnh.
    /// </summary>
    private async Task<int?> CheckPageLimitAsync(Stream content, CancellationToken ct)
    {
        try
        {
            var count = await Task.Run(() => pdf.CountPages(content), ct).WaitAsync(CountTimeout, ct);
            return count;
        }
        catch (PdfLimitExceededException exception)
        {
            throw new AppException(422, "pdf_too_large", exception.Message);
        }
        catch (TimeoutException)
        {
            // Quá phức tạp để đọc trong thời gian cho phép: coi là tệp không xử lý được thay vì cho qua. Từ chối luôn nên luồng không còn bị dùng song song.
            throw new AppException(422, "pdf_unreadable", "PDF này quá phức tạp để xử lý. Xuất lại tệp từ máy quét hoặc phần mềm tạo PDF.");
        }
        catch (InvalidPdfException)
        {
            return null;
        }
        finally
        {
            content.Seek(0, SeekOrigin.Begin);
        }
    }

    /// <summary>SEC-05. Quét virus trước khi lưu. Bị chặn thì không để lại gì (chưa ghi kho, chưa tạo giấy tờ).</summary>
    private async Task CheckVirusAsync(Stream content, CancellationToken ct)
    {
        if (!scanner.Enabled) return;
        var result = await scanner.ScanAsync(content, ct);
        content.Seek(0, SeekOrigin.Begin);
        if (result.Clean) return;
        if (result.Unavailable)
        {
            if (scanner.FailOpen)
            {
                logger.LogWarning("upload_scan_skipped {Reason}", result.Error);
                return;
            }
            throw new AppException(503, "scanner_unavailable", "Hệ thống chưa quét được tệp để kiểm tra mã độc nên chưa nhận tệp. Thử lại sau ít phút; nếu vẫn lỗi, báo quản trị.");
        }
        logger.LogWarning("upload_blocked_malware {Signature}", result.Signature);
        throw new AppException(422, "file_infected", $"Tệp bị chặn vì phát hiện mã độc ({result.Signature}). Tệp không được lưu. Kiểm tra máy quét hoặc nguồn tệp rồi báo quản trị.");
    }

    // ---- Hộp tiếp nhận ----
    public async Task<IReadOnlyList<InboxItem>> InboxAsync(string? status, CancellationToken ct)
    {
        var me = user.RequireUserId();
        var wanted = status is IntakeStatus.Filed or IntakeStatus.Discarded ? status : IntakeStatus.Inbox;
        var jobs = db.Read<OcrJob>();
        var suggestions = db.Read<AiSuggestion>();
        var rows = await (
            from f in db.Read<FileRecord>()
            join d in db.Read<Document>() on f.DocumentId equals d.Id
            where d.UploadedBy == me && d.IntakeStatus == wanted && f.FileRole == "scan"
            orderby f.UploadedAt descending
            select new
            {
                d.Id, FileId = f.Id, f.OriginalName, f.PageCount, f.UploadedAt, d.IntakeStatus,
                Job = jobs.Where(j => j.FileId == f.Id && j.JobType == "read_classify").OrderByDescending(j => j.CreatedAt)
                    .Select(j => new { j.Id, j.Status, j.Priority, j.CreatedAt, j.ProcessedPages, j.PageCount, j.ErrorMessage }).FirstOrDefault(),
                Suggestion = suggestions.Where(s => s.DocumentId == d.Id).OrderByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id)
                    .Select(s => new { s.Id, s.DocumentForm, s.WorkGroupCode }).FirstOrDefault(),
            }).Take(200).ToListAsync(ct);

        var groupTitles = await db.Read<WorkGroup>().ToDictionaryAsync(g => g.Code, g => g.Title, ct);
        var suggestionIds = rows.Where(r => r.Suggestion is not null).Select(r => r.Suggestion!.Id).ToList();
        var attention = await db.Read<AiFieldSuggestion>().Where(a => suggestionIds.Contains(a.SuggestionId) && (a.Value == "" || !a.QuoteVerified))
            .GroupBy(a => a.SuggestionId).Select(g => new { Id = g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Id, x => x.N, ct);

        var items = new List<InboxItem>();
        foreach (var r in rows)
        {
            var stage = r.Job?.Status switch
            {
                JobStatus.Queued => "queued", JobStatus.Running => "reading", JobStatus.Completed => "ready",
                JobStatus.Failed => "failed", JobStatus.Cancelled => "cancelled", _ => "queued",
            };
            int? position = r.Job is { Status: JobStatus.Queued } q ? await QueuePositionAsync(q.Priority, q.CreatedAt, ct) : null;
            string? progress = r.Job is { Status: JobStatus.Running } run ? $"Đang đọc trang {Math.Min(run.ProcessedPages + 1, run.PageCount ?? run.ProcessedPages + 1)}/{run.PageCount?.ToString() ?? "?"}" : null;
            string? label = r.Suggestion is null ? null
                : r.Suggestion.WorkGroupCode is { } g ? $"{r.Suggestion.DocumentForm} · {g} {groupTitles.GetValueOrDefault(g)}" : r.Suggestion.DocumentForm;
            items.Add(new InboxItem(r.Id, r.FileId, r.OriginalName, r.PageCount ?? r.Job?.PageCount, r.UploadedAt ?? DateTimeOffset.MinValue, stage, position, progress, label,
                r.Suggestion is null ? 0 : attention.GetValueOrDefault(r.Suggestion.Id), r.Job?.Id, r.Job?.ErrorMessage, r.IntakeStatus));
        }
        return items;
    }

    internal async Task<int> QueuePositionAsync(short priority, DateTimeOffset createdAt, CancellationToken ct) =>
        1 + await db.Read<OcrJob>().CountAsync(j => j.Status == JobStatus.Queued && (j.Priority < priority || (j.Priority == priority && j.CreatedAt < createdAt)), ct);

    public async Task DiscardAsync(Guid documentId, CancellationToken ct)
    {
        var doc = await OwnInboxDocumentAsync(documentId, ct);
        if (doc.IntakeStatus != IntakeStatus.Inbox) throw AppException.Conflict("Chỉ bỏ được PDF còn trong hộp tiếp nhận. Gỡ khỏi hồ sơ trước.");
        doc.IntakeStatus = IntakeStatus.Discarded;
        doc.DiscardedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task RestoreAsync(Guid documentId, CancellationToken ct)
    {
        var doc = await OwnInboxDocumentAsync(documentId, ct);
        if (doc.IntakeStatus != IntakeStatus.Discarded) throw AppException.Conflict("Giấy tờ này không ở trạng thái đã bỏ.");
        if (clock.UtcNow - doc.DiscardedAt > UndoWindow)
            throw AppException.Conflict("Đã quá 30 ngày kể từ khi bỏ, không hoàn tác được nữa. Liên hệ văn thư nếu cần khôi phục.");
        doc.IntakeStatus = IntakeStatus.Inbox;
        doc.DiscardedAt = null;
        await db.SaveChangesAsync(ct);
    }

    private async Task<Document> OwnInboxDocumentAsync(Guid id, CancellationToken ct)
    {
        var me = user.RequireUserId();
        return await db.Set<Document>().SingleOrDefaultAsync(d => d.Id == id && d.UploadedBy == me && d.Origin == "internal", ct)
            ?? throw AppException.NotFound("giấy tờ");
    }
}
