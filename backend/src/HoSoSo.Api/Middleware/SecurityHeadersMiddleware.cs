namespace HoSoSo.Api.Middleware;

/// <summary>Header bảo mật cho phản hồi API (JSON, tệp). Trang HTML do Next.js đặt CSP riêng.</summary>
public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;
        headers.XContentTypeOptions = "nosniff";
        headers.XFrameOptions = "DENY";
        headers["Referrer-Policy"] = "no-referrer";
        // /docs (Scalar, chỉ bật khi dev) cần script và style của chính nó.
        if (!context.Request.Path.StartsWithSegments("/docs"))
        {
            headers.ContentSecurityPolicy = "default-src 'none'; frame-ancestors 'none'";
        }
        // Dữ liệu hồ sơ không được nằm lại trong cache trình duyệt hay proxy.
        headers.CacheControl = "no-store";
        return next(context);
    }
}
