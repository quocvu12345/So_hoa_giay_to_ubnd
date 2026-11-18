using System.Text.Json;
using System.Text.Json.Nodes;
using HoSoSo.Application.Common;
using HoSoSo.Application.Intake;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Admin;

/// <summary>
/// Một việc AI trên màn Vận hành. Chỉ có tên tệp, không có tiêu đề hay nội dung giấy tờ: quản trị kỹ thuật không có phạm vi giấy tờ.
/// <c>Attempts</c> là số lần thử THẬT (không tính các lần việc nền nhường chỗ). <c>RetryOf</c>: việc này được tạo khi chạy lại việc nào.
/// </summary>
public sealed record AdminJobRow(Guid Id, Guid FileId, string FileName, string JobType, string Status, string? Stage, int ProcessedPages, int? PageCount,
    int Attempts, string PriorityKind, string? Error, DateTimeOffset CreatedAt, DateTimeOffset? StartedAt, DateTimeOffset? FinishedAt,
    string? RequestedByName, Guid? RetryOf, bool CanCancel, bool CanRetry, string? RetryBlockedReason);

/// <summary>
/// BE-120 (FE-44). Hủy và chạy lại việc AI cho người có <c>processing.manage</c>. Khác <see cref="JobsHandler"/> (lọc theo phạm vi giấy tờ của người đang xem),
/// ở đây không lọc phạm vi: quản trị kỹ thuật theo thiết kế không thấy giấy tờ nào nhưng vẫn phải gỡ được hàng đợi.
/// Chạy lại = tạo việc MỚI (giữ nguyên lịch sử việc lỗi), cùng tệp, cùng loại, cùng tùy chọn, mức tương tác.
/// </summary>
public sealed class AdminJobsHandler(IHoSoDb db, ICurrentUser user, IClock clock)
{
    public static readonly string[] StatusFilters = ["active", JobStatus.Queued, JobStatus.Running, JobStatus.Failed, JobStatus.Cancelled, JobStatus.Completed];

