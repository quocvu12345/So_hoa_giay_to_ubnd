using System.Threading.Channels;

namespace HoSoSo.Api.IntegrationTests.Support;

public sealed record SseEvent(long Id, string Type, string Data);

/// <summary>Máy khách SSE tối giản cho kiểm thử: đọc luồng /api/v1/events và cho chờ một loại sự kiện.</summary>
public sealed class SseClient : IAsyncDisposable
{
    private readonly CancellationTokenSource _cts = new();
    private readonly Channel<SseEvent> _events = Channel.CreateUnbounded<SseEvent>();
    private readonly List<SseEvent> _seen = [];
    private HttpResponseMessage? _response;

    public IReadOnlyList<SseEvent> Seen => _seen;

    public static async Task<SseClient> ConnectAsync(HttpClient http, long? lastEventId = null)
    {
        var client = new SseClient();
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/events");
        if (lastEventId is { } id) request.Headers.Add("Last-Event-ID", id.ToString());
        client._response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, TestContext.Current.CancellationToken);
        client._response.EnsureSuccessStatusCode();
        client._response.Content.Headers.ContentType!.MediaType.ShouldBe("text/event-stream");
        _ = client.PumpAsync();
        return client;
    }

    private async Task PumpAsync()
    {
        try
        {
            await using var stream = await _response!.Content.ReadAsStreamAsync(_cts.Token);
            using var reader = new StreamReader(stream);
            long id = 0; string? type = null; string? data = null;
            while (await reader.ReadLineAsync(_cts.Token) is { } line)
            {
                if (line.StartsWith("id: ")) id = long.Parse(line[4..]);
                else if (line.StartsWith("event: ")) type = line[7..];
                else if (line.StartsWith("data: ")) data = line[6..];
                else if (line.Length == 0 && type is not null)
                {
                    var message = new SseEvent(id, type, data ?? "");
                    lock (_seen) _seen.Add(message);
                    _events.Writer.TryWrite(message);
                    type = null; data = null;
                }
            }
        }
        catch (Exception exception) when (exception is OperationCanceledException or IOException or ObjectDisposedException) { /* đóng kết nối */ }
    }

    /// <summary>Chờ sự kiện loại này (bỏ qua sự kiện khác). Hết giờ thì ném lỗi kèm danh sách đã nhận.</summary>
    public async Task<SseEvent> WaitForAsync(string type, TimeSpan? timeout = null, Func<SseEvent, bool>? where = null)
    {
        using var window = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
        window.CancelAfter(timeout ?? TimeSpan.FromSeconds(10));
        try
        {
            await foreach (var message in _events.Reader.ReadAllAsync(window.Token))
            {
                if (message.Type == type && (where is null || where(message))) return message;
            }
        }
        catch (OperationCanceledException) { /* hết giờ */ }
        string received;
        lock (_seen) received = string.Join(", ", _seen.Select(e => e.Type));
        throw new Shouldly.ShouldAssertException($"Không nhận được sự kiện '{type}' trong thời gian chờ. Đã nhận: [{received}]");
    }

    /// <summary>Không có sự kiện nào thuộc loại cho trước trong khoảng yên lặng.</summary>
    public async Task<bool> StaysQuietAsync(string typePrefix, TimeSpan quiet)
    {
        await Task.Delay(quiet, TestContext.Current.CancellationToken);
        lock (_seen) return !_seen.Any(e => e.Type.StartsWith(typePrefix, StringComparison.Ordinal));
    }

    private int _disposed;

    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _disposed, 1) == 1) return;
        await _cts.CancelAsync();
        _response?.Dispose();
        _cts.Dispose();
    }
}

public static class Eventually
{
    /// <summary>Chạy lại điều kiện tới khi đúng hoặc hết giờ (cho tác vụ nền như outbox).</summary>
    public static async Task<T> ForAsync<T>(Func<Task<T>> read, Func<T, bool> ok, TimeSpan? timeout = null)
    {
        var deadline = DateTime.UtcNow + (timeout ?? TimeSpan.FromSeconds(15));
        T value;
        do
        {
            value = await read();
            if (ok(value)) return value;
            await Task.Delay(100, TestContext.Current.CancellationToken);
        } while (DateTime.UtcNow < deadline);
        return value;
    }
}
