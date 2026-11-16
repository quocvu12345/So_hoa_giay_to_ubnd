using System.Diagnostics.Metrics;
using HoSoSo.Application.Admin;
using HoSoSo.Application.Common;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace HoSoSo.Infrastructure.Messaging;

/// <summary>
/// BE-89. Định kỳ (mặc định 15 phút, <c>Backup:WatchdogMinutes</c>; 0 là tắt) hỏi <see cref="BackupMonitor"/> xem sao lưu có ổn không.
/// Có vấn đề thì báo cho các quản trị kỹ thuật đang có hiệu lực; cùng một nội dung chỉ báo lại sau 24 giờ (kiểm trong CSDL nên nhiều instance không báo trùng).
/// Đồng thời cập nhật chỉ số <c>hoso.backup.last_success_age_hours</c> và <c>hoso.backup.healthy</c> cho hệ thống giám sát (Grafana cảnh báo theo chỉ số này).
/// </summary>
internal sealed class BackupWatchdogService(IServiceScopeFactory scopes, NpgsqlDataSource dataSource, IClock clock, IConfiguration configuration,
    ILogger<BackupWatchdogService> logger) : BackgroundService
{
    internal const string MeterName = "HoSo.Backup";
    private static readonly Meter Meter = new(MeterName);
    private static volatile BackupStatus? _latest;

    static BackupWatchdogService()
    {
        Meter.CreateObservableGauge<double>("hoso.backup.last_success_age_hours", AgeMeasurements,
            unit: "h", description: "Số giờ từ bản sao lưu thành công gần nhất");
        Meter.CreateObservableGauge<int>("hoso.backup.healthy", HealthMeasurements,
            description: "1 nếu sao lưu đang ổn, 0 nếu cần xử lý");
    }

    private static IEnumerable<Measurement<double>> AgeMeasurements()
    {
        var status = _latest;
        if (status is null) yield break;
        foreach (var kind in status.Kinds.Where(k => k.Required && k.AgeHours is not null))
            yield return new Measurement<double>(kind.AgeHours!.Value, new KeyValuePair<string, object?>("kind", kind.Kind));
    }

    private static IEnumerable<Measurement<int>> HealthMeasurements()
    {
        var status = _latest;
        if (status is not null) yield return new Measurement<int>(status.Healthy ? 1 : 0);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var minutes = configuration.GetValue("Backup:WatchdogMinutes", 15);
        if (minutes <= 0) return;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var alerts = await RunOnceAsync(stoppingToken);
                if (alerts > 0) logger.LogWarning("backup_alert_sent {Count}", alerts);
                await Task.Delay(TimeSpan.FromMinutes(minutes), stoppingToken);
            }
            catch (OperationCanceledException) { return; }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "backup_watchdog_failed");
                try { await Task.Delay(TimeSpan.FromMinutes(minutes), stoppingToken); } catch (OperationCanceledException) { return; }
            }
        }
    }

    /// <returns>Số thông báo đã tạo.</returns>
    internal async Task<int> RunOnceAsync(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var status = await scope.ServiceProvider.GetRequiredService<BackupMonitor>().StatusAsync(ct);
        _latest = status;
        if (status.Healthy) return 0;

        var now = clock.UtcNow;
        await using var command = dataSource.CreateCommand("""
            INSERT INTO hoso.notifications(user_id, kind, title, body, link, created_at)
            SELECT DISTINCT u.id, 'backup.alert', 'Sao lưu cần xử lý', $1::text, '/quan-tri/van-hanh', $2::timestamptz
            FROM hoso.users u
            JOIN hoso.user_roles ur ON ur.user_id = u.id AND ur.role_code = 'technical_admin'
              AND ur.valid_from <= $2::timestamptz AND (ur.valid_until IS NULL OR ur.valid_until > $2::timestamptz)
            WHERE u.active
              AND NOT EXISTS (
                SELECT 1 FROM hoso.notifications n
                WHERE n.user_id = u.id AND n.kind = 'backup.alert' AND n.body = $1::text AND n.created_at > $2::timestamptz - interval '24 hours')
            """);
        command.Parameters.AddWithValue(string.Join(" ", status.Problems));
        command.Parameters.AddWithValue(now.UtcDateTime);
        return await command.ExecuteNonQueryAsync(ct);
    }
}
