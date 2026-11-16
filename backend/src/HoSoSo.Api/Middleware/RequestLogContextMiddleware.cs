using System.Diagnostics;
using System.Security.Claims;
using HoSoSo.Api.Security;
using Serilog.Context;

namespace HoSoSo.Api.Middleware;

/// <summary>
/// BE-03. Chạy sau bước xác thực và chọn phân công: mọi dòng log trong phần còn lại của request (kể cả lỗi từ handler)
/// mang <c>userSubject</c> và <c>assignment</c> (chỉ là mã định danh, không có tên hay email).
/// Request vượt ngưỡng (<c>Observability:SlowRequestMs</c>, mặc định 2000 ms) ghi thêm một dòng <c>slow_request</c> mức Warning.
/// Chỉ ghi đường dẫn, không ghi chuỗi truy vấn (có thể chứa từ khóa tra cứu hoặc mã QR).
/// </summary>
public sealed class RequestLogContextMiddleware(RequestDelegate next, IConfiguration configuration, ILogger<RequestLogContextMiddleware> logger)
{
    private readonly long _slowMs = configuration.GetValue("Observability:SlowRequestMs", 2000L);

    public async Task InvokeAsync(HttpContext context)
    {
        var subject = context.User.FindFirstValue(HoSoClaims.Subject);
        var assignment = context.User.FindFirstValue(HoSoClaims.Assignment);
        var started = Stopwatch.GetTimestamp();

        using (LogContext.PushProperty("userSubject", subject))
        using (LogContext.PushProperty("assignment", assignment))
        {
            try
            {
                await next(context);
            }
            finally
            {
                var elapsed = Stopwatch.GetElapsedTime(started);
                if (elapsed.TotalMilliseconds > _slowMs && !context.Request.Path.StartsWithSegments("/api/v1/events"))
                {
                    // /events là luồng SSE mở lâu theo thiết kế, không phải request chậm.
                    logger.LogWarning("slow_request {method} {path} {elapsedMs}",
                        context.Request.Method, context.Request.Path.Value, (long)elapsed.TotalMilliseconds);
                }
            }
        }
    }
}
