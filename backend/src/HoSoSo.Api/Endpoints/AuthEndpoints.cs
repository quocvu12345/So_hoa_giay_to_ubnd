using System.Net;
using System.Security.Claims;
using System.Text;
using HoSoSo.Domain.Identity;
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
                return Results.Content(await DevAccountPickerAsync(identity, target, cancellationToken), "text/html; charset=utf-8");
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

    /// <summary>Thứ tự và tên nhóm trên trang "Đăng nhập dev": theo bước của luồng hồ sơ.</summary>
    private static readonly (string Role, string Label, string Hint)[] PickerRoles =
    [
        (RoleCode.Employee, "Chuyên viên", "tiếp nhận PDF, đối chiếu, lập hồ sơ, trình"),
        (RoleCode.Manager, "Trưởng phòng / Trưởng Ban", "kiểm tra, trả lại hoặc trình tiếp"),
        (RoleCode.Clerk, "Văn thư / lưu trữ", "lô quét, kho bản giấy, nộp lưu, mượn trả"),
        (RoleCode.Chair, "Chủ tịch UBND", "cho ý kiến, bảng tổng hợp"),
        (RoleCode.Council, "Lãnh đạo HĐND", "cho ý kiến hồ sơ HĐND"),
        (RoleCode.TechnicalAdmin, "Quản trị kỹ thuật", "người dùng, danh mục, vận hành; không đọc nội dung hồ sơ"),
    ];

    /// <summary>
    /// Trang chọn tài khoản GIẢ LẬP (chỉ Auth:Mode=Dev). Nhóm theo vai trò, mỗi dòng ghi phòng/ban, để thử từng bước của luồng bằng đúng người
    /// (cần các tài khoản riêng: backend/scripts/seed-dev-accounts.sh). Tài khoản nhiều phân công (dev_admin) vào rồi đổi phân công ở thanh trên cùng.
    /// HTML thuần vì API đặt CSP default-src 'none'.
    /// </summary>
    private static async Task<string> DevAccountPickerAsync(IIdentityService identity, string returnUrl, CancellationToken ct)
    {
        string Link(LoginUser user, string text) =>
            $"<a href=\"{WebUtility.HtmlEncode($"/api/v1/auth/dev-login?username={Uri.EscapeDataString(user.Username)}&returnUrl={Uri.EscapeDataString(returnUrl)}")}\">{WebUtility.HtmlEncode(text)}</a>";

        var single = new List<(string Role, string Scope, LoginUser User)>();
        var multi = new List<(LoginUser User, int Count)>();
        var none = new List<LoginUser>();
        foreach (var user in await identity.ListDemoUsersAsync(ct))
        {
            var assignments = await identity.ListAssignmentsAsync(user.Id, ct);
            if (assignments.Count == 0) none.Add(user);
            else if (assignments.Count > 1) multi.Add((user, assignments.Count));
            else single.Add((assignments[0].Role, assignments[0].DepartmentName ?? assignments[0].OrganizationName ?? "Toàn hệ thống", user));
        }

        var html = new StringBuilder("<!doctype html><html lang=\"vi\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\">")
            .Append("<title>Đăng nhập dev</title><body><h1>Đăng nhập dev: chọn người để thử</h1>")
            .Append("<p>Chỉ có ở môi trường dev. Mỗi tài khoản GIẢ LẬP đúng một vai trò; thử luồng nhiều bước thì đăng nhập lần lượt từng người ")
            .Append("(ví dụ chuyên viên trình, rồi trưởng phòng cùng phòng kiểm tra). Muốn thêm người: <code>backend/scripts/seed-dev-accounts.sh --apply</code>.</p>");
        foreach (var (role, label, hint) in PickerRoles)
        {
            var rows = single.Where(r => r.Role == role).OrderBy(r => r.Scope, StringComparer.Create(new System.Globalization.CultureInfo("vi-VN"), false)).ThenBy(r => r.User.Username).ToList();
            if (rows.Count == 0) continue;
            html.Append($"<h2>{WebUtility.HtmlEncode(label)}</h2><p><small>{WebUtility.HtmlEncode(hint)}</small></p><ul>");
            foreach (var r in rows) html.Append($"<li>{Link(r.User, r.Scope)} <small>· {WebUtility.HtmlEncode(r.User.Username)}</small></li>");
            html.Append("</ul>");
        }
        if (multi.Count > 0)
        {
            html.Append("<h2>Nhiều phân công</h2><p><small>Vào rồi chọn phân công (vai trò, phòng) ở ô \"Vai trò\" trên thanh trên cùng hoặc trang Tài khoản.</small></p><ul>");
            foreach (var (user, count) in multi.OrderBy(m => m.User.Username))
                html.Append($"<li>{Link(user, user.DisplayName)} <small>· {WebUtility.HtmlEncode(user.Username)} · {count} phân công</small></li>");
            html.Append("</ul>");
        }
        if (none.Count > 0)
        {
            html.Append("<h2>Chưa có phân công</h2><ul>");
            foreach (var user in none.OrderBy(u => u.Username))
                html.Append($"<li>{Link(user, user.DisplayName)} <small>· {WebUtility.HtmlEncode(user.Username)}</small></li>");
            html.Append("</ul>");
        }
        return html.Append("</body></html>").ToString();
    }
}
