using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace HoSoSo.Infrastructure.Messaging;

/// <summary>
/// BE-12. Mỗi giờ xóa dòng phiên đã hết hạn quá 1 ngày hoặc đã thu hồi quá 7 ngày (giữ lại một thời gian để điều tra khi cần).
/// Phiên còn hạn hay mới thu hồi không bị động tới. Cùng nhịp này dọn sự kiện lỗi quá 90 ngày (BE-117).
/// </summary>
internal sealed class SessionCleanupService(NpgsqlDataSource dataSource, ILogger<SessionCleanupService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var removed = await RunOnceAsync(stoppingToken);
                if (removed > 0) logger.LogInformation("auth_sessions_cleaned {Count}", removed);
                await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
            }
            catch (OperationCanceledException) { return; }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "auth_sessions_cleanup_failed");
                try { await Task.Delay(TimeSpan.FromMinutes(10), stoppingToken); } catch (OperationCanceledException) { return; }
            }
        }
    }

    internal async Task<int> RunOnceAsync(CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand(
            "DELETE FROM hoso.auth_sessions WHERE expires_at < now() - interval '1 day' OR revoked_at < now() - interval '7 days'");
        var removed = await command.ExecuteNonQueryAsync(ct);
        await using var errors = dataSource.CreateCommand("DELETE FROM hoso.error_events WHERE happened_at < now() - interval '90 days'");
        await errors.ExecuteNonQueryAsync(ct);
        return removed;
    }
}
