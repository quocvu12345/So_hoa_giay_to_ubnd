using System.Text.Json;
using HoSoSo.Application.Common;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace HoSoSo.Infrastructure.Messaging;

/// <summary>
/// BE-22. Giữ một kết nối LISTEN tới PostgreSQL và chuyển thông báo thành sự kiện theo người dùng:
///   job_progress          → job.progress | job.completed | job.failed | job.cancelled   (tới người đã tải PDF)
///   notification_created  → notification.created                                        (tới người nhận)
///   dossier_changed       → dossier.changed                                              (chỉ tới người có hồ sơ đó trong phạm vi)
///   export_progress       → export.progress | export.ready | export.failed                 (tới người yêu cầu gói xuất)
/// Mất kết nối thì tự nối lại (1→30 giây); nối lại xong báo "resync" để giao diện tải lại dữ liệu đã lỡ.
/// </summary>
internal sealed class PgNotificationListener(NpgsqlDataSource dataSource, IEventBus bus, IMemoryCache cache, ILogger<PgNotificationListener> logger) : BackgroundService
{
    private static readonly string[] Channels = ["job_progress", "notification_created", "dossier_changed", "export_progress"];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var delay = TimeSpan.FromSeconds(1);
        var first = true;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var connection = await dataSource.OpenConnectionAsync(stoppingToken);
                connection.Notification += (_, e) => _ = HandleAsync(e.Channel, e.Payload, stoppingToken);
                foreach (var channel in Channels)
                {
                    await using var listen = new NpgsqlCommand($"LISTEN {channel}", connection);
                    await listen.ExecuteNonQueryAsync(stoppingToken);
                }
                logger.LogInformation("pg_listen_started {Channels}", Channels);
                if (!first) bus.PublishToAll("resync", new { reason = "database_reconnected" });
                first = false;
                delay = TimeSpan.FromSeconds(1);
                while (!stoppingToken.IsCancellationRequested) await connection.WaitAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "pg_listen_lost retryIn={DelaySeconds}", delay.TotalSeconds);
                try { await Task.Delay(delay, stoppingToken); } catch (OperationCanceledException) { return; }
                delay = TimeSpan.FromSeconds(Math.Min(delay.TotalSeconds * 2, 30));
                first = false;
            }
        }
    }

    /// <summary>Công khai trong assembly để kiểm thử gọi trực tiếp, không cần chờ PostgreSQL.</summary>
    internal async Task HandleAsync(string channel, string payload, CancellationToken ct)
    {
        try
        {
            using var doc = JsonDocument.Parse(payload);
            var root = doc.RootElement;
            switch (channel)
            {
                case "job_progress":
                    await HandleJobAsync(root, ct);
                    break;
                case "notification_created":
                    if (root.TryGetProperty("userId", out var user) && user.TryGetGuid(out var userId))
                        bus.Publish(userId, "notification.created", new { id = root.GetProperty("id").GetGuid(), kind = root.GetProperty("kind").GetString() });
                    break;
                case "dossier_changed":
                    await HandleDossierAsync(root, ct);
                    break;
                case "export_progress":
                    if (root.TryGetProperty("userId", out var exporter) && exporter.TryGetGuid(out var exporterId))
                    {
                        var status = root.GetProperty("status").GetString();
                        var type = status switch { "ready" => "export.ready", "failed" => "export.failed", "expired" => "export.expired", _ => "export.progress" };
                        bus.Publish(exporterId, type, new { exportId = root.GetProperty("id").GetGuid(), status, processed = root.GetProperty("processed").GetInt32(), total = root.GetProperty("total").GetInt32() });
                    }
                    break;
            }
        }
        catch (Exception exception) when (exception is JsonException or KeyNotFoundException or InvalidOperationException or NpgsqlException)
        {
            // Một thông báo hỏng không được làm sập luồng nghe.
            logger.LogWarning(exception, "pg_notification_ignored {Channel}", channel);
        }
    }

    private async Task HandleJobAsync(JsonElement root, CancellationToken ct)
    {
        if (!root.TryGetProperty("jobId", out var jobElement) || !Guid.TryParse(jobElement.GetString(), out var jobId)) return;
        var requester = await RequesterAsync(jobId, ct);
        if (requester is null) return;
        string? documentId = root.TryGetProperty("documentId", out var d) ? d.GetString() : null;
        if (root.TryGetProperty("status", out var status))
        {
            var type = status.GetString() switch
            {
                "completed" => "job.completed", "failed" => "job.failed", "cancelled" => "job.cancelled", _ => "job.progress",
            };
            bus.Publish(requester.Value, type, new { jobId, documentId, status = status.GetString() });
            return;
        }
        bus.Publish(requester.Value, "job.progress", new
        {
            jobId, documentId,
            stage = root.TryGetProperty("stage", out var s) ? s.GetString() : null,
            processed = root.TryGetProperty("processed", out var p) ? p.GetInt32() : 0,
            pageCount = root.TryGetProperty("pageCount", out var c) ? c.GetInt32() : (int?)null,
        });
    }

    private async Task HandleDossierAsync(JsonElement root, CancellationToken ct)
    {
        if (!root.TryGetProperty("dossierId", out var idElement) || !idElement.TryGetGuid(out var dossierId)) return;
        var status = root.TryGetProperty("status", out var s) ? s.GetString() : null;
        foreach (var subscriber in bus.Subscribers.DistinctBy(x => (x.UserId, x.Assignment)))
        {
            if (string.IsNullOrEmpty(subscriber.Assignment)) continue;
            // Cùng hàm scope_matches như mọi API: người ngoài phạm vi không biết hồ sơ vừa đổi.
            await using var command = dataSource.CreateCommand("SELECT hoso.scope_matches($1, $2, $3)");
            command.Parameters.AddWithValue(subscriber.UserId);
            command.Parameters.AddWithValue(dossierId);
            command.Parameters.AddWithValue(subscriber.Assignment);
            if (await command.ExecuteScalarAsync(ct) is true) bus.Publish(subscriber.UserId, "dossier.changed", new { dossierId, status }, subscriber.Assignment);
        }
    }

    private async Task<Guid?> RequesterAsync(Guid jobId, CancellationToken ct) =>
        await cache.GetOrCreateAsync($"job-requester:{jobId}", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30);
            await using var command = dataSource.CreateCommand("SELECT requested_by FROM hoso.ocr_jobs WHERE id = $1");
            command.Parameters.AddWithValue(jobId);
            return await command.ExecuteScalarAsync(ct) is Guid id ? id : (Guid?)null;
        });
}
