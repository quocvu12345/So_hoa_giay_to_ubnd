using System.Diagnostics.Metrics;
using System.Net;
using System.Threading.Channels;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;

namespace HoSoSo.Infrastructure.Auditing;

public sealed record AccessEventRecord(Guid? UserId, string Action, string ObjectType, Guid? ObjectId, string? ClientIp, string CorrelationId, DateTimeOffset At,
    string? Assignment = null);

/// <summary>
/// BE-16, BE-94. Hàng đợi trong bộ nhớ cho các dòng nhật ký không nhạy cảm (xem danh sách, tìm kiếm): request chỉ xếp một dòng rồi đi tiếp; nền ghi theo lô.
/// Đầy hàng đợi thì bỏ dòng cũ nhất NHƯNG ĐẾM ĐÚNG (callback itemDropped của kênh), ghi nhận thời điểm mất để cảnh báo.
/// Dòng nhạy cảm (tải, xuất, xem tệp) không đi qua đây mà ghi đồng bộ (HttpAccessLog.RecordDurableAsync).
/// </summary>
public sealed class AccessEventQueue
{
    public const int Capacity = 10_000;
    private readonly Channel<AccessEventRecord> _channel;
    private long _pending;
    private long _dropped;
    private long _failed;
    private long _lastLossTicks;

    public AccessEventQueue()
    {
        _channel = Channel.CreateBounded<AccessEventRecord>(
            new BoundedChannelOptions(Capacity) { FullMode = BoundedChannelFullMode.DropOldest, SingleReader = true },
            itemDropped: _ =>
            {
                // Dòng cũ bị đẩy ra sẽ không bao giờ được ghi: không còn "đang chờ" nữa, và phải đếm là mất.
                Interlocked.Decrement(ref _pending);
                Interlocked.Increment(ref _dropped);
                MarkLoss();
            });
        AccessLogMetrics.Register(this);
    }

    /// <summary>Số dòng bị bỏ vì hàng đợi đầy (từ khi chạy).</summary>
    public long Dropped => Interlocked.Read(ref _dropped);
    /// <summary>Số dòng không ghi được sau khi đã thử lại hết.</summary>
    public long Failed => Interlocked.Read(ref _failed);
    public long Pending => Interlocked.Read(ref _pending);
    /// <summary>Lần gần nhất mất dòng (bỏ hoặc không ghi được); null nếu chưa từng.</summary>
    public DateTimeOffset? LastLossAt => Interlocked.Read(ref _lastLossTicks) is var ticks and > 0 ? new DateTimeOffset(ticks, TimeSpan.Zero) : null;

    internal ChannelReader<AccessEventRecord> Reader => _channel.Reader;

    public void Enqueue(AccessEventRecord record)
    {
        Interlocked.Increment(ref _pending);
        _channel.Writer.TryWrite(record);     // DropOldest: luôn thành công; dòng bị đẩy ra được đếm ở itemDropped
    }

    internal void Completed(int count, bool success)
    {
        Interlocked.Add(ref _pending, -count);
        if (!success)
        {
            Interlocked.Add(ref _failed, count);
            MarkLoss();
        }
    }

    private void MarkLoss() => Interlocked.Exchange(ref _lastLossTicks, DateTimeOffset.UtcNow.UtcTicks);

    /// <summary>Chờ ghi xong các dòng đã xếp hàng (dùng trong kiểm thử và khi tắt máy chủ).</summary>
    public async Task DrainAsync(TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (Interlocked.Read(ref _pending) > 0 && DateTime.UtcNow < deadline) await Task.Delay(20);
    }
}

/// <summary>Chỉ số cho hệ thống giám sát (Grafana cảnh báo khi dropped/failed tăng): hoso.access_log.dropped_total, failed_total, pending.</summary>
internal static class AccessLogMetrics
{
    private static readonly Meter Meter = new("HoSo.AccessLog");
    private static AccessEventQueue? _queue;

