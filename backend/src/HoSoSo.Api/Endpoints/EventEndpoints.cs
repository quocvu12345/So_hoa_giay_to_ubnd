namespace HoSoSo.Api.Endpoints;

/// <summary>
/// Luồng sự kiện Server-Sent Events cho tiến độ đọc PDF, thông báo và thay đổi hồ sơ (ADR-08, BE-23).
/// Trình duyệt mở EventSource("/api/v1/events") cùng origin, cookie phiên tự gửi kèm.
/// Mỗi người chỉ nhận sự kiện của mình; hồ sơ chỉ báo cho người có hồ sơ đó trong phạm vi.
/// Hỗ trợ Last-Event-ID: kết nối lại thì nhận bù tối đa 50 sự kiện gần nhất.
/// </summary>
internal static class EventEndpoints
{
    private static readonly TimeSpan Heartbeat = TimeSpan.FromSeconds(25);

    public static RouteGroupBuilder MapEventEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/events", async (HttpContext http, ICurrentUser user, IEventBus bus, CancellationToken cancellationToken) =>
        {
            http.Response.Headers.ContentType = "text/event-stream";
            http.Response.Headers.CacheControl = "no-store";
            http.Response.Headers["X-Accel-Buffering"] = "no"; // để proxy không gom đệm
            long? last = long.TryParse(http.Request.Headers["Last-Event-ID"].FirstOrDefault(), out var parsed) ? parsed : null;
            using var subscription = bus.Subscribe(user.RequireUserId(), user.ActiveAssignmentId ?? "", last);

            await http.Response.WriteAsync("retry: 5000\n\n", cancellationToken);
            foreach (var missed in subscription.Replay) await WriteAsync(http, missed, cancellationToken);
            await http.Response.Body.FlushAsync(cancellationToken);

            try
            {
                while (!cancellationToken.IsCancellationRequested)
                {
                    using var window = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                    window.CancelAfter(Heartbeat);
                    try
                    {
                        if (!await subscription.Reader.WaitToReadAsync(window.Token)) break;
                        while (subscription.Reader.TryRead(out var message)) await WriteAsync(http, message, cancellationToken);
                    }
                    catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
                    {
                        await http.Response.WriteAsync(": heartbeat\n\n", cancellationToken);   // giữ kết nối qua proxy
                    }
                    await http.Response.Body.FlushAsync(cancellationToken);
                }
            }
            catch (OperationCanceledException)
            {
                // Người dùng đóng trang: kết thúc bình thường.
            }
        })
        .WithTags("Sự kiện")
        .WithSummary("Luồng SSE: job.progress, job.completed, job.failed, notification.created, dossier.changed, resync");
        return api;
    }

    private static Task WriteAsync(HttpContext http, ServerEvent message, CancellationToken ct) =>
        http.Response.WriteAsync($"id: {message.Id}\nevent: {message.Type}\ndata: {message.DataJson}\n\n", ct);
}
