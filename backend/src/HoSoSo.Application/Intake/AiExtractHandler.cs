using System.Text.Json;
using HoSoSo.Application.Common;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HoSoSo.Application.Intake;

/// <summary>Body của "Trích xuất ngay". <c>Force</c>: giấy tờ đã đọc xong vẫn gợi ý lại. <c>DocumentIds</c> (chỉ ở hồ sơ): chọn một phần giấy tờ.</summary>
public sealed record AiExtractRequest(bool Force = false, IReadOnlyList<Guid>? DocumentIds = null);

/// <summary>Outcome: raised (đã nâng lên đầu hàng) | running (đang đọc, không bị nhường chỗ nữa) | alreadyDone | created (tạo việc mới) | skipped.</summary>
public sealed record AiExtractItem(Guid DocumentId, Guid? FileId, Guid? JobId, string Outcome, string? QueueKind, int? QueuePosition, int? EtaSeconds, string? Message);

public sealed record AiExtractResult(IReadOnlyList<AiExtractItem> Items, int Raised, int Running, int AlreadyDone, int Created, int Skipped);

/// <summary>
/// BE-98. "Trích xuất ngay": đưa giấy tờ (hoặc cả hồ sơ) lên đầu hàng đợi AI. Việc đang chờ thì nâng mức 1; đang chạy thì nâng mức để không bị nhường chỗ;
/// đã xong thì giữ kết quả (hoặc gợi ý lại khi <c>force</c>); lỗi, đã hủy hoặc chưa có việc thì tạo việc mới. Gọi nhiều lần không tạo việc trùng.
/// </summary>
public sealed class AiExtractHandler(IHoSoDb db, IScopeFilter scope, ICurrentUser user, IClock clock, AiQueueEstimator estimator,
    IOptions<AiQueueOptions> options, IAccessLog access, ILogger<AiExtractHandler> logger)
{
    private sealed record Outcome(Guid DocumentId, Guid? FileId, Guid? JobId, string Name, string? Message = null);
    private sealed record JobSnapshot(string Status, short Priority, DateTimeOffset At, int Pages);

    public async Task<AiExtractResult> ExtractDossierAsync(Guid dossierId, AiExtractRequest request, CancellationToken ct)
    {
        if (!await scope.Dossiers(db.Read<Dossier>()).AnyAsync(d => d.Id == dossierId, ct)) throw AppException.NotFound("hồ sơ");
        var inDossier = await db.Read<DossierDocument>().Where(l => l.DossierId == dossierId).OrderBy(l => l.Position).Select(l => l.DocumentId).ToListAsync(ct);
        var wanted = inDossier;
        if (request.DocumentIds is { Count: > 0 } ids)
        {
            if (ids.Except(inDossier).Any()) throw Invalid("documentIds", "Có giấy tờ không thuộc hồ sơ này.");
            wanted = ids.Distinct().ToList();
        }
        EnsureWithinLimit(wanted.Count);
        return await RunAsync("dossier", dossierId, wanted, request.Force, ct);
    }

    public async Task<AiExtractResult> ExtractDocumentAsync(Guid documentId, AiExtractRequest request, CancellationToken ct)
    {
        var document = await scope.Documents(db.Read<Document>()).Where(d => d.Id == documentId).Select(d => new { d.IntakeStatus }).SingleOrDefaultAsync(ct)
            ?? throw AppException.NotFound("giấy tờ");
        if (document.IntakeStatus == IntakeStatus.Discarded)
            throw AppException.Conflict("Giấy tờ đã bỏ khỏi hộp tiếp nhận. Hoàn tác trước khi trích xuất.");
        return await RunAsync("document", documentId, [documentId], request.Force, ct);
    }

    private void EnsureWithinLimit(int count)
    {
        var max = options.Value.ExtractMaxDocuments;
        if (count > max) throw Invalid("documentIds", $"Mỗi lần trích xuất tối đa {max} giấy tờ (đang chọn {count}). Chọn bớt giấy tờ.");
    }

    private static ValidationFailedException Invalid(string field, string message) =>
        new(new Dictionary<string, string[]> { [field] = [message] });

    private async Task<AiExtractResult> RunAsync(string scopeKind, Guid scopeId, IReadOnlyList<Guid> documentIds, bool force, CancellationToken ct)
    {
        var me = user.RequireUserId();
        var visible = (await scope.Documents(db.Read<Document>()).Where(d => documentIds.Contains(d.Id)).Select(d => new { d.Id, d.IntakeStatus }).ToListAsync(ct))
            .ToDictionary(d => d.Id);
        var outcomes = new List<Outcome>();
        foreach (var id in documentIds)
        {
            if (!visible.TryGetValue(id, out var document)) outcomes.Add(new Outcome(id, null, null, "skipped", "Giấy tờ nằm ngoài phạm vi của bạn."));
            else if (document.IntakeStatus == IntakeStatus.Discarded) outcomes.Add(new Outcome(id, null, null, "skipped", "Giấy tờ đã bỏ khỏi hộp tiếp nhận."));
            else outcomes.Add(await ExtractOneAsync(id, me, force, ct));
        }

        var jobIds = outcomes.Where(o => o.JobId is not null).Select(o => o.JobId!.Value).Distinct().ToList();
        var jobs = new Dictionary<Guid, JobSnapshot>();
        if (jobIds.Count > 0)
        {
            var rows = await (from j in db.Read<OcrJob>()
                              join f in db.Read<FileRecord>() on j.FileId equals f.Id
                              where jobIds.Contains(j.Id)
                              select new { j.Id, j.Status, j.Priority, At = j.PrioritizedAt ?? j.CreatedAt, Pages = (j.PageCount ?? f.PageCount ?? 1) - j.ProcessedPages })
                .ToListAsync(ct);
            foreach (var row in rows) jobs[row.Id] = new JobSnapshot(row.Status, row.Priority, row.At, Math.Max(1, row.Pages));
        }
        var model = jobs.Values.Any(j => j.Status is JobStatus.Queued or JobStatus.Running) ? await estimator.LoadAsync(ct) : null;

        var items = outcomes.Select(o =>
        {
            if (o.JobId is not { } jobId || !jobs.TryGetValue(jobId, out var job)) return new AiExtractItem(o.DocumentId, o.FileId, o.JobId, o.Name, null, null, null, o.Message);
            var kind = QueuePriority.KindOf(job.Priority);
            return job.Status switch
            {
                JobStatus.Queued when model is not null => new AiExtractItem(o.DocumentId, o.FileId, jobId, o.Name, kind,
                    model.Position(job.Priority, job.At), model.EtaSeconds(job.Priority, job.At, job.Pages), o.Message),
                JobStatus.Running when model is not null => new AiExtractItem(o.DocumentId, o.FileId, jobId, o.Name, kind, null, model.RemainingSeconds(job.Pages), o.Message),
                _ => new AiExtractItem(o.DocumentId, o.FileId, jobId, o.Name, kind, null, null, o.Message),
            };
        }).ToList();

        var result = new AiExtractResult(items, Count(items, "raised"), Count(items, "running"), Count(items, "alreadyDone"), Count(items, "created"), Count(items, "skipped"));
        // Nhật ký truy cập (BE-128): một dòng cho mỗi giấy tờ mà lần bấm này THẬT SỰ làm AI đọc sớm hơn (nâng mức hoặc tạo việc mới). Giấy tờ đang đọc,
        // đã xong, hay bị bỏ qua không có gì thay đổi nên không ghi; gọi lại nhiều lần thì chỉ "raised" lặp lại, mỗi lần một dòng (mỗi lần bấm là một hành động).
        foreach (var item in items.Where(i => i.Outcome is "raised" or "created")) access.Record("ai_extract", "document", item.DocumentId);
        // Nhật ký tác vụ: người và phân công do nhật ký yêu cầu gắn sẵn (userSubject, assignment).
        logger.LogInformation("ai_extract {scope} {scopeId} {documents} {raised} {running} {alreadyDone} {created} {skipped} {force}",
            scopeKind, scopeId, items.Count, result.Raised, result.Running, result.AlreadyDone, result.Created, result.Skipped, force);
        return result;

        static int Count(List<AiExtractItem> list, string outcome) => list.Count(i => i.Outcome == outcome);
    }

    private async Task<Outcome> ExtractOneAsync(Guid documentId, Guid me, bool force, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await MutationLocks.DocumentAsync(db, documentId, ct);
        var file = await db.Read<FileRecord>()
            .Where(f => f.DocumentId == documentId && f.FileRole == "scan" && f.DisposedAt == null && f.StorageKey != null)
            .OrderByDescending(f => f.UploadedAt).ThenByDescending(f => f.VersionNo)
            .Select(f => new { f.Id, f.PageCount }).FirstOrDefaultAsync(ct);
        if (file is null) return new Outcome(documentId, null, null, "skipped", "Giấy tờ chưa có tệp quét để đọc.");

        // Hai người cùng bấm cho một giấy tờ: tuần tự theo tệp, nên không tạo việc trùng.
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({file.Id.ToString()}, 0))", ct);
        Outcome? result = null;
        for (var attempt = 0; result is null; attempt++)
        {
            var jobs = await db.Read<OcrJob>().Where(j => j.FileId == file.Id && (j.JobType == "read_classify" || j.JobType == "reclassify"))
                .OrderByDescending(j => j.CreatedAt).Select(j => new { j.Id, j.JobType, j.Status }).ToListAsync(ct);
            var active = jobs.FirstOrDefault(j => j.Status is JobStatus.Queued or JobStatus.Running);
            var main = jobs.FirstOrDefault(j => j.JobType == "read_classify");

            if (active is not null)
            {
                var now = clock.UtcNow;
                await db.Set<OcrJob>().Where(j => j.Id == active.Id && (j.Status == JobStatus.Queued || j.Status == JobStatus.Running) && j.Priority > QueuePriority.Immediate)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.Priority, QueuePriority.Immediate).SetProperty(j => j.PrioritizedAt, now).SetProperty(j => j.PrioritizedBy, me), ct);
                var status = await db.Read<OcrJob>().Where(j => j.Id == active.Id).Select(j => j.Status).SingleAsync(ct);
                if (status is JobStatus.Queued or JobStatus.Running || attempt >= 2)
                    result = new Outcome(documentId, file.Id, active.Id, status == JobStatus.Running ? "running" : "raised");
                continue;   // vừa kết thúc giữa chừng: đánh giá lại từ đầu
            }
            if (main is { Status: JobStatus.Completed } && !force)
            {
                result = new Outcome(documentId, file.Id, main.Id, "alreadyDone");
                continue;
            }
            var created = NewJob(file.Id, file.PageCount, me, main is { Status: JobStatus.Completed } ? "reclassify" : "read_classify", main?.Id);
            db.Set<OcrJob>().Add(created);
            await db.SaveChangesAsync(ct);
            result = new Outcome(documentId, file.Id, created.Id, "created");
        }
        await transaction.CommitAsync(ct);
        return result!;
    }

    private OcrJob NewJob(Guid fileId, int? pageCount, Guid me, string jobType, Guid? targetJobId)
    {
        var options = new Dictionary<string, object?> { ["correlation_id"] = user.CorrelationId, ["classify"] = true, ["requested_extract"] = true };
        if (jobType == "reclassify") options["target_job_id"] = targetJobId;     // gợi ý lại từ trang của lần đọc cũ, không OCR lại
        return new OcrJob
        {
            FileId = fileId, JobType = jobType, Priority = QueuePriority.Immediate, PrioritizedAt = clock.UtcNow, PrioritizedBy = me, RequestedBy = me,
            PageCount = pageCount, Options = JsonSerializer.Serialize(options),
        };
    }
}
