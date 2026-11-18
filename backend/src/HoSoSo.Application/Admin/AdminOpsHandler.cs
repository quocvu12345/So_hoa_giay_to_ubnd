using System.Text.Json;
using System.Text.RegularExpressions;
using FluentValidation;
using HoSoSo.Application.Common;
using HoSoSo.Application.Intake;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Admin;

public sealed record QueueCounts(int Queued, int Running, int Completed24h, int Failed24h, int Cancelled24h);
public sealed record WorkerInfo(string WorkerId, Guid JobId, string? Stage, int HeartbeatAgeSeconds);
public sealed record FailureInfo(Guid JobId, string FileName, string? Error, DateTimeOffset? FinishedAt, int Attempts);
public sealed record ModelInfo(string Key, string Repo, string Revision, string Purpose, bool Active);
public sealed record Throughput(int JobsLastHour, int PagesLastHour, double? AverageSecondsPerOcrPage);
public sealed record AiStatus(QueueCounts Queue, int? OldestQueuedSeconds, IReadOnlyList<WorkerInfo> Workers, IReadOnlyList<FailureInfo> RecentFailures,
    IReadOnlyList<ModelInfo> Models, Throughput Throughput, QueueByKind? ByKind = null,
    IReadOnlyList<RunningModel>? RunningModels = null, string? ModelMismatch = null);

/// <summary>BE-100. Mô hình mà worker THẬT SỰ đã dùng cho các job hoàn tất trong 24 giờ qua (từ <c>ocr_jobs.model_version</c>), không phải điều bảng <c>ai_models</c> ghi.</summary>
public sealed record RunningModel(string ModelVersion, int Jobs, DateTimeOffset LastFinishedAt);

/// <summary>BE-99. Việc đang chờ theo mức (Intake/AiQueue.cs), số lần việc nền nhường chỗ trong 24 giờ, tuổi việc nền lâu nhất.</summary>
public sealed record QueueByKind(int Priority, int Interactive, int Background, int Preempted24h, int? OldestBackgroundSeconds, double? SecondsPerPage);

/// <summary>Một dòng nhật ký. KHÔNG chứa giá trị cũ/mới của dữ liệu (có thể là thông tin cá nhân): chỉ tên cột đã đổi.</summary>
public sealed record AuditRow(long Id, DateTimeOffset At, string Kind, string? Actor, string Action, string? ObjectType, string? ObjectId,
    string? CorrelationId, IReadOnlyList<string>? ChangedColumns);

/// <summary>
/// BE-117. Một Mã lỗi đã trả cho người dùng: request nào (phương thức, đường dẫn không kèm chuỗi truy vấn), người nào, mã tương quan.
/// Related: các dòng nhật ký truy cập cùng mã tương quan (cùng request) để biết người đó đang xem gì; chỉ có khi lọc theo Mã lỗi hoặc mã tương quan.
/// </summary>
public sealed record ErrorEventRow(long Id, string ErrorId, DateTimeOffset At, int Status, string Code, string Method, string Path, string? CorrelationId,
    Guid? UserId, string? Actor, string? Assignment, IReadOnlyList<AuditRow> Related);

public sealed record SettingDto(string Key, JsonElement Value, DateTimeOffset UpdatedAt);
public sealed record UpdateSettingRequest(string Key, JsonElement Value);
public sealed record BackupDto(Guid Id, string Kind, string Status, DateTimeOffset StartedAt, DateTimeOffset? FinishedAt, long? ByteSize, string? Location, DateTimeOffset? RestoreTestedAt, string Note);
public sealed record RecordBackupRequest(string Kind, string Status, DateTimeOffset? StartedAt, DateTimeOffset? FinishedAt, long? ByteSize, string? Location, DateTimeOffset? RestoreTestedAt, string? Note);
/// <summary>Trường nào để trống thì giữ nguyên. <c>Status</c> chỉ nhận succeeded/failed và chỉ áp cho lần đang chạy.</summary>
public sealed record FinishBackupRequest(string? Status, DateTimeOffset? FinishedAt, long? ByteSize, string? Location, DateTimeOffset? RestoreTestedAt, string? Note);
public sealed record RestoreTestRequest(DateTimeOffset? TestedAt, string? Note);