    static AccessLogMetrics()
    {
        Meter.CreateObservableCounter<long>("hoso.access_log.dropped_total", () => _queue?.Dropped ?? 0, description: "Dòng nhật ký truy cập bị bỏ vì hàng đợi đầy");
        Meter.CreateObservableCounter<long>("hoso.access_log.failed_total", () => _queue?.Failed ?? 0, description: "Dòng nhật ký truy cập không ghi được sau khi thử lại hết");
        Meter.CreateObservableGauge<long>("hoso.access_log.pending", () => _queue?.Pending ?? 0, description: "Dòng nhật ký truy cập đang chờ ghi");
    }

    public static void Register(AccessEventQueue queue) => _queue = queue;
}

/// <summary>Mục "AccessLog" của cấu hình. <c>RetryDelaysMs</c>: chờ giữa các lần thử lại khi CSDL lỗi (hết danh sách thì tính là mất và cảnh báo).</summary>
public sealed class AccessLogOptions
{
    public int[] RetryDelaysMs { get; set; } = [1000, 2000, 4000, 8000, 15000];
}

internal sealed class AccessEventWriter(AccessEventQueue queue, NpgsqlDataSource dataSource, IConfiguration configuration, ILogger<AccessEventWriter> logger) : BackgroundService
{
    private const int BatchSize = 100;
    private static readonly TimeSpan MaxWait = TimeSpan.FromSeconds(2);
    private static readonly TimeSpan AlertEvery = TimeSpan.FromHours(1);
    private DateTimeOffset _lastAlert = DateTimeOffset.MinValue;

