using HoSoSo.Application.Common;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HoSoSo.Infrastructure.Storage;

/// <summary>BE-21. Mỗi giờ dọn tệp tải lên dở dang cũ hơn 1 ngày.</summary>
internal sealed class StorageMaintenanceService(LocalFileStorage storage, IClock clock, ILogger<StorageMaintenanceService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        try
        {
            do
            {
                try
                {
                    var removed = storage.CleanTemp(TimeSpan.FromDays(1), clock.UtcNow);
                    if (removed > 0) logger.LogInformation("storage_temp_cleaned {Count}", removed);
                }
                catch (Exception exception) when (exception is not OperationCanceledException) { logger.LogWarning(exception, "storage_temp_clean_failed"); }
            } while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException) { /* tắt máy chủ */ }
    }
}