/// <summary>BE-88, BE-89: vận hành. Trạng thái hàng đợi AI, tra nhật ký, cài đặt không nhạy cảm, kết quả sao lưu.</summary>
public sealed partial class AdminOpsHandler(IHoSoDb db, ICurrentUser user, IClock clock, AiQueueEstimator queue)
{
    private static readonly string[] SecretWords = ["password", "passwd", "secret", "token", "apikey", "api_key", "private", "credential", "mat_khau", "bi_mat"];

    [GeneratedRegex("^[a-z][a-z0-9_.]{2,59}$")]
    internal static partial Regex SettingKey();

    public async Task<AiStatus> AiStatusAsync(CancellationToken ct)
    {
        var now = clock.UtcNow;
        var day = now.AddHours(-24);
        var hour = now.AddHours(-1);
        var jobs = db.Read<OcrJob>();
        var counts = await jobs.GroupBy(j => j.Status).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        var recent = await jobs.Where(j => j.FinishedAt >= day).GroupBy(j => j.Status).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        var oldest = await jobs.Where(j => j.Status == JobStatus.Queued).OrderBy(j => j.CreatedAt).Select(j => (DateTimeOffset?)j.CreatedAt).FirstOrDefaultAsync(ct);

        var running = await jobs.Where(j => j.Status == JobStatus.Running && j.LockedBy != null)
            .Select(j => new { j.LockedBy, j.Id, j.Stage, j.HeartbeatAt }).ToListAsync(ct);
        var workers = running.Select(r => new WorkerInfo(r.LockedBy!, r.Id, r.Stage, r.HeartbeatAt is { } h ? (int)Math.Max(0, (now - h).TotalSeconds) : -1)).ToList();

        var failures = await (from j in jobs
                              join f in db.Read<FileRecord>() on j.FileId equals f.Id
                              where j.Status == JobStatus.Failed
                              orderby j.FinishedAt descending
                              select new FailureInfo(j.Id, f.OriginalName, j.ErrorMessage, j.FinishedAt, j.Attempt)).Take(20).ToListAsync(ct);
        var models = await db.Read<AiModel>().OrderBy(m => m.Key).Select(m => new ModelInfo(m.Key, m.Repo, m.Revision, m.Purpose, m.Active)).ToListAsync(ct);

        var lastHour = await jobs.Where(j => j.Status == JobStatus.Completed && j.FinishedAt >= hour).Select(j => new { j.Id, j.ProcessedPages }).ToListAsync(ct);
        var ids = lastHour.Select(x => x.Id).ToList();
        var averageSeconds = ids.Count == 0 ? null : await db.Read<OcrPage>().Where(p => ids.Contains(p.JobId) && p.Method == "ocr")
            .Select(p => (double?)p.ElapsedSeconds).AverageAsync(ct);

        var waiting = await jobs.Where(j => j.Status == JobStatus.Queued).GroupBy(j => j.Priority).Select(g => new { Priority = g.Key, N = g.Count() }).ToListAsync(ct);
        var oldestBackground = await jobs.Where(j => j.Status == JobStatus.Queued && j.Priority >= QueuePriority.BackgroundFrom)
            .OrderBy(j => j.CreatedAt).Select(j => (DateTimeOffset?)j.CreatedAt).FirstOrDefaultAsync(ct);
        var preempted = await jobs.Where(j => j.PreemptedCount > 0 && (j.FinishedAt == null || j.FinishedAt >= day)).SumAsync(j => (int?)j.PreemptedCount, ct) ?? 0;
        var byKind = new QueueByKind(
            waiting.Where(w => QueuePriority.KindOf(w.Priority) == QueuePriority.KindPriority).Sum(w => w.N),
            waiting.Where(w => QueuePriority.KindOf(w.Priority) == QueuePriority.KindInteractive).Sum(w => w.N),
            waiting.Where(w => QueuePriority.KindOf(w.Priority) == QueuePriority.KindBackground).Sum(w => w.N),
            preempted, oldestBackground is { } b ? (int)(now - b).TotalSeconds : null, (await queue.LoadAsync(ct)).SecondsPerPage is { } spp ? Math.Round(spp, 1) : null);

        var finished = await jobs.Where(j => j.Status == JobStatus.Completed && j.FinishedAt >= day && j.ModelVersion != "" && j.ModelVersion != "unspecified")
            .Select(j => new { j.ModelVersion, j.FinishedAt }).ToListAsync(ct);
        var modelsInUse = finished.GroupBy(x => x.ModelVersion)
            .Select(g => new RunningModel(g.Key, g.Count(), g.Max(x => x.FinishedAt!.Value))).OrderByDescending(r => r.LastFinishedAt).ToList();

        return new AiStatus(
            new QueueCounts(counts.GetValueOrDefault(JobStatus.Queued), counts.GetValueOrDefault(JobStatus.Running),
                recent.GetValueOrDefault(JobStatus.Completed), recent.GetValueOrDefault(JobStatus.Failed), recent.GetValueOrDefault(JobStatus.Cancelled)),
            oldest is { } o ? (int)(now - o).TotalSeconds : null, workers, failures, models,
            new Throughput(lastHour.Count, lastHour.Sum(x => x.ProcessedPages), averageSeconds is { } a ? Math.Round(a, 1) : null), byKind,
            modelsInUse, DetectModelMismatch(modelsInUse, models));
    }

