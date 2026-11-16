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
/// BE-18. Hàng đợi AI "kẹt" khi có việc chờ quá 10 phút mà không worker nào báo nhịp trong 2 phút qua.
/// Trả Degraded (HTTP 200): hệ thống vẫn dùng được, chỉ việc đọc PDF chậm; cảnh báo gửi cho quản trị.
/// </summary>
internal sealed class AiQueueHealthCheck(NpgsqlDataSource dataSource) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            await using var command = dataSource.CreateCommand(
                "SELECT (SELECT count(*) FROM hoso.ocr_jobs WHERE status = 'queued' AND created_at < now() - interval '10 minutes'), " +
                "(SELECT count(*) FROM hoso.ocr_jobs WHERE status = 'running' AND heartbeat_at > now() - interval '2 minutes')");
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            await reader.ReadAsync(cancellationToken);
            var (waiting, alive) = (reader.GetInt64(0), reader.GetInt64(1));
            return waiting > 0 && alive == 0
                ? HealthCheckResult.Degraded($"{waiting} việc đọc PDF chờ quá 10 phút và không thấy worker AI nào hoạt động.")
                : HealthCheckResult.Healthy();
        }
        catch (Exception exception)
        {
            return HealthCheckResult.Degraded("Không đọc được trạng thái hàng đợi AI.", exception);
        }
    }
}
