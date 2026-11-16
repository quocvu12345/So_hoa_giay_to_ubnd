using System.Net;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.Extensions.Options;

namespace HoSoSo.Api.Endpoints;

/// <summary>
/// Đăng nhập/đăng xuất. Bản thật: OIDC (Keycloak/SSO cơ quan) → cookie httpOnly.
/// Auth:Mode=Dev (chỉ Development): chọn tài khoản mẫu, không cần Keycloak.
/// </summary>
internal static class AuthEndpoints
{
    public static RouteGroupBuilder MapAuthEndpoints(this RouteGroupBuilder api, IHostEnvironment environment)
    {
        var auth = api.MapGroup("/auth").WithTags("Đăng nhập").AllowAnonymous();

        auth.MapGet("/login", async (string? returnUrl, bool? mfa, IOptions<AuthOptions> options, IIdentityService identity, CancellationToken cancellationToken) =>
        {
            var target = SafeReturnUrl(returnUrl);
            if (options.Value.IsDev)
            {
                return Results.Content(DevAccountPicker(await identity.ListDemoUsersAsync(cancellationToken), target), "text/html; charset=utf-8");
            }
            var properties = new AuthenticationProperties { RedirectUri = target };
            // mfa=true: đăng nhập lại để nâng mức xác thực (phân công đặc quyền cần MFA, BE-95); gửi acr_values cho nhà cung cấp danh tính.
            if (mfa == true) properties.Items["hoso_step_up"] = "1";
            return Results.Challenge(properties, [OpenIdConnectDefaults.AuthenticationScheme]);
        }).WithSummary("Bắt đầu đăng nhập, quay lại returnUrl sau khi xong; mfa=true để nâng mức xác thực");

        auth.MapPost("/logout", async (HttpContext http, IOptions<AuthOptions> options) =>
        {
            if (options.Value.IsDev)
            {
                await http.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return Results.Redirect("/dang-nhap");
            }
            // Một lần đăng xuất cho cả hai scheme: cookie (thu hồi phiên trong CSDL) rồi OIDC (chuyển tới end_session của IdP kèm id_token_hint
            // lấy từ vé phía máy chủ, nên Keycloak không hỏi xác nhận).
            return Results.SignOut(new AuthenticationProperties { RedirectUri = "/dang-nhap" },
                [CookieAuthenticationDefaults.AuthenticationScheme, OpenIdConnectDefaults.AuthenticationScheme]);
        }).WithSummary("Đăng xuất: thu hồi phiên và kết thúc phiên ở nhà cung cấp danh tính");

        if (environment.IsDevelopment())
        {
            auth.MapGet("/dev-login", async (HttpContext http, string username, string? returnUrl, bool? mfa, IOptions<AuthOptions> options,
                IIdentityService identity, CancellationToken cancellationToken) =>
            {
                if (!options.Value.IsDev) return Results.NotFound();
                // Chỉ tài khoản GIẢ LẬP (users.is_demo) mới đăng nhập được bằng đường này.
                var user = await identity.FindByUsernameAsync(username, cancellationToken);
                if (user is not { IsDemo: true, Active: true }) return Results.NotFound();

                var claims = new List<Claim>
                {
                    new(HoSoClaims.Subject, user.Id.ToString()),
                    new(HoSoClaims.Username, user.Username),
                    new(HoSoClaims.DisplayName, user.DisplayName),
                };
                if (mfa != false) claims.Add(new Claim(HoSoClaims.Mfa, "1"));     // dev-login coi như đã qua MFA, trừ khi thử cố ý (?mfa=false) để kiểm tra bước nâng mức
                var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme, HoSoClaims.Username, HoSoClaims.Role));
                await http.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal);
                await identity.RecordLoginAsync(user.Id, http.Connection.RemoteIpAddress?.ToString(), http.TraceIdentifier, cancellationToken);
                return Results.Redirect(SafeReturnUrl(returnUrl));
            }).WithSummary("CHỈ DEV: đăng nhập bằng người dùng giả lập trong CSDL");
        }
        return api;
    }

    /// <summary>Chỉ nhận đường dẫn nội bộ, chặn chuyển hướng ra trang ngoài (open redirect).</summary>
    internal static string SafeReturnUrl(string? value) =>
        value is { Length: > 0 } && value[0] == '/' && !value.StartsWith("//", StringComparison.Ordinal) && !value.StartsWith("/\\", StringComparison.Ordinal)
            ? value
            : "/viec-cua-toi";

    private static string DevAccountPicker(IReadOnlyList<LoginUser> users, string returnUrl)
    {
        var html = new StringBuilder("<!doctype html><html lang=\"vi\"><meta charset=\"utf-8\"><title>Đăng nhập dev</title><body><h1>Chọn người dùng giả lập (chỉ môi trường dev)</h1><ul>");
        foreach (var user in users)
        {
            var href = $"/api/v1/auth/dev-login?username={Uri.EscapeDataString(user.Username)}&returnUrl={Uri.EscapeDataString(returnUrl)}";
            html.Append($"<li><a href=\"{WebUtility.HtmlEncode(href)}\">{WebUtility.HtmlEncode(user.DisplayName)}</a> · {WebUtility.HtmlEncode(user.Username)}</li>");
        }
        return html.Append("</ul></body></html>").ToString();
    }
}
