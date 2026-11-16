using HoSoSo.Application.Common;
using Microsoft.Extensions.Options;

namespace HoSoSo.Api.Middleware;

/// <summary>
/// Chống CSRF cho request ghi dữ liệu dùng cookie phiên:
/// chấp nhận khi có header X-CSRF (trình duyệt không gửi được header tùy chỉnh sang trang khác
/// nếu không có CORS, mà API không bật CORS) hoặc Origin trùng origin công khai của ứng dụng
/// (form POST đăng xuất). Ngoài ra trả 403 csrf_failed.
/// </summary>
public sealed class CsrfMiddleware(RequestDelegate next, IOptions<AuthOptions> authOptions)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var method = context.Request.Method;
        var safe = HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method);
        // /api/v1/ops chỉ nhận khóa máy trong header, không dùng cookie phiên nên không có gì để CSRF lợi dụng.
        if (safe || !context.Request.Path.StartsWithSegments("/api") || IsOidcCallback(context) || context.Request.Path.StartsWithSegments("/api/v1/ops"))
        {
            await next(context);
            return;
        }

        var hasHeader = context.Request.Headers.ContainsKey("X-CSRF");
        var origin = context.Request.Headers.Origin.ToString();
        var publicOrigin = authOptions.Value.PublicOrigin;
        var sameOrigin = origin.Length > 0 && publicOrigin.Length > 0 && string.Equals(origin, publicOrigin, StringComparison.OrdinalIgnoreCase);

        if (hasHeader || sameOrigin)
        {
            await next(context);
            return;
        }

        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await Results.Problem(
            statusCode: StatusCodes.Status403Forbidden,
            title: "Yêu cầu bị chặn",
            detail: "Yêu cầu không đến từ ứng dụng Hồ sơ số. Tải lại trang rồi thử lại.",
            type: $"https://hoso.local/errors/{ErrorCodes.CsrfFailed}").ExecuteAsync(context);
    }

    /// <summary>Callback OIDC dùng form_post từ IdP; được bảo vệ bằng state + PKCE.</summary>
    private static bool IsOidcCallback(HttpContext context) =>
        context.Request.Path.StartsWithSegments("/api/v1/auth/callback") ||
        context.Request.Path.StartsWithSegments("/api/v1/auth/signed-out");
}
