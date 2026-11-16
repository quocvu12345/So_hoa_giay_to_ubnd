using System.Diagnostics;
using Serilog.Context;

namespace HoSoSo.Api.Middleware;

/// <summary>
/// Mã tương quan nối log trình duyệt → Next.js → API → PostgreSQL (docs/06-log-va-giam-sat.md).
/// Nhận từ header X-Correlation-Id (Next đã tạo) hoặc tự tạo; trả lại trong response.
/// </summary>
public sealed class CorrelationIdMiddleware(RequestDelegate next)
{
    public const string HeaderName = "X-Correlation-Id";

    /// <summary>Khóa trong HttpContext.Items giữ thời điểm bắt đầu request (Stopwatch ticks) để log HTTP ghi elapsedMs.</summary>
    public const string StartedKey = "hoso.request_started";

    public async Task InvokeAsync(HttpContext context)
    {
        context.Items[StartedKey] = Stopwatch.GetTimestamp();
        var incoming = context.Request.Headers[HeaderName].ToString();
        var correlationId = IsSafe(incoming) ? incoming : Guid.NewGuid().ToString();
        context.TraceIdentifier = correlationId;
        context.Response.Headers[HeaderName] = correlationId;
        Activity.Current?.SetTag("hoso.correlation_id", correlationId);

        using (LogContext.PushProperty("correlationId", correlationId))
        {
            await next(context);
        }
    }

    /// <summary>Chỉ nhận chuỗi ngắn gồm chữ, số, gạch ngang để không ghi rác hoặc ký tự điều khiển vào log.</summary>
    private static bool IsSafe(string value) =>
        value.Length is > 0 and <= 64 && value.All(c => char.IsAsciiLetterOrDigit(c) || c == '-');
}
