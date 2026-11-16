using System.Net;
using System.Security.Claims;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Infrastructure.Messaging;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-12: phiên đăng nhập lưu trong CSDL (auth_sessions): cookie chỉ mang khóa, thu hồi được ngay, hết hạn, dọn dẹp.</summary>
public sealed class SessionTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private const string CookieName = "hoso_session_test";

    /// <summary>Đăng nhập rồi lấy nguyên giá trị cookie phiên để tự gửi lại (giả lập cookie bị lộ hoặc trình duyệt cũ).</summary>
    private async Task<string> LoginCookieAsync(string username)
    {
        api.RequireDatabase();
        var client = api.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = false });
        var response = await client.GetAsync($"/api/v1/auth/dev-login?username={username}");
        response.StatusCode.ShouldBe(HttpStatusCode.Redirect);
        var header = response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith(CookieName + "=", StringComparison.Ordinal));
        return header[(CookieName.Length + 1)..header.IndexOf(';')];
    }

    private async Task<HttpStatusCode> MeAsync(string? cookie)
    {
        var client = api.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = false });
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/me");
        if (cookie is not null) request.Headers.Add("Cookie", $"{CookieName}={cookie}");
        return (await client.SendAsync(request, TestContext.Current.CancellationToken)).StatusCode;
    }

    private Task<long> ActiveSessionsAsync(string username) =>
        api.ScalarAsync<long>("SELECT count(*) FROM hoso.auth_sessions s JOIN hoso.users u ON u.id = s.user_id WHERE u.username = $1 AND s.revoked_at IS NULL", username);

    [Fact]
    public async Task Cookie_chi_mang_khoa_phien_va_ve_xac_thuc_nam_trong_CSDL()
    {
        var cookie = await LoginCookieAsync("demo_cv_ht");
        cookie.Length.ShouldBeLessThan(400, "cookie chỉ có khóa phiên đã mã hóa, không chứa claim hay token");
        (await MeAsync(cookie)).ShouldBe(HttpStatusCode.OK);
        (await ActiveSessionsAsync("demo_cv_ht")).ShouldBeGreaterThanOrEqualTo(1);
        var ticketSize = await api.ScalarAsync<int>("SELECT max(length(ticket)) FROM hoso.auth_sessions");
        ticketSize.ShouldBeGreaterThan(0);

        // Cookie bịa hoặc bị sửa: từ chối, và không ném lỗi 500.
        (await MeAsync(cookie[..^3] + "abc")).ShouldBe(HttpStatusCode.Unauthorized);
        (await MeAsync("khong-phai-cookie-that")).ShouldBe(HttpStatusCode.Unauthorized);
        (await MeAsync(null)).ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Dang_xuat_thu_hoi_phien_nen_cookie_cu_gui_lai_bi_tu_choi()
    {
        var cookie = await LoginCookieAsync("demo_cv_kt");
        var other = await LoginCookieAsync("demo_cv_kt");               // phiên thứ hai của cùng người, ở "thiết bị" khác
        var client = api.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = false });
        var logout = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/logout");
        logout.Headers.Add("X-CSRF", "1");
        logout.Headers.Add("Cookie", $"{CookieName}={cookie}");
        (await client.SendAsync(logout, TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Redirect);

        (await MeAsync(cookie)).ShouldBe(HttpStatusCode.Unauthorized, "cookie cũ KHÔNG còn dùng được dù chưa hết hạn: đây là điểm khác với cookie tự chứa vé");
        (await MeAsync(other)).ShouldBe(HttpStatusCode.OK, "đăng xuất một phiên không động tới phiên khác của cùng người");
        (await api.ScalarAsync<string>("SELECT revoked_reason FROM hoso.auth_sessions WHERE revoked_at IS NOT NULL ORDER BY revoked_at DESC LIMIT 1")).ShouldBe("logout");
    }

    [Fact]
    public async Task Quan_tri_buoc_dang_xuat_moi_phien_cua_mot_nguoi_va_chi_quan_tri_nguoi_dung_lam_duoc()
    {
        var first = await LoginCookieAsync("demo_cv_ht");
        var second = await LoginCookieAsync("demo_cv_ht");
        var bystander = await LoginCookieAsync("demo_cv_vp");
        var target = await api.UserIdAsync("demo_cv_ht");
        var admin = await api.LoginAsync("demo_admin");

        var result = await (await admin.PostJsonAsync($"/api/v1/admin/users/{target}/revoke-sessions")).ReadAsync<Dictionary<string, int>>();
        result["revoked"].ShouldBeGreaterThanOrEqualTo(2);
        (await MeAsync(first)).ShouldBe(HttpStatusCode.Unauthorized);
        (await MeAsync(second)).ShouldBe(HttpStatusCode.Unauthorized);
        (await MeAsync(bystander)).ShouldBe(HttpStatusCode.OK, "phiên của người khác không bị động tới");
        (await (await api.LoginAsync("demo_cv_ht")).GetAsync("/api/v1/me")).StatusCode.ShouldBe(HttpStatusCode.OK);   // đăng nhập lại bình thường

        (await admin.PostJsonAsync($"/api/v1/admin/users/{Guid.NewGuid()}/revoke-sessions")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var employee = await api.LoginAsync("demo_cv_ht");
        (await employee.PostJsonAsync($"/api/v1/admin/users/{target}/revoke-sessions")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Phien_het_han_bi_tu_choi_va_dich_vu_don_chi_xoa_dong_cu()
    {
        var expired = await LoginCookieAsync("demo_cv_ht");
        var alive = await LoginCookieAsync("demo_cv_kt");
        var revokedOld = await LoginCookieAsync("demo_cv_vx");
        var revokedRecent = await LoginCookieAsync("demo_cv_vp");
        await api.ExecuteAsync("UPDATE hoso.auth_sessions SET expires_at = now() - interval '2 days' WHERE user_id = (SELECT id FROM hoso.users WHERE username = 'demo_cv_ht')");
        await api.ExecuteAsync("UPDATE hoso.auth_sessions SET revoked_at = now() - interval '8 days', revoked_reason = 'logout' WHERE user_id = (SELECT id FROM hoso.users WHERE username = 'demo_cv_vx')");
        await api.ExecuteAsync("UPDATE hoso.auth_sessions SET revoked_at = now() - interval '1 day', revoked_reason = 'logout' WHERE user_id = (SELECT id FROM hoso.users WHERE username = 'demo_cv_vp')");

        (await MeAsync(expired)).ShouldBe(HttpStatusCode.Unauthorized, "hết hạn trong CSDL thì hết hiệu lực dù cookie còn");
        (await MeAsync(alive)).ShouldBe(HttpStatusCode.OK);
        (await MeAsync(revokedOld)).ShouldBe(HttpStatusCode.Unauthorized);
        (await MeAsync(revokedRecent)).ShouldBe(HttpStatusCode.Unauthorized);

        var cleanup = api.Services.GetServices<IHostedService>().OfType<SessionCleanupService>().Single();
        (await cleanup.RunOnceAsync(TestContext.Current.CancellationToken)).ShouldBeGreaterThanOrEqualTo(2, "dòng hết hạn quá 1 ngày và dòng thu hồi quá 7 ngày");
        async Task<long> RowsAsync(string username) =>
            await api.ScalarAsync<long>("SELECT count(*) FROM hoso.auth_sessions s JOIN hoso.users u ON u.id = s.user_id WHERE u.username = $1", username);
        (await RowsAsync("demo_cv_ht")).ShouldBe(0, "hết hạn quá 1 ngày");
        (await RowsAsync("demo_cv_vx")).ShouldBe(0, "thu hồi quá 7 ngày");
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.auth_sessions s JOIN hoso.users u ON u.id = s.user_id WHERE u.username = 'demo_cv_vp'")).ShouldBe(1, "mới thu hồi thì còn giữ để điều tra");
        (await MeAsync(alive)).ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Kho_ve_luu_doc_gia_han_va_xoa_dung_va_nguoi_bi_khoa_khong_doc_duoc_ve()
    {
        api.RequireDatabase();
        var store = api.Services.GetRequiredService<ITicketStore>();
        var userId = await api.UserIdAsync("demo_cv_ht");
        var ticket = new AuthenticationTicket(
            new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", userId.ToString()), new Claim("preferred_username", "demo_cv_ht"), new Claim("name", "Tên thử")], "test")),
            new AuthenticationProperties { ExpiresUtc = DateTimeOffset.UtcNow.AddHours(1) },
            CookieAuthenticationDefaults.AuthenticationScheme);
        ticket.Properties.StoreTokens([new AuthenticationToken { Name = "id_token", Value = "id-token-thu" }]);

        var key = await store.StoreAsync(ticket);
        key.Length.ShouldBeGreaterThanOrEqualTo(43, "256 bit ngẫu nhiên, mã hóa base64url");
        var read = await store.RetrieveAsync(key);
        read.ShouldNotBeNull();
        read.Principal.FindFirst("name")!.Value.ShouldBe("Tên thử");
        read.Properties.GetTokenValue("id_token").ShouldBe("id-token-thu");

        ticket.Properties.ExpiresUtc = DateTimeOffset.UtcNow.AddHours(5);
        await store.RenewAsync(key, ticket);
        var expires = await api.ScalarAsync<DateTime>("SELECT expires_at FROM hoso.auth_sessions WHERE id = $1", key);
        expires.ShouldBeGreaterThan(DateTime.UtcNow.AddHours(4));

        // Người bị khóa: dù còn dòng chưa thu hồi, vé không được trả (phòng khi khóa tài khoản bằng đường khác ngoài API).
        await api.ExecuteAsync("UPDATE hoso.users SET active = false WHERE id = $1", userId);
        try { (await store.RetrieveAsync(key)).ShouldBeNull(); }
        finally { await api.ExecuteAsync("UPDATE hoso.users SET active = true WHERE id = $1", userId); }
        (await store.RetrieveAsync(key)).ShouldNotBeNull();

        await store.RemoveAsync(key);
        (await store.RetrieveAsync(key)).ShouldBeNull();
        (await api.ScalarAsync<string>("SELECT revoked_reason FROM hoso.auth_sessions WHERE id = $1", key)).ShouldBe("logout");
        (await store.RetrieveAsync("khoa-khong-ton-tai-0123456789abcdef0123456789")).ShouldBeNull();
    }
}
