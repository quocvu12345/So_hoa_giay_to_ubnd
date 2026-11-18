using System.Threading.Channels;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace HoSoSo.Infrastructure.Auditing;

/// <param name="ErrorId">Mã 8 ký tự hex hoa người dùng nhận trong ProblemDetails.</param>
/// <param name="CorrelationId">Mã tương quan của request; nối được tới <c>access_events.correlation_id</c> và log.</param>
public sealed record ErrorEventRecord(string ErrorId, string CorrelationId, int Status, string ErrorCode, string Method, string Path,
    Guid? UserId, string? Assignment, DateTimeOffset At);

/// <summary>
/// BE-117. Lưu mỗi Mã lỗi đã trả cho người dùng để quản trị tra ngược ra request và người. Chạy nền: bộ xử lý lỗi chỉ xếp một dòng rồi trả lời,
/// nên lỗi vì CSDL sập không bị chậm thêm. Mất dòng chấp nhận được vì log vẫn có cùng Mã lỗi (<c>request_rejected</c>, <c>unhandled_exception</c>):
/// khác với nhật ký truy cập, đây là công cụ hỗ trợ, không phải bằng chứng kiểm toán. Đầy hàng đợi thì bỏ dòng cũ nhất.
/// </summary>
public sealed class ErrorEventRecorder(NpgsqlDataSource dataSource, ILogger<ErrorEventRecorder> logger) : BackgroundService
{
    private const int Capacity = 1_000;
    private const int BatchSize = 50;
    private readonly Channel<ErrorEventRecord> _channel =
        Channel.CreateBounded<ErrorEventRecord>(new BoundedChannelOptions(Capacity) { FullMode = BoundedChannelFullMode.DropOldest, SingleReader = true });
    private long _pending;

    public void Record(ErrorEventRecord record)
    {
        Interlocked.Increment(ref _pending);
        _channel.Writer.TryWrite(record);
    }

    /// <summary>Chờ ghi xong các dòng đã xếp (kiểm thử).</summary>
    public async Task DrainAsync(TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (Interlocked.Read(ref _pending) > 0 && DateTime.UtcNow < deadline) await Task.Delay(20);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var batch = new List<ErrorEventRecord>(BatchSize);
        try
        {
            while (await _channel.Reader.WaitToReadAsync(stoppingToken))
            {
                while (batch.Count < BatchSize && _channel.Reader.TryRead(out var item)) batch.Add(item);
                await WriteAsync(batch, stoppingToken);
                batch.Clear();
            }
        }
        catch (OperationCanceledException) { /* tắt máy chủ */ }
    }

    private async Task WriteAsync(List<ErrorEventRecord> batch, CancellationToken ct)
    {
        try
        {
            foreach (var e in batch)
            {
                await using var command = dataSource.CreateCommand(
                    "INSERT INTO hoso.error_events(error_id, correlation_id, status, error_code, method, path, user_id, assignment, happened_at) " +
                    "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)");
                command.Parameters.AddWithValue(e.ErrorId);
                command.Parameters.AddWithValue((object?)e.CorrelationId ?? DBNull.Value);
                command.Parameters.AddWithValue((short)e.Status);
                command.Parameters.AddWithValue(e.ErrorCode);
                command.Parameters.AddWithValue(e.Method);
                command.Parameters.AddWithValue(e.Path);
                command.Parameters.AddWithValue(e.UserId is { } id ? id : DBNull.Value);
                command.Parameters.AddWithValue((object?)e.Assignment ?? DBNull.Value);
                command.Parameters.AddWithValue(e.At.UtcDateTime);
                await command.ExecuteNonQueryAsync(ct);
            }
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogWarning(exception, "error_event_write_failed {Count}", batch.Count);   // lỗi gốc đã có trong log theo Mã lỗi
        }
        finally
        {
            Interlocked.Add(ref _pending, -batch.Count);
        }
    }
}