    private int[] RetryDelays => configuration.GetSection("AccessLog:RetryDelaysMs").Get<int[]>() is { Length: > 0 } configured ? configured : new AccessLogOptions().RetryDelaysMs;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var batch = new List<AccessEventRecord>(BatchSize);
        try
        {
            while (await queue.Reader.WaitToReadAsync(stoppingToken))
            {
                using var window = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                window.CancelAfter(MaxWait);
                try
                {
                    while (batch.Count < BatchSize && await queue.Reader.WaitToReadAsync(window.Token))
                    {
                        while (batch.Count < BatchSize && queue.Reader.TryRead(out var item)) batch.Add(item);
                    }
                }
                catch (OperationCanceledException) when (!stoppingToken.IsCancellationRequested) { /* hết 2 giây: ghi những gì đang có */ }
                await WriteAsync(batch, stoppingToken);
                batch.Clear();
            }
        }
        catch (OperationCanceledException) { /* tắt máy chủ */ }
        // Ghi nốt phần còn lại khi tắt (không thử lại lâu: máy chủ đang dừng).
        while (queue.Reader.TryRead(out var rest)) batch.Add(rest);
        if (batch.Count > 0) await WriteAsync(batch, new CancellationToken(canceled: true));
    }

    /// <summary>Thử ghi cả lô, thử lại theo danh sách chờ khi CSDL lỗi (lô giữ nguyên, không bỏ). Hết lượt thì đếm là mất và cảnh báo quản trị.</summary>
    private async Task WriteAsync(List<AccessEventRecord> batch, CancellationToken stop)
    {
        if (batch.Count == 0) return;
        var delays = RetryDelays;
        for (var attempt = 0; ; attempt++)
        {
            try
            {
                await InsertAsync(batch);
                queue.Completed(batch.Count, true);
                return;
            }
            catch (Exception exception)
            {
                if (attempt >= delays.Length || stop.IsCancellationRequested)
                {
                    logger.LogError(exception, "access_log_write_failed {Count}", batch.Count);
                    queue.Completed(batch.Count, false);
                    await AlertAsync(batch.Count);
                    return;
                }
                logger.LogWarning(exception, "access_log_write_retry {Attempt} {Count}", attempt + 1, batch.Count);
                try { await Task.Delay(delays[attempt], stop); } catch (OperationCanceledException) { /* tắt máy chủ: thử lần cuối rồi thôi */ }
            }
        }
    }

    private async Task InsertAsync(List<AccessEventRecord> batch)
    {
        await using var command = dataSource.CreateCommand(
            "INSERT INTO hoso.access_events(user_id, user_role_id, assignment, action, object_type, object_id, client_ip, correlation_id, happened_at) " +
            "SELECT * FROM unnest(@u, @r, @s, @a, @t, @o, @ip, @c, @h)");
        command.Parameters.Add(new NpgsqlParameter("u", NpgsqlDbType.Array | NpgsqlDbType.Uuid) { Value = batch.Select(x => x.UserId).ToArray() });
        // user_role_id có khóa ngoại tới user_roles nên chỉ điền với phân công riêng (mã là một GUID); ủy quyền "d:<id>" chỉ ghi ở cột assignment.
        command.Parameters.Add(new NpgsqlParameter("r", NpgsqlDbType.Array | NpgsqlDbType.Uuid) { Value = batch.Select(x => Guid.TryParse(x.Assignment, out var role) ? (Guid?)role : null).ToArray() });
        command.Parameters.Add(new NpgsqlParameter("s", NpgsqlDbType.Array | NpgsqlDbType.Text) { Value = batch.Select(x => x.Assignment).ToArray() });
        command.Parameters.Add(new NpgsqlParameter("a", NpgsqlDbType.Array | NpgsqlDbType.Text) { Value = batch.Select(x => x.Action).ToArray() });
        command.Parameters.Add(new NpgsqlParameter("t", NpgsqlDbType.Array | NpgsqlDbType.Text) { Value = batch.Select(x => x.ObjectType).ToArray() });
        command.Parameters.Add(new NpgsqlParameter("o", NpgsqlDbType.Array | NpgsqlDbType.Uuid) { Value = batch.Select(x => x.ObjectId).ToArray() });
        command.Parameters.Add(new NpgsqlParameter("ip", NpgsqlDbType.Array | NpgsqlDbType.Inet)
            { Value = batch.Select(x => IPAddress.TryParse(x.ClientIp, out var ip) ? ip : null).ToArray() });
        command.Parameters.Add(new NpgsqlParameter("c", NpgsqlDbType.Array | NpgsqlDbType.Text) { Value = batch.Select(x => x.CorrelationId).ToArray() });
        command.Parameters.Add(new NpgsqlParameter("h", NpgsqlDbType.Array | NpgsqlDbType.TimestampTz) { Value = batch.Select(x => x.At.UtcDateTime).ToArray() });
        await command.ExecuteNonQueryAsync();
    }

    /// <summary>Báo các quản trị kỹ thuật đang hiệu lực (tối đa mỗi giờ một lần cho mỗi người). Chính CSDL có thể đang hỏng nên lỗi ở đây chỉ ghi log.</summary>
    private async Task AlertAsync(int lost)
    {
        if (DateTimeOffset.UtcNow - _lastAlert < AlertEvery) return;
        _lastAlert = DateTimeOffset.UtcNow;
        try
        {
            await using var command = dataSource.CreateCommand("""
                INSERT INTO hoso.notifications(user_id, kind, title, body, link)
                SELECT DISTINCT u.id, 'accesslog.loss', 'Nhật ký truy cập bị mất dòng',
                       $1::text, '/quan-tri/van-hanh'
                FROM hoso.users u JOIN hoso.user_roles ur ON ur.user_id = u.id AND ur.role_code = 'technical_admin'
                  AND ur.valid_from <= now() AND (ur.valid_until IS NULL OR ur.valid_until > now())
                WHERE u.active
                  AND NOT EXISTS (SELECT 1 FROM hoso.notifications n WHERE n.user_id = u.id AND n.kind = 'accesslog.loss' AND n.created_at > now() - interval '1 hour')
                """);
            command.Parameters.AddWithValue($"Không ghi được {lost} dòng nhật ký truy cập sau khi thử lại (tổng bỏ vì đầy hàng đợi: {queue.Dropped}, không ghi được: {queue.Failed}). Kiểm tra kết nối cơ sở dữ liệu.");
            await command.ExecuteNonQueryAsync();
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "access_log_alert_failed");
        }
    }
}
