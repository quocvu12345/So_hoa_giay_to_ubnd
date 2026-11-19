using HoSoSo.Infrastructure.Storage;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Npgsql;

namespace HoSoSo.Infrastructure.Health;

/// <summary>BE-18, BE-21. Kho tệp ghi được: tạo rồi xóa một tệp nhỏ trong thư mục tmp (và trong bucket nếu dùng S3). Không ghi được thì tải PDF sẽ hỏng nên trả Unhealthy.</summary>
internal sealed class StorageHealthCheck(IOptions<StorageOptions> options, IHostEnvironment environment, IEnumerable<IStorageProbe> probes) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            // Kho S3 (nếu dùng): ghi được vào bucket. Thư mục tạm cục bộ vẫn phải ghi được vì tệp tải lên và gói xuất đi qua đó.
            foreach (var remote in probes) await remote.ProbeAsync(cancellationToken);
            var directory = Path.Combine(Path.GetFullPath(options.Value.Root, environment.ContentRootPath), "tmp");
            Directory.CreateDirectory(directory);
            var probe = Path.Combine(directory, $"health-{Guid.NewGuid():N}.probe");
            await File.WriteAllTextAsync(probe, "ok", cancellationToken);
            File.Delete(probe);
            return HealthCheckResult.Healthy();
        }
        catch (Exception exception)
        {
            return HealthCheckResult.Unhealthy("Kho tệp không ghi được.", exception);
        }
    }
}

/// <summary>
/// BE-18, BE-133. Việc đọc PDF đang bị chặn, trả Degraded (HTTP 200: hệ thống vẫn dùng được, chỉ PDF chưa được đọc; cảnh báo gửi quản trị) khi:
/// - có việc chờ và mọi worker còn sống đều báo máy chạy mô hình (Ollama ở máy khác) không trả lời quá 2 phút; hoặc
/// - có việc chờ quá 10 phút mà không worker nào sống (không báo nhịp trong ai_workers, không giữ việc nào có heartbeat mới).
/// Trước BE-133 chỉ đếm job đang chạy: máy AI tắt thì worker nhận rồi trả việc liên tục nên kết quả bật tắt theo từng lần gọi.
/// </summary>
internal sealed class AiQueueHealthCheck(NpgsqlDataSource dataSource) : IHealthCheck
{
    private const string Sql = """
        SELECT (SELECT count(*) FROM hoso.ocr_jobs WHERE status = 'queued'),
               (SELECT count(*) FROM hoso.ocr_jobs WHERE status = 'queued' AND created_at < now() - interval '10 minutes'),
               (SELECT count(*) FROM hoso.ocr_jobs WHERE status = 'running' AND heartbeat_at > now() - interval '2 minutes'),
               (SELECT count(*) FROM hoso.ai_workers WHERE last_seen_at > now() - interval '2 minutes'),
               (SELECT count(*) FROM hoso.ai_workers WHERE last_seen_at > now() - interval '2 minutes' AND engine_ok),
               (SELECT min(engine_down_since) FROM hoso.ai_workers WHERE last_seen_at > now() - interval '2 minutes' AND NOT engine_ok)
        """;

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            await using var command = dataSource.CreateCommand(Sql);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            await reader.ReadAsync(cancellationToken);
            var (queued, waitingLong, busy, alive, aliveOk) = (reader.GetInt64(0), reader.GetInt64(1), reader.GetInt64(2), reader.GetInt64(3), reader.GetInt64(4));
            DateTimeOffset? downSince = reader.IsDBNull(5) ? null : reader.GetFieldValue<DateTimeOffset>(5);
            if (queued == 0 || busy > 0 || aliveOk > 0) return HealthCheckResult.Healthy();
            if (alive > 0 && downSince is { } since && DateTimeOffset.UtcNow - since > TimeSpan.FromMinutes(2))
                return HealthCheckResult.Degraded($"{queued} việc đọc PDF đang chờ: máy chạy mô hình AI không trả lời từ {since:yyyy-MM-dd HH:mm} UTC (worker vẫn sống).");
            return waitingLong > 0 && alive == 0
                ? HealthCheckResult.Degraded($"{waitingLong} việc đọc PDF chờ quá 10 phút và không thấy worker AI nào hoạt động.")
                : HealthCheckResult.Healthy();
        }
        catch (Exception exception)
        {
            return HealthCheckResult.Degraded("Không đọc được trạng thái hàng đợi AI.", exception);
        }
    }
}