    public async Task<Page<AdminJobRow>> ListAsync(string? status, string? cursor, int limit, CancellationToken ct)
    {
        if (status is not null && !StatusFilters.Contains(status))
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["status"] = [$"Chỉ nhận: {string.Join(", ", StatusFilters)}."] });
        limit = Math.Clamp(limit, 1, 100);
        var query = db.Read<OcrJob>().AsQueryable();
        query = status switch
        {
            null => query,
            "active" => query.Where(j => j.Status == JobStatus.Queued || j.Status == JobStatus.Running),
            _ => query.Where(j => j.Status == status),
        };
        if (Cursor.Decode(cursor) is { } after)
            query = query.Where(j => j.CreatedAt < after.At || (j.CreatedAt == after.At && j.Id.CompareTo(after.Id) < 0));
        var ids = await query.OrderByDescending(j => j.CreatedAt).ThenByDescending(j => j.Id).Select(j => j.Id).Take(limit + 1).ToListAsync(ct);
        var rows = await RowsAsync(ids.Take(limit).ToList(), ct);
        var next = ids.Count > limit ? Cursor.Encode(rows[^1].CreatedAt, rows[^1].Id) : null;
        return new Page<AdminJobRow>(rows, next);
    }

    /// <summary>Hủy việc đang chờ hoặc đang chạy (worker dừng sau trang hiện tại). Một câu lệnh có điều kiện: worker vừa xong thì không hủy đè kết quả.</summary>
    public async Task<AdminJobRow> CancelAsync(Guid id, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var changed = await db.Set<OcrJob>().Where(j => j.Id == id && (j.Status == JobStatus.Queued || j.Status == JobStatus.Running))
            .ExecuteUpdateAsync(s => s
                .SetProperty(j => j.Status, JobStatus.Cancelled)
                .SetProperty(j => j.StartedAt, j => j.StartedAt ?? now)
                .SetProperty(j => j.FinishedAt, now), ct);
        if (changed == 0)
        {
            if (!await db.Read<OcrJob>().AnyAsync(j => j.Id == id, ct)) throw AppException.NotFound("việc AI");
            throw AppException.Conflict("Việc này đã kết thúc nên không hủy được.");
        }
        return (await RowsAsync([id], ct)).Single();
    }

    /// <summary>
    /// Chạy lại việc đã lỗi hoặc đã hủy. 409 khi: tệp đã bị hủy nội dung; tệp đang có việc khác chờ/chạy; đã có lần đọc cùng loại mới hơn
    /// (chạy lại việc cũ sẽ ghi đè kết quả mới). Việc đọc lại trang và phân loại lại giữ <c>target_job_id</c> nên vẫn ghi vào lần đọc gốc.
    /// </summary>
    public async Task<AdminJobRow> RetryAsync(Guid id, CancellationToken ct)
    {
        var me = user.RequireUserId();
        var target = await (from j in db.Read<OcrJob>()
                            join f in db.Read<FileRecord>() on j.FileId equals f.Id
                            where j.Id == id
                            select new { j.FileId, f.DocumentId }).SingleOrDefaultAsync(ct) ?? throw AppException.NotFound("việc AI");

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // Cùng thứ tự khóa với "Trích xuất ngay" (AiExtractHandler): giấy tờ rồi tệp, nên hai bên không tạo việc trùng.
        await MutationLocks.DocumentAsync(db, target.DocumentId, ct);
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({target.FileId.ToString()}, 0))", ct);
        var original = await db.Read<OcrJob>().SingleAsync(j => j.Id == id, ct);
        if (await RetryBlockedAsync(original, ct) is { } reason) throw AppException.Conflict(reason);

        var options = JsonNode.Parse(original.Options) as JsonObject ?? new JsonObject();
        options["correlation_id"] = user.CorrelationId;
        options["retry_of"] = original.Id.ToString();
        var job = new OcrJob
        {
            FileId = original.FileId, JobType = original.JobType, Priority = QueuePriority.Interactive, RequestedBy = me,
            Options = options.ToJsonString(),
        };
        db.Set<OcrJob>().Add(job);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return (await RowsAsync([job.Id], ct)).Single();
    }

    private async Task<string?> RetryBlockedAsync(OcrJob job, CancellationToken ct)
    {
        if (job.Status is not (JobStatus.Failed or JobStatus.Cancelled)) return "Chỉ chạy lại được việc đã lỗi hoặc đã hủy.";
        if (!await db.Read<FileRecord>().AnyAsync(f => f.Id == job.FileId && f.DisposedAt == null && f.StorageKey != null, ct))
            return "Nội dung tệp đã bị hủy nên không đọc lại được.";
        if (await db.Read<OcrJob>().AnyAsync(j => j.FileId == job.FileId && (j.Status == JobStatus.Queued || j.Status == JobStatus.Running), ct))
            return "Tệp này đang có việc đọc khác chờ hoặc đang chạy.";
        if (await db.Read<OcrJob>().AnyAsync(j => j.FileId == job.FileId && j.JobType == job.JobType && j.Id != job.Id && j.CreatedAt > job.CreatedAt, ct))
            return "Tệp này đã có lần đọc mới hơn; chạy lại việc cũ sẽ ghi đè kết quả mới.";
        return null;
    }

    private async Task<List<AdminJobRow>> RowsAsync(IReadOnlyList<Guid> ids, CancellationToken ct)
    {
        if (ids.Count == 0) return [];
        var jobs = db.Read<OcrJob>();
        var raw = await (from j in jobs
                         join f in db.Read<FileRecord>() on j.FileId equals f.Id
                         join u in db.Read<User>() on j.RequestedBy equals (Guid?)u.Id into requesters
                         from u in requesters.DefaultIfEmpty()
                         where ids.Contains(j.Id)
                         select new
                         {
                             Job = j, f.OriginalName, Usable = f.DisposedAt == null && f.StorageKey != null, Requester = u == null ? null : u.DisplayName,
                             FileBusy = jobs.Any(o => o.FileId == j.FileId && (o.Status == JobStatus.Queued || o.Status == JobStatus.Running)),
                             Newer = jobs.Any(o => o.FileId == j.FileId && o.JobType == j.JobType && o.Id != j.Id && o.CreatedAt > j.CreatedAt),
                         }).ToListAsync(ct);
        var order = ids.Select((id, i) => (id, i)).ToDictionary(x => x.id, x => x.i);
        return raw.OrderBy(r => order[r.Job.Id]).Select(r =>
        {
            var j = r.Job;
            var finished = j.Status is JobStatus.Failed or JobStatus.Cancelled;
            string? blocked = !finished ? null
                : !r.Usable ? "Nội dung tệp đã bị hủy nên không đọc lại được."
                : r.FileBusy ? "Tệp này đang có việc đọc khác chờ hoặc đang chạy."
                : r.Newer ? "Tệp này đã có lần đọc mới hơn; chạy lại việc cũ sẽ ghi đè kết quả mới."
                : null;
            return new AdminJobRow(j.Id, j.FileId, r.OriginalName, j.JobType, j.Status, j.Stage, j.ProcessedPages, j.PageCount,
                Math.Max(0, j.Attempt - j.PreemptedCount), QueuePriority.KindOf(j.Priority), j.ErrorMessage, j.CreatedAt, j.StartedAt, j.FinishedAt,
                r.Requester, RetryOf(j.Options), j.Status is JobStatus.Queued or JobStatus.Running, finished && blocked is null, blocked);
        }).ToList();
    }

    private static Guid? RetryOf(string options)
    {
        try
        {
            using var json = JsonDocument.Parse(options);
            return json.RootElement.TryGetProperty("retry_of", out var value) && Guid.TryParse(value.GetString(), out var id) ? id : null;
        }
        catch (JsonException) { return null; }
        catch (InvalidOperationException) { return null; }
    }
}