    /// <summary>
    /// So mô hình phân loại của job gần nhất với dòng <c>classifier</c> trong <c>ai_models</c>. Lệch thường do đổi <c>HOSO_AI_CLASSIFIER_MODEL</c>
    /// ở worker mà chưa ghi nhận bằng migration (hoặc ngược lại). Chỉ xét job gần nhất: các job cũ hơn là lịch sử.
    /// </summary>
    private static readonly Regex QuantizationSuffix = new("-(?:[2-8]bit|bf16|fp16|q[2-8](?:_[0-9a-z]+)+)$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    internal static string? DetectModelMismatch(IReadOnlyList<RunningModel> running, IReadOnlyList<ModelInfo> models)
    {
        var latest = running.FirstOrDefault(r => r.ModelVersion.Contains("classifier="));
        var recorded = models.FirstOrDefault(m => m.Key == "classifier");
        if (latest is null || recorded is null) return null;
        var token = latest.ModelVersion.Split(' ').First(p => p.StartsWith("classifier=", StringComparison.Ordinal))["classifier=".Length..];
        var withoutStyle = token.Split('/')[0];                      // Tên@phiên bản7 (phần sau "/" là kiểu lời nhắc)
        var at = withoutStyle.IndexOf('@');
        var name = at >= 0 ? withoutStyle[..at] : withoutStyle;
        var revision = at >= 0 ? withoutStyle[(at + 1)..] : "";
        var recordedName = recorded.Repo.Split('/').Last();
        // Mô hình tự chuyển trên máy AI (ví dụ IFStruct BF16 → MLX 4-bit) có tên thư mục = tên repo nguồn + hậu tố lượng tử hóa; phiên bản vẫn là commit của nguồn.
        var sameName = string.Equals(name, recordedName, StringComparison.OrdinalIgnoreCase)
                       || string.Equals(QuantizationSuffix.Replace(name, ""), recordedName, StringComparison.OrdinalIgnoreCase);
        var sameRevision = revision.Length == 0 || recorded.Revision.StartsWith(revision, StringComparison.OrdinalIgnoreCase);
        if (sameName && sameRevision) return null;
        var recordedAs = $"{recordedName}@{recorded.Revision[..Math.Min(7, recorded.Revision.Length)]}";
        // Thẻ Ollama (hoso-ifstruct:q8_0) là tên do người vận hành đặt trên máy AI, không cho biết commit nguồn nên không so được với repo.
        if (name.Contains(':'))
            return $"Worker đang dùng mô hình Ollama {withoutStyle} nhưng bảng ai_models ghi {recordedAs}; tên trên Ollama không cho biết commit nguồn. " +
                   "Nếu mô hình đó được chuyển từ đúng bản đã ghi, khai báo HOSO_AI_OLLAMA_CLASSIFIER_SOURCE ở worker.";
        return $"Worker đang chạy {withoutStyle} nhưng bảng ai_models ghi {recordedAs}. " +
               "Ghi nhận mô hình mới bằng migration, hoặc đặt lại HOSO_AI_CLASSIFIER_MODEL của worker cho khớp.";
    }

    private sealed record ChangeRow(long id, DateTimeOffset happened_at, string table_name, string operation, string? actor_name, string? object_id, string[]? changed_columns);
    private sealed record AccessRow(long id, DateTimeOffset happened_at, string? actor_name, string action, string? object_type, string? object_id, string? correlation_id);

    public async Task<IReadOnlyList<AuditRow>> AuditAsync(string kind, Guid? actor, string? objectType, Guid? objectId, string? correlationId,
        DateTimeOffset? from, DateTimeOffset? to, long? beforeId, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 200);
        var objectText = objectId?.ToString();
        var actorText = actor?.ToString();
        var before = beforeId ?? long.MaxValue;
        if (kind == "access")
        {
            var rows = await db.Database.SqlQuery<AccessRow>($"""
                SELECT e.id, e.happened_at, u.display_name AS actor_name, e.action, e.object_type, e.object_id::text AS object_id, e.correlation_id
                FROM hoso.access_events e LEFT JOIN hoso.users u ON u.id = e.user_id
                WHERE e.id < {before}
                  AND ({actor}::uuid IS NULL OR e.user_id = {actor}::uuid)
                  AND ({objectType}::text IS NULL OR e.object_type = {objectType}::text)
                  AND ({objectId}::uuid IS NULL OR e.object_id = {objectId}::uuid)
                  AND ({correlationId}::text IS NULL OR e.correlation_id = {correlationId}::text)
                  AND ({from}::timestamptz IS NULL OR e.happened_at >= {from}::timestamptz)
                  AND ({to}::timestamptz IS NULL OR e.happened_at < {to}::timestamptz)
                ORDER BY e.id DESC LIMIT {limit}
                """).ToListAsync(ct);
            return rows.Select(r => new AuditRow(r.id, r.happened_at, "access", r.actor_name, r.action, r.object_type, r.object_id, r.correlation_id, null)).ToList();
        }
        if (kind != "change") throw new ValidationFailedException(new Dictionary<string, string[]> { ["kind"] = ["kind chỉ nhận access hoặc change."] });
        var changes = await db.Database.SqlQuery<ChangeRow>($"""
            SELECT a.id, a.happened_at, a.table_name, a.operation, u.display_name AS actor_name,
                   coalesce(a.new_row->>'id', a.old_row->>'id') AS object_id,
                   CASE WHEN a.operation = 'UPDATE' THEN
                     (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(a.new_row) k WHERE a.new_row -> k IS DISTINCT FROM a.old_row -> k)
                   END AS changed_columns
            FROM hoso.audit_events a LEFT JOIN hoso.users u ON u.id::text = a.actor_subject
            WHERE a.id < {before}
              AND ({actorText}::text IS NULL OR a.actor_subject = {actorText}::text)
              AND ({objectType}::text IS NULL OR a.table_name = {objectType}::text)
              AND ({objectText}::text IS NULL OR coalesce(a.new_row->>'id', a.old_row->>'id') = {objectText}::text)
              AND ({from}::timestamptz IS NULL OR a.happened_at >= {from}::timestamptz)
              AND ({to}::timestamptz IS NULL OR a.happened_at < {to}::timestamptz)
            ORDER BY a.id DESC LIMIT {limit}
            """).ToListAsync(ct);
        return changes.Select(r => new AuditRow(r.id, r.happened_at, "change", r.actor_name, r.operation, r.table_name, r.object_id, null, r.changed_columns)).ToList();
    }

