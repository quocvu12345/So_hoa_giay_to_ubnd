using System.Text.Json;
using HoSoSo.Application.Common;
using HoSoSo.Domain.Entities;
using HoSoSo.Domain.Identity;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Intake;

/// <summary>BE-44. Xem tiến độ, hủy và đọc lại một trang. Worker AI lấy việc trực tiếp từ bảng ocr_jobs (ADR-04).</summary>
public sealed class JobsHandler(IHoSoDb db, IScopeFilter scope, ICurrentUser user, IClock clock, AiQueueEstimator queue)
{
    public async Task<JobDto> GetAsync(Guid id, CancellationToken ct)
    {
        var job = await VisibleJobAsync(id, ct);
        var file = await db.Read<FileRecord>().Where(f => f.Id == job.FileId).Select(f => new { f.DocumentId, f.PageCount }).SingleAsync(ct);
        int? position = null, eta = null;
        if (job.Status is JobStatus.Queued or JobStatus.Running)
        {
            var model = await queue.LoadAsync(ct);
            var pagesLeft = Math.Max(1, (job.PageCount ?? file.PageCount ?? 1) - job.ProcessedPages);
            if (job.Status == JobStatus.Queued)
            {
                position = model.Position(job.Priority, job.PrioritizedAt ?? job.CreatedAt);
                eta = model.EtaSeconds(job.Priority, job.PrioritizedAt ?? job.CreatedAt, pagesLeft);
            }
            else eta = model.RemainingSeconds(pagesLeft);
        }
        return ToDto(job, file.DocumentId, position, eta);
    }

    public async Task<JobDto> CancelAsync(Guid id, CancellationToken ct)
    {
        var job = await VisibleJobAsync(id, ct);
        var me = user.RequireUserId();
        if (job.RequestedBy != me && !user.Has(Permissions.ProcessingManage))
            throw new AppException(403, ErrorCodes.Forbidden, "Chỉ người tải PDF lên hoặc quản trị hàng đợi mới hủy được việc này.");
        // Một câu lệnh có điều kiện: nếu worker vừa xong thì không hủy đè lên kết quả.
        var now = clock.UtcNow;
        var changed = await db.Set<OcrJob>().Where(j => j.Id == id && (j.Status == JobStatus.Queued || j.Status == JobStatus.Running))
            .ExecuteUpdateAsync(s => s
                .SetProperty(j => j.Status, JobStatus.Cancelled)
                .SetProperty(j => j.StartedAt, j => j.StartedAt ?? now)
                .SetProperty(j => j.FinishedAt, now), ct);
        if (changed == 0) throw AppException.Conflict("Việc đọc này đã kết thúc nên không hủy được.");
        return await GetAsync(id, ct);
    }

    /// <summary>Đọc lại một trang: tạo job reread_page ghi đè kết quả trang đó vào job gốc.</summary>
    public async Task<JobDto> RetryPageAsync(Guid id, int page, CancellationToken ct)
    {
        var original = await VisibleJobAsync(id, ct);
        var documentId = await db.Read<FileRecord>().Where(f => f.Id == original.FileId).Select(f => f.DocumentId).SingleAsync(ct);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await MutationLocks.DocumentAsync(db, documentId, ct);
        if (!await db.Read<FileRecord>().AnyAsync(f => f.Id == original.FileId && f.DisposedAt == null && f.StorageKey != null, ct))
            throw AppException.Conflict("Nội dung tệp đã bị hủy nên không đọc lại được.");
        original = await VisibleJobAsync(id, ct);
        if (original.Status is JobStatus.Queued or JobStatus.Running) throw AppException.Conflict("Việc đọc đang chạy, chờ xong rồi đọc lại trang.");
        if (page < 1 || page > (original.PageCount ?? int.MaxValue))
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["page"] = ["Số trang không nằm trong tệp."] });
        var job = new OcrJob
        {
            FileId = original.FileId, JobType = "reread_page", Priority = QueuePriority.Interactive, RequestedBy = user.RequireUserId(),
            Options = JsonSerializer.Serialize(new { correlation_id = user.CorrelationId, pages = new[] { page }, target_job_id = original.Id, classify = false }),
        };
        db.Set<OcrJob>().Add(job);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return await GetAsync(job.Id, ct);
    }

    private async Task<OcrJob> VisibleJobAsync(Guid id, CancellationToken ct)
    {
        var visibleDocuments = scope.Documents(db.Read<Document>());
        var job = await (from j in db.Set<OcrJob>()
                         join f in db.Read<FileRecord>() on j.FileId equals f.Id
                         join d in visibleDocuments on f.DocumentId equals d.Id
                         where j.Id == id select j).AsNoTracking().SingleOrDefaultAsync(ct);
        return job ?? throw AppException.NotFound("việc đọc");
    }

    private static JobDto ToDto(OcrJob j, Guid documentId, int? position, int? eta = null) => new(
        j.Id, documentId, j.FileId, j.JobType, j.Status, j.Stage, j.ProcessedPages, j.PageCount, j.Attempt, position, j.ErrorMessage,
        JsonSerializer.Deserialize<List<string>>(j.Warnings) ?? [], j.CreatedAt, j.StartedAt, j.FinishedAt, QueuePriority.KindOf(j.Priority), eta);
}
