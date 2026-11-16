using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace HoSoSo.Infrastructure.Messaging;

/// <summary>
/// BE-46. Worker chết giữa chừng (mất điện, bị kill) thì heartbeat dừng. Mỗi phút trả job treo về hàng đợi
/// (tối đa 3 lần rồi failed). Trang đã đọc giữ nguyên nên lần sau chỉ đọc phần còn thiếu.
/// </summary>
internal sealed class StaleJobReaper(NpgsqlDataSource dataSource, ILogger<StaleJobReaper> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        try
        {
            do
            {
                try { await RunOnceAsync(stoppingToken); }
                catch (Exception exception) when (exception is not OperationCanceledException) { logger.LogWarning(exception, "stale_job_reaper_failed"); }
            } while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException) { /* tắt máy chủ */ }
    }

    internal async Task<int> RunOnceAsync(CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand("SELECT job_id, new_status FROM hoso.requeue_stale_jobs()");
        await using var reader = await command.ExecuteReaderAsync(ct);
        var count = 0;
        while (await reader.ReadAsync(ct))
        {
            count++;
            logger.LogWarning("stale_job_recovered {JobId} {NewStatus}", reader.GetGuid(0), reader.GetString(1));
        }
        return count;
    }
}