    private sealed record ErrorRow(long id, string error_id, DateTimeOffset happened_at, short status, string error_code, string method, string path,
        string? correlation_id, Guid? user_id, string? actor_name, string? assignment);

    /// <summary>
    /// BE-117. Tra theo Mã lỗi người dùng gửi (không phân biệt hoa thường, 8 ký tự 0-9 A-F), hoặc theo mã tương quan, người, khoảng thời gian.
    /// Không lọc gì thì trả các lỗi gần nhất. Mã lỗi hết hạn lưu (90 ngày) hoặc chưa ghi kịp thì không có dòng nào: lúc đó tra log theo Mã lỗi.
    /// </summary>
    public async Task<IReadOnlyList<ErrorEventRow>> ErrorsAsync(string? errorId, string? correlationId, Guid? actor, DateTimeOffset? from, DateTimeOffset? to,
        long? beforeId, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 200);
        errorId = string.IsNullOrWhiteSpace(errorId) ? null : errorId.Trim().ToUpperInvariant();
        correlationId = string.IsNullOrWhiteSpace(correlationId) ? null : correlationId.Trim();
        if (errorId is not null && !(errorId.Length == 8 && errorId.All(Uri.IsHexDigit)))
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["errorId"] = ["Mã lỗi gồm 8 ký tự 0-9 và A-F, ví dụ 9FA13718."] });
        var before = beforeId ?? long.MaxValue;
        var rows = await db.Database.SqlQuery<ErrorRow>($"""
            SELECT e.id, e.error_id, e.happened_at, e.status, e.error_code, e.method, e.path, e.correlation_id, e.user_id, u.display_name AS actor_name, e.assignment
            FROM hoso.error_events e LEFT JOIN hoso.users u ON u.id = e.user_id
            WHERE e.id < {before}
              AND ({errorId}::text IS NULL OR e.error_id = {errorId}::text)
              AND ({correlationId}::text IS NULL OR e.correlation_id = {correlationId}::text)
              AND ({actor}::uuid IS NULL OR e.user_id = {actor}::uuid)
              AND ({from}::timestamptz IS NULL OR e.happened_at >= {from}::timestamptz)
              AND ({to}::timestamptz IS NULL OR e.happened_at < {to}::timestamptz)
            ORDER BY e.id DESC LIMIT {limit}
            """).ToListAsync(ct);

        var related = new Dictionary<string, List<AuditRow>>();
        if ((errorId is not null || correlationId is not null) && rows.Count > 0)
        {
            var ids = rows.Select(r => r.correlation_id).Where(c => c is not null).Distinct().ToArray();
            var access = await db.Database.SqlQuery<AccessRow>($"""
                SELECT e.id, e.happened_at, u.display_name AS actor_name, e.action, e.object_type, e.object_id::text AS object_id, e.correlation_id
                FROM hoso.access_events e LEFT JOIN hoso.users u ON u.id = e.user_id
                WHERE e.correlation_id = ANY({ids})
                ORDER BY e.id DESC LIMIT 200
                """).ToListAsync(ct);
            foreach (var a in access)
            {
                if (!related.TryGetValue(a.correlation_id!, out var list)) related[a.correlation_id!] = list = [];
                if (list.Count < 20) list.Add(new AuditRow(a.id, a.happened_at, "access", a.actor_name, a.action, a.object_type, a.object_id, a.correlation_id, null));
            }
        }
        return rows.Select(r => new ErrorEventRow(r.id, r.error_id, r.happened_at, r.status, r.error_code, r.method, r.path, r.correlation_id, r.user_id, r.actor_name, r.assignment,
            r.correlation_id is not null && related.TryGetValue(r.correlation_id, out var items) ? items : [])).ToList();
    }

    public async Task<IReadOnlyList<SettingDto>> SettingsAsync(CancellationToken ct) =>
        (await db.Read<SystemSetting>().OrderBy(s => s.Key).ToListAsync(ct)).Select(s => new SettingDto(s.Key, JsonDocument.Parse(s.Value).RootElement.Clone(), s.UpdatedAt)).ToList();

    public async Task<SettingDto> UpdateSettingAsync(UpdateSettingRequest r, CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        if (!SettingKey().IsMatch(r.Key)) errors["key"] = ["Khóa 3–60 ký tự gồm chữ thường, số, dấu chấm, gạch dưới, bắt đầu bằng chữ."];
        else if (SecretWords.Any(w => r.Key.Contains(w, StringComparison.Ordinal)))
            errors["key"] = ["Không lưu bí mật (mật khẩu, khóa, token) ở đây. Đặt bí mật bằng biến môi trường hoặc kho khóa."];
        var raw = r.Value.GetRawText();
        if (raw.Length > 4000) errors["value"] = ["Giá trị tối đa 4000 ký tự."];
        // Cài đặt mà hàm SQL đọc trực tiếp: chỉ nhận đúng kiểu, để gõ nhầm "true" (chuỗi) không âm thầm làm khóa cứng không bật.
        if (r.Key == HoSoSo.Application.Dossiers.DossierQueries.EnforceSettingKey && r.Value.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
            errors["value"] = ["Giá trị chỉ nhận true hoặc false (không có dấu ngoặc kép)."];
        if (errors.Count > 0) throw new ValidationFailedException(errors);

        var setting = await db.Set<SystemSetting>().SingleOrDefaultAsync(s => s.Key == r.Key, ct);
        if (setting is null) { setting = new SystemSetting { Key = r.Key }; db.Set<SystemSetting>().Add(setting); }
        setting.Value = raw;
        setting.UpdatedBy = user.RequireUserId();
        setting.UpdatedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        return new SettingDto(setting.Key, r.Value.Clone(), setting.UpdatedAt);
    }

    public async Task<IReadOnlyList<BackupDto>> BackupsAsync(CancellationToken ct) =>
        await db.Read<BackupRun>().OrderByDescending(b => b.StartedAt).Take(100)
            .Select(b => new BackupDto(b.Id, b.Kind, b.Status, b.StartedAt, b.FinishedAt, b.ByteSize, b.Location, b.RestoreTestedAt, b.Note)).ToListAsync(ct);

    /// <summary>Script sao lưu báo kết quả. Một sao lưu chưa từng thử khôi phục thì giao diện cảnh báo (restore_tested_at trống).</summary>
    public async Task<BackupDto> RecordBackupAsync(RecordBackupRequest r, CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        if (r.Kind is not ("database" or "files" or "config")) errors["kind"] = ["kind chỉ nhận database, files hoặc config."];
        if (r.Status is not ("running" or "succeeded" or "failed")) errors["status"] = ["status chỉ nhận running, succeeded hoặc failed."];
        if ((r.Status == "running") != (r.FinishedAt is null)) errors["finishedAt"] = ["Đang chạy thì chưa có giờ kết thúc; đã xong hoặc lỗi thì phải có."];
        if (r.ByteSize is < 0) errors["byteSize"] = ["Dung lượng không âm."];
        if (errors.Count > 0) throw new ValidationFailedException(errors);
        var run = new BackupRun
        {
            Kind = r.Kind, Status = r.Status, StartedAt = r.StartedAt ?? clock.UtcNow, FinishedAt = r.FinishedAt, ByteSize = r.ByteSize,
            Location = r.Location?.Trim(), RestoreTestedAt = r.RestoreTestedAt, Note = r.Note?.Trim() ?? "",
        };
        db.Set<BackupRun>().Add(run);
        await db.SaveChangesAsync(ct);
        return ToDto(run);
    }

    /// <summary>
    /// Script báo kết thúc một lần đang chạy (running → succeeded/failed) hoặc bổ sung dung lượng, nơi lưu, ghi chú, lần diễn tập khôi phục.
    /// Kết quả đã chốt (succeeded/failed) không đổi lại được: muốn sửa thì ghi lần mới, để lịch sử sao lưu không bị viết lại.
    /// </summary>
    public async Task<BackupDto> FinishBackupAsync(Guid id, FinishBackupRequest r, CancellationToken ct)
    {
        var run = await db.Set<BackupRun>().SingleOrDefaultAsync(b => b.Id == id, ct) ?? throw AppException.NotFound("lần sao lưu");
        var errors = new Dictionary<string, string[]>();
        if (r.Status is not null)
        {
            if (r.Status is not ("succeeded" or "failed")) errors["status"] = ["status chỉ nhận succeeded hoặc failed."];
            else if (run.Status != "running") throw AppException.Conflict("Lần sao lưu này đã có kết quả; không đổi lại được. Ghi một lần sao lưu mới.");
        }
        if (r.ByteSize is < 0) errors["byteSize"] = ["Dung lượng không âm."];
        if (r.FinishedAt is { } finished && finished < run.StartedAt) errors["finishedAt"] = ["Giờ kết thúc không thể trước giờ bắt đầu."];
        if (r.RestoreTestedAt is not null && (r.Status ?? run.Status) != "succeeded") errors["restoreTestedAt"] = ["Chỉ ghi diễn tập khôi phục cho bản sao lưu đã thành công."];
        if (errors.Count > 0) throw new ValidationFailedException(errors);

        if (r.Status is not null) { run.Status = r.Status; run.FinishedAt = r.FinishedAt ?? clock.UtcNow; }
        if (r.ByteSize is { } size) run.ByteSize = size;
        if (r.Location is not null) run.Location = r.Location.Trim();
        if (r.RestoreTestedAt is { } tested) run.RestoreTestedAt = tested;
        if (r.Note is not null) run.Note = r.Note.Trim();
        await db.SaveChangesAsync(ct);
        return ToDto(run);
    }

    /// <summary>Quản trị ghi nhận đã diễn tập khôi phục từ bản sao lưu này. Ghi chú của lần diễn tập được nối vào ghi chú cũ, không thay.</summary>
    public async Task<BackupDto> MarkRestoreTestedAsync(Guid id, RestoreTestRequest r, CancellationToken ct)
    {
        var run = await db.Set<BackupRun>().SingleOrDefaultAsync(b => b.Id == id, ct) ?? throw AppException.NotFound("lần sao lưu");
        if (run.Status != "succeeded")
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["id"] = ["Chỉ ghi diễn tập khôi phục cho bản sao lưu đã thành công."] });
        var at = r.TestedAt ?? clock.UtcNow;
        if (at < run.StartedAt) throw new ValidationFailedException(new Dictionary<string, string[]> { ["testedAt"] = ["Giờ diễn tập không thể trước giờ sao lưu."] });
        run.RestoreTestedAt = at;
        if (!string.IsNullOrWhiteSpace(r.Note)) run.Note = run.Note.Length == 0 ? $"Diễn tập khôi phục: {r.Note.Trim()}" : $"{run.Note} | Diễn tập khôi phục: {r.Note.Trim()}";
        await db.SaveChangesAsync(ct);
        return ToDto(run);
    }

    private static BackupDto ToDto(BackupRun run) =>
        new(run.Id, run.Kind, run.Status, run.StartedAt, run.FinishedAt, run.ByteSize, run.Location, run.RestoreTestedAt, run.Note);
}

public sealed class UpdateSettingValidator : AbstractValidator<UpdateSettingRequest>
{
    public UpdateSettingValidator() => RuleFor(x => x.Key).NotEmpty().WithMessage("Nhập khóa cài đặt.");
}
