using System.Text.Json;
using HoSoSo.Application.Common;
using HoSoSo.Application.Documents;
using FluentValidation;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HoSoSo.Application.Intake;

/// <summary>BE-40, BE-41, BE-42: lô quét, tải PDF lên (chống trùng), hộp tiếp nhận.</summary>
public sealed class IntakeHandler(IHoSoDb db, IScopeFilter scope, ICurrentUser user, IClock clock, IFileStorage storage, IVirusScanner scanner, IPdfTools pdf, ILogger<IntakeHandler> logger,
    IOptions<AiQueueOptions> aiQueue, AiQueueEstimator queue)
{
    public const int InteractivePriority = QueuePriority.Interactive;
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
        return await BatchesQuery(batch.Id).SingleAsync(ct);
    }

    public async Task<IReadOnlyList<BatchSummary>> ListBatchesAsync(CancellationToken ct) => await BatchesQuery().ToListAsync(ct);

    private IQueryable<BatchSummary> BatchesQuery(Guid? id = null)
    {
        var organization = user.OrganizationCode;
        var files = DocumentFiles.CurrentScans(db.Read<FileRecord>());     // BE-126: bản đã bị thay không tính thêm một tệp
        var issues = db.Read<QualityIssue>();
        return db.Read<ScanBatch>().Where(b => b.OrganizationCode == organization && (id == null || b.Id == id))
            .OrderByDescending(b => b.OpenedAt)
            .Select(b => new BatchSummary(b.Id, b.Code, b.OrganizationCode, b.DepartmentCode, b.BoxLabel, b.HandedOverBy, b.ExpectedSheetCount,
                b.ScannedPageCount, files.Count(f => f.ScanBatchId == b.Id), b.Status, b.OpenedAt, b.ClosedAt,
                issues.Count(i => i.ScanBatchId == b.Id && i.Status == "open")));
    }

    public async Task<BatchDetail> GetBatchAsync(Guid id, CancellationToken ct)
    {
        var summary = await BatchesQuery(id).SingleOrDefaultAsync(ct) ?? throw AppException.NotFound("lô quét");
        var jobs = db.Read<OcrJob>();
        var files = await DocumentFiles.CurrentScans(db.Read<FileRecord>()).Where(f => f.ScanBatchId == id).OrderBy(f => f.UploadedAt)
            .Select(f => new BatchFile(f.DocumentId, f.Id, f.OriginalName, f.PageCount,
                jobs.Where(j => j.FileId == f.Id && j.JobType == "read_classify").OrderByDescending(j => j.CreatedAt).Select(j => j.Status).FirstOrDefault(),
                f.UploadedAt)).ToListAsync(ct);
        return new BatchDetail(summary, files);
    }

    /// <summary>
    /// Đóng lô. Còn lỗi ảnh đang mở: không có <c>AcceptOpenIssuesNote</c> thì 409 kèm số lỗi (giao diện cảnh báo);
    /// có lý do (từ 10 ký tự) thì BE-125: mọi lỗi đang mở của lô chuyển "chấp nhận bỏ qua" (wont_fix) kèm lý do và lô đóng, cùng một giao dịch.
    /// </summary>
    public async Task<BatchSummary> CloseBatchAsync(Guid id, CloseBatchRequest? request, CancellationToken ct)
    {
        var note = request?.AcceptOpenIssuesNote?.Trim();
        if (note is not null && note.Length < 10)
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["acceptOpenIssuesNote"] = ["Chấp nhận bỏ qua lỗi cần ghi lý do từ 10 ký tự."] });
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // Khóa dòng lô: hai người cùng đóng, hoặc vừa có người mở lỗi mới, thì xử lý tuần tự.
        await db.Database.SqlQuery<Guid>($"SELECT id AS \"Value\" FROM hoso.scan_batches WHERE id = {id} FOR UPDATE").ToListAsync(ct);
        var batch = await db.Set<ScanBatch>().SingleOrDefaultAsync(b => b.Id == id && b.OrganizationCode == user.OrganizationCode, ct)
            ?? throw AppException.NotFound("lô quét");
        if (batch.Status == "closed") throw AppException.Conflict("Lô quét này đã đóng.");
        var open = await db.Set<QualityIssue>().Where(i => i.ScanBatchId == id && i.Status == "open").ToListAsync(ct);
        if (open.Count > 0 && note is null)
            throw AppException.Conflict($"Còn {open.Count} lỗi ảnh chưa xử lý. Quét lại, hoặc ghi lý do chấp nhận bỏ qua để vẫn đóng lô.");
        var now = clock.UtcNow;
        var me = user.RequireUserId();
        foreach (var issue in open)
        {
            issue.Status = "wont_fix";
            issue.ResolvedBy = me;
            issue.ResolvedAt = now;
            issue.Description = $"{issue.Description}{(issue.Description.Length > 0 ? " · " : "")}Chấp nhận khi đóng lô: {note}";
        }
        batch.ScannedPageCount = await DocumentFiles.CurrentScans(db.Read<FileRecord>()).Where(f => f.ScanBatchId == id).SumAsync(f => f.PageCount ?? 0, ct);
        batch.Status = "closed";
        batch.ClosedAt = now;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return await BatchesQuery(id).SingleAsync(ct);
    }

    // ---- Tải PDF lên ----
    /// <summary>
    /// Kiểm tra đúng là PDF (đầu tệp %PDF-), lưu theo SHA-256, chống trùng, tạo giấy tờ ở hộp tiếp nhận và xếp job đọc vào hàng đợi.
    /// Trùng PDF đã nạp: 409 duplicate_file kèm giấy tờ cũ, không tạo gì thêm.
    /// </summary>
    public async Task<UploadResult> UploadAsync(Stream content, string fileName, Guid? batchId, CancellationToken ct)
    {
        var me = user.RequireUserId();
        var name = await CheckPdfAsync(content, fileName, ct);
        var pageCount = await CheckPageLimitAsync(content, ct);
        await CheckVirusAsync(content, ct);

        ScanBatch? batch = null;
        if (batchId is { } bid)
        {
            batch = await db.Set<ScanBatch>().SingleOrDefaultAsync(b => b.Id == bid && b.OrganizationCode == user.OrganizationCode, ct) ?? throw AppException.NotFound("lô quét");
            if (batch.Status == "closed") throw AppException.Conflict("Lô quét đã đóng, không thêm tệp được.");
        }

        var stored = await storage.SaveAsync(content, ct);
        await RejectDuplicateAsync(stored.Sha256, null, ct);

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
            // PDF mới tải lên vào khay nền: máy AI xử lý khi rảnh; ai cần ngay thì bấm "Trích xuất ngay" (BE-98) để nâng mức.
            FileId = file.Id, Priority = (short)aiQueue.Value.BackgroundPriority, RequestedBy = me,
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

    /// <summary>
    /// BE-126. Tải bản quét thay thế cho giấy tờ (quét lại trang mờ, thiếu trang…). Bản cũ giữ nguyên (vẫn mở, tải được; trường đã đối chiếu vẫn trỏ vùng trên bản cũ).
    /// Cùng luật sửa với dữ liệu giấy tờ (không phải văn bản công khai, không bị bỏ/tách, hồ sơ chứa nó còn ở bước nháp hoặc bị trả lại); lý do bắt buộc.
    /// Bản mới: phiên bản kế tiếp, xếp việc đọc mức tương tác. AI chỉ phân loại/trích lại khi giấy tờ còn ở hộp tiếp nhận; đã vào hồ sơ thì chỉ OCR để tìm kiếm.
    /// Kèm theo: hủy việc đọc còn chờ của bản cũ, đóng lỗi ảnh đang mở của bản cũ ("đã thay"), giấy tờ đã xác nhận dữ liệu thì về "chờ xác nhận lại".
    /// </summary>
    public async Task<ReplacementResult> ReplaceScanAsync(Guid documentId, Stream content, string fileName, string? reason, CancellationToken ct)
    {
        var me = user.RequireUserId();
        var why = reason?.Trim() ?? "";
        if (why.Length is < 10 or > 500)
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["reason"] = ["Ghi lý do thay bản quét (10–500 ký tự), ví dụ \"Quét lại trang 3 bị mờ\"."] });
        var name = await CheckPdfAsync(content, fileName, ct);
        var visible = await scope.Documents(db.Read<Document>()).Where(d => d.Id == documentId).Select(d => new { d.Origin, d.IntakeStatus }).SingleOrDefaultAsync(ct)
            ?? throw AppException.NotFound("giấy tờ");
        if (await DocumentEditRules.LockReasonAsync(db, documentId, visible.Origin, visible.IntakeStatus, ct) is { } early) throw AppException.Conflict(early);
        var pageCount = await CheckPageLimitAsync(content, ct);
        await CheckVirusAsync(content, ct);
        var stored = await storage.SaveAsync(content, ct);
        await RejectDuplicateAsync(stored.Sha256, documentId, ct);

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // Cùng khóa với sửa dữ liệu giấy tờ: trình hồ sơ chạy song song thì một bên chờ bên kia, không thay bản quét của hồ sơ vừa trình.
        await MutationLocks.DocumentAndDossiersAsync(db, documentId, ct);
        var document = await db.Set<Document>().SingleAsync(d => d.Id == documentId, ct);
        if (await DocumentEditRules.LockReasonAsync(db, documentId, document.Origin, document.IntakeStatus, ct) is { } locked) throw AppException.Conflict(locked);
        var current = await DocumentFiles.CurrentScans(db.Read<FileRecord>()).Where(f => f.DocumentId == documentId).OrderByDescending(f => f.VersionNo)
            .Select(f => new { f.Id, f.ComponentKey, f.DisposedAt, f.StorageKey, f.ScanBatchId }).FirstOrDefaultAsync(ct)
            ?? throw AppException.Conflict("Giấy tờ chưa có bản quét nên không có gì để thay. Tải PDF mới ở Tiếp nhận.");
        if (current.DisposedAt is not null || current.StorageKey is null) throw AppException.Conflict("Nội dung giấy tờ đã bị hủy nên không thay bản quét được.");

        var now = clock.UtcNow;
        var versionNo = await db.Read<FileRecord>().Where(f => f.DocumentId == documentId && f.ComponentKey == current.ComponentKey).MaxAsync(f => f.VersionNo, ct) + 1;
        var file = new FileRecord
        {
            DocumentId = documentId, ComponentKey = current.ComponentKey, VersionNo = versionNo, FileRole = DocumentFiles.Scan, OriginalName = name,
            MediaType = "application/pdf", ByteSize = stored.ByteSize, Sha256 = stored.Sha256, StorageKey = stored.StorageKey, PageCount = pageCount,
            UploadedBy = me, UploadedAt = now, ReplacesFileId = current.Id, ReplacementReason = why,
            ScanBatchId = current.ScanBatchId,       // cùng lô quét: lô chỉ đếm bản hiện hành nên số tệp không đổi
        };
        db.Set<FileRecord>().Add(file);
        await db.SaveChangesAsync(ct);

        var classify = document.IntakeStatus == IntakeStatus.Inbox;
        var job = new OcrJob
        {
            FileId = file.Id, Priority = QueuePriority.Interactive, RequestedBy = me, PageCount = pageCount,
            Options = JsonSerializer.Serialize(new { correlation_id = user.CorrelationId, classify, replaces_file_id = current.Id }),
        };
        db.Set<OcrJob>().Add(job);
        // Đọc bản đã bị thay là phí máy AI: hủy việc còn chờ hoặc đang chạy của nó (worker dừng sau trang hiện tại).
        var cancelledJobs = await db.Set<OcrJob>().Where(j => j.FileId == current.Id && (j.Status == JobStatus.Queued || j.Status == JobStatus.Running))
            .ExecuteUpdateAsync(u => u.SetProperty(j => j.Status, JobStatus.Cancelled).SetProperty(j => j.StartedAt, j => j.StartedAt ?? now).SetProperty(j => j.FinishedAt, now), ct);
        var openIssues = await db.Set<QualityIssue>().Where(i => i.FileId == current.Id && i.Status == "open").ToListAsync(ct);
        foreach (var issue in openIssues)
        {
            issue.Status = "fixed";
            issue.ResolvedBy = me;
            issue.ResolvedAt = now;
            issue.Description = $"{issue.Description}{(issue.Description.Length > 0 ? " · " : "")}Đã thay bằng bản quét phiên bản {versionNo}: {why}";
        }
        await db.Set<PageImage>().Where(p => p.FileId == current.Id && (p.QualityStatus == "suspect" || p.QualityStatus == "rescan_required"))
            .ExecuteUpdateAsync(u => u.SetProperty(p => p.QualityStatus, "rescanned"), ct);
        // Lô đã đóng đã ghi số trang tại lúc đóng: cập nhật theo bản hiện hành để biên bản lô không lệch.
        if (current.ScanBatchId is { } batchId)
            await db.Set<ScanBatch>().Where(b => b.Id == batchId && b.Status == "closed")
                .ExecuteUpdateAsync(u => u.SetProperty(b => b.ScannedPageCount, db.Set<FileRecord>().Where(f => f.ScanBatchId == batchId && f.FileRole == DocumentFiles.Scan
                    && !db.Set<FileRecord>().Any(n => n.ReplacesFileId == f.Id)).Sum(f => f.PageCount ?? 0)), ct);
        var reviewReset = document.DataReviewStatus == "verified";
        if (reviewReset) { document.DataReviewStatus = "pending"; document.ReviewedBy = null; document.ReviewedAt = null; }
        document.UpdatedAt = now;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        logger.LogInformation("file_replaced {DocumentId} {OldFileId} {NewFileId} {VersionNo} {Classify} {CancelledJobs} {IssuesClosed}",
            documentId, current.Id, file.Id, versionNo, classify, cancelledJobs, openIssues.Count);
        return new ReplacementResult(documentId, file.Id, current.Id, versionNo, job.Id, name, stored.ByteSize, pageCount, classify, openIssues.Count, reviewReset);
    }

    /// <summary>Tên đuôi .pdf, đầu tệp "%PDF-". Trả tên tệp đã bỏ đường dẫn.</summary>
    private static async Task<string> CheckPdfAsync(Stream content, string? fileName, CancellationToken ct)
    {
        var name = Path.GetFileName(fileName ?? "").Trim();
        if (name.Length == 0 || name.Length > 255 || !name.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["file"] = ["Chỉ nhận tệp PDF (đuôi .pdf, tên tối đa 255 ký tự)."] });
        if (!content.CanSeek) throw new ArgumentException("Luồng tệp phải tua lại được.", nameof(content));
        var header = new byte[5];
        var read = await content.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, ct);
        content.Seek(0, SeekOrigin.Begin);
        if (read < 5 || !header.AsSpan().SequenceEqual("%PDF-"u8))
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["file"] = ["Tệp không phải PDF hợp lệ. Xuất lại tệp từ máy quét hoặc phần mềm tạo PDF."] });
        return name;
    }

    /// <summary>
    /// Bản quét trùng SHA-256 với một bản đã có: 409 duplicate_file. BE-92: chỉ chỉ đường tới giấy tờ cũ khi người tải THẤY được nó; giấy tờ ngoài phạm vi
    /// (hộp tiếp nhận riêng, hồ sơ đơn vị khác) không được lộ mã, tên tệp gốc (có thể chứa tên người, số định danh) hay giờ tải.
    /// </summary>
    private async Task RejectDuplicateAsync(string sha256, Guid? replacingDocument, CancellationToken ct)
    {
        var duplicate = await db.Read<FileRecord>().Where(f => f.FileRole == DocumentFiles.Scan && f.Sha256 == sha256)
            .Select(f => new { f.DocumentId, f.Id, f.OriginalName, f.UploadedAt }).FirstOrDefaultAsync(ct);
        if (duplicate is null) return;
        if (duplicate.DocumentId == replacingDocument)
            throw new AppException(409, ErrorCodes.DuplicateFile, "Bản này giống hệt một bản quét đã có của giấy tờ, không cần thay.",
                new { documentId = duplicate.DocumentId, fileId = duplicate.Id, fileName = duplicate.OriginalName, uploadedAt = duplicate.UploadedAt });
        if (await scope.Documents(db.Read<Document>()).AnyAsync(d => d.Id == duplicate.DocumentId, ct))
        {
            throw new AppException(409, ErrorCodes.DuplicateFile, "PDF này đã được tải lên trước đó. Mở giấy tờ cũ thay vì tải lại.",
                new { documentId = duplicate.DocumentId, fileId = duplicate.Id, fileName = duplicate.OriginalName, uploadedAt = duplicate.UploadedAt });
        }
        logger.LogWarning("duplicate_outside_scope");
        throw new AppException(409, ErrorCodes.DuplicateFile, "Tệp này đã có trong hệ thống ở nơi bạn không có quyền xem nên không tải lại được. Liên hệ văn thư hoặc quản trị để được hướng dẫn.");
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
    private static readonly string[] ReadStages = ["queued", "reading", "ready", "failed", "cancelled"];

    private sealed class InboxSource
    {
        public required FileRecord F { get; init; }
        public required Document D { get; init; }
        public DateTimeOffset At { get; init; }
    }

    /// <summary>Hộp tiếp nhận của người đang dùng: một dòng mỗi giấy tờ (bản quét hiện hành, BE-126), có thể lọc theo lô, nhóm, loại (BE-129).</summary>
    private IQueryable<InboxSource> InboxSourceFor(string wanted, InboxFilter filter)
    {
        var me = user.RequireUserId();
        var suggestions = db.Read<AiSuggestion>();
        var source = from f in DocumentFiles.CurrentScans(db.Read<FileRecord>())
                     join d in db.Read<Document>() on f.DocumentId equals d.Id
                     where d.UploadedBy == me && d.IntakeStatus == wanted
                     select new InboxSource { F = f, D = d, At = f.UploadedAt ?? d.CreatedAt };
        if (filter.Batch is { } batch) source = source.Where(x => x.F.ScanBatchId == batch);
        // Nhóm và loại theo gợi ý AI MỚI NHẤT của giấy tờ (cùng cách chọn gợi ý với dòng hiển thị).
        if (!string.IsNullOrWhiteSpace(filter.Group))
        {
            var group = filter.Group.Trim();
            source = source.Where(x => suggestions.Where(s => s.DocumentId == x.D.Id).OrderByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id)
                .Select(s => s.WorkGroupCode).FirstOrDefault() == group);
        }
        if (!string.IsNullOrWhiteSpace(filter.Type))
        {
            var type = filter.Type.Trim();
            source = source.Where(x => suggestions.Where(s => s.DocumentId == x.D.Id).OrderByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id)
                .Select(s => s.DocumentTypeCode).FirstOrDefault() == type);
        }
        return source;
    }

    /// <summary>Tình trạng đọc của giấy tờ = trạng thái việc đọc mới nhất, cùng cách đặt tên với <see cref="InboxItem.Stage"/>; chưa có việc thì coi là đang chờ.</summary>
    private static string StageOf(string? jobStatus) => jobStatus switch
    {
        JobStatus.Running => "reading", JobStatus.Completed => "ready", JobStatus.Failed => "failed", JobStatus.Cancelled => "cancelled", _ => "queued",
    };

    private static HashSet<string> ParseReadFilter(string? read)
    {
        if (string.IsNullOrWhiteSpace(read)) return [];
        var wanted = read.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Select(r => r.ToLowerInvariant()).ToHashSet();
        var unknown = wanted.Where(w => !ReadStages.Contains(w)).ToList();
        if (unknown.Count > 0)
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["read"] = [$"Tình trạng đọc không hợp lệ: {string.Join(", ", unknown)}. Dùng {string.Join(" | ", ReadStages)}."] });
        return wanted;
    }

    public async Task<Page<InboxItem>> InboxAsync(string? status, string? cursor, int limit, InboxFilter? filter, CancellationToken ct)
    {
        filter ??= new InboxFilter();
        var wanted = status is IntakeStatus.Filed or IntakeStatus.Discarded ? status : IntakeStatus.Inbox;
        var jobs = db.Read<OcrJob>();
        var suggestions = db.Read<AiSuggestion>();
        limit = Math.Clamp(limit, 1, 200);
        var after = Cursor.Decode(cursor);
        var source = InboxSourceFor(wanted, filter);
        var readWanted = ParseReadFilter(filter.Read);
        if (readWanted.Count > 0)
        {
            // Lọc theo việc đọc mới nhất TRƯỚC khi phân trang, nên trang sau không lặp và không thiếu.
            var statuses = readWanted.SelectMany(r => r switch
            {
                "queued" => new[] { JobStatus.Queued }, "reading" => [JobStatus.Running], "ready" => [JobStatus.Completed],
                "failed" => [JobStatus.Failed], _ => [JobStatus.Cancelled],
            }).ToList();
            var includeNoJob = readWanted.Contains("queued");
            source = source.Where(x => statuses.Contains(jobs.Where(j => j.FileId == x.F.Id && j.JobType == "read_classify").OrderByDescending(j => j.CreatedAt).Select(j => j.Status).FirstOrDefault()!)
                || (includeNoJob && !jobs.Any(j => j.FileId == x.F.Id && j.JobType == "read_classify")));
        }
        if (after is { } key)
            source = source.Where(x => x.At < key.At || (x.At == key.At && x.F.Id.CompareTo(key.Id) < 0));
        var rows = await (
            from x in source
            let f = x.F
            let d = x.D
            orderby x.At descending, f.Id descending
            select new
            {
                d.Id, FileId = f.Id, f.OriginalName, f.PageCount, UploadedAt = x.At, d.IntakeStatus,
                Job = jobs.Where(j => j.FileId == f.Id && j.JobType == "read_classify").OrderByDescending(j => j.CreatedAt)
                    .Select(j => new { j.Id, j.Status, j.Priority, j.CreatedAt, j.PrioritizedAt, j.ProcessedPages, j.PageCount, j.ErrorMessage }).FirstOrDefault(),
                Suggestion = suggestions.Where(s => s.DocumentId == d.Id).OrderByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id)
                    .Select(s => new { s.Id, s.DocumentForm, s.WorkGroupCode }).FirstOrDefault(),
            }).Take(limit + 1).ToListAsync(ct);

        var next = rows.Count > limit ? Cursor.Encode(rows[limit - 1].UploadedAt, rows[limit - 1].FileId) : null;
        if (rows.Count > limit) rows.RemoveAt(limit);
        var groupTitles = await db.Read<WorkGroup>().ToDictionaryAsync(g => g.Code, g => g.Title, ct);
        var suggestionIds = rows.Where(r => r.Suggestion is not null).Select(r => r.Suggestion!.Id).ToList();
        var attention = await db.Read<AiFieldSuggestion>().Where(a => suggestionIds.Contains(a.SuggestionId) && (a.Value == "" || !a.QuoteVerified))
            .GroupBy(a => a.SuggestionId).Select(g => new { Id = g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Id, x => x.N, ct);

        var queueModel = rows.Any(r => r.Job is { Status: JobStatus.Queued or JobStatus.Running }) ? await queue.LoadAsync(ct) : null;
        var items = new List<InboxItem>();
        foreach (var r in rows)
        {
            var stage = r.Job?.Status switch
            {
                JobStatus.Queued => "queued", JobStatus.Running => "reading", JobStatus.Completed => "ready",
                JobStatus.Failed => "failed", JobStatus.Cancelled => "cancelled", _ => "queued",
            };
            var pagesLeft = r.Job is null ? 1 : Math.Max(1, (r.Job.PageCount ?? r.PageCount ?? 1) - r.Job.ProcessedPages);
            int? position = queueModel is not null && r.Job is { Status: JobStatus.Queued } q ? queueModel.Position(q.Priority, q.PrioritizedAt ?? q.CreatedAt) : null;
            int? eta = queueModel is null || r.Job is null ? null
                : r.Job.Status == JobStatus.Queued ? queueModel.EtaSeconds(r.Job.Priority, r.Job.PrioritizedAt ?? r.Job.CreatedAt, pagesLeft)
                : r.Job.Status == JobStatus.Running ? queueModel.RemainingSeconds(pagesLeft) : null;
            string? progress = r.Job is { Status: JobStatus.Running } run ? $"Đang đọc trang {Math.Min(run.ProcessedPages + 1, run.PageCount ?? run.ProcessedPages + 1)}/{run.PageCount?.ToString() ?? "?"}" : null;
            string? label = r.Suggestion is null ? null
                : r.Suggestion.WorkGroupCode is { } g ? $"{r.Suggestion.DocumentForm} · {g} {groupTitles.GetValueOrDefault(g)}" : r.Suggestion.DocumentForm;
            items.Add(new InboxItem(r.Id, r.FileId, r.OriginalName, r.PageCount ?? r.Job?.PageCount, r.UploadedAt, stage, position, progress, label,
                r.Suggestion is null ? 0 : attention.GetValueOrDefault(r.Suggestion.Id), r.Job?.Id, r.Job?.ErrorMessage, r.IntakeStatus,
                r.Job is null ? null : QueuePriority.KindOf(r.Job.Priority), eta));
        }
        return new Page<InboxItem>(items, next);
    }

    /// <summary>BE-129. Số PDF theo tình trạng đọc của một thẻ (cùng lô/nhóm/loại), cho các nút lọc ở hộp tiếp nhận.</summary>
    public async Task<InboxSummary> InboxSummaryAsync(string? status, InboxFilter? filter, CancellationToken ct)
    {
        var wanted = status is IntakeStatus.Filed or IntakeStatus.Discarded ? status : IntakeStatus.Inbox;
        var jobs = db.Read<OcrJob>();
        var latest = await InboxSourceFor(wanted, (filter ?? new InboxFilter()) with { Read = null })
            .Select(x => jobs.Where(j => j.FileId == x.F.Id && j.JobType == "read_classify").OrderByDescending(j => j.CreatedAt).Select(j => j.Status).FirstOrDefault())
            .ToListAsync(ct);
        var counts = latest.GroupBy(StageOf).ToDictionary(g => g.Key, g => g.Count());
        return new InboxSummary(latest.Count, counts.GetValueOrDefault("queued"), counts.GetValueOrDefault("reading"), counts.GetValueOrDefault("ready"),
            counts.GetValueOrDefault("failed"), counts.GetValueOrDefault("cancelled"));
    }

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

/// <summary>FE-41. Giới hạn chữ nhập khi tạo lô (giao diện dùng cùng số: <c>features/intake/batch-rules.ts</c>).</summary>
public sealed class CreateBatchValidator : AbstractValidator<CreateBatchRequest>
{
    public CreateBatchValidator()
    {
        RuleFor(x => x.HandedOverBy).MaximumLength(200).WithMessage("Đơn vị bàn giao tối đa 200 ký tự.");
        RuleFor(x => x.BoxLabel).MaximumLength(100).WithMessage("Nhãn hộp tối đa 100 ký tự.");
        RuleFor(x => x.ExpectedSheetCount).InclusiveBetween(0, 100_000).When(x => x.ExpectedSheetCount is not null).WithMessage("Số tờ dự kiến từ 0 đến 100.000.");
        RuleFor(x => x.Note).MaximumLength(1000).WithMessage("Ghi chú tối đa 1000 ký tự.");
    }
}
