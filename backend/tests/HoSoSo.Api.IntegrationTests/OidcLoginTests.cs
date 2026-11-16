using System.Net;
using HoSoSo.Api.IntegrationTests.Support;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>
/// BE-12: đăng nhập OIDC (code + PKCE) chạy thật qua một nhà cung cấp OIDC giả theo đúng giao thức (FakeOidcProvider).
/// Chưa phải Keycloak thật: kiểm chứng cấu hình, ánh xạ tài khoản, từ chối token sai và đăng xuất của API; khác biệt riêng của Keycloak
/// (realm, mapper, thời hạn token, đăng xuất khi chưa có id_token_hint) vẫn cần thử trên Keycloak của cơ quan.
/// </summary>
public sealed class OidcLoginTests(OidcLoginTests.OidcFactory api) : IClassFixture<OidcLoginTests.OidcFactory>
{
    public sealed class OidcFactory : DbApiFactory
    {
        public FakeOidcProvider Idp { get; } = new();

        public OidcFactory()
        {
            Idp.StartAsync().GetAwaiter().GetResult();     // cần biết địa chỉ trước khi dựng host của API
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseSetting("Auth:Mode", "Oidc");
            builder.UseSetting("Auth:Authority", Idp.BaseUrl);
            builder.UseSetting("Auth:ClientId", FakeOidcProvider.ClientId);
            builder.UseSetting("Auth:ClientSecret", FakeOidcProvider.ClientSecret);
            builder.UseSetting("Auth:MfaAcrValues", "2");           // mức acr "2" của IdP giả tương đương MFA
            builder.UseSetting("Auth:MfaAcrRequest", "2");          // gửi acr_values=2 khi yêu cầu nâng mức
        }

        public override async ValueTask DisposeAsync()
        {
            await base.DisposeAsync();
            await Idp.DisposeAsync();
        }
    }

    private FakeOidcProvider Idp => api.Idp;

    private async Task ProvisionAsync(string username, string subject, bool active = true)
    {
        api.RequireDatabase();
        await api.ExecuteAsync("UPDATE hoso.users SET external_auth_subject = $2, active = $3, last_login_at = NULL WHERE username = $1", username, subject, active);
        Idp.NextSubject = subject;
        Idp.NextTamper = FakeOidcProvider.Tamper.None;
        Idp.NextAmr = null;
        Idp.NextAcr = null;
    }

    /// <summary>Trình duyệt giả đi qua https: cookie tương quan và nonce của middleware OIDC luôn có cờ Secure nên không gửi lại qua http.</summary>
    private static HttpClient NewBrowser(WebApplicationFactory<Program> factory) =>
        factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true, BaseAddress = new Uri("https://localhost") });

    /// <summary>Đi hết vòng: /auth/login → IdP authorize → /auth/callback. Trả trình duyệt giả (giữ cookie) và phản hồi của callback.</summary>
    private async Task<(HttpClient Browser, HttpResponseMessage Callback, Uri CallbackUrl)> SignInAsync(WebApplicationFactory<Program>? factory = null, string returnUrl = "/viec-cua-toi")
    {
        var browser = NewBrowser(factory ?? api);
        var login = await browser.GetAsync($"/api/v1/auth/login?returnUrl={Uri.EscapeDataString(returnUrl)}");
        login.StatusCode.ShouldBe(HttpStatusCode.Redirect);
        login.Headers.Location!.ToString().ShouldStartWith(Idp.BaseUrl + "/authorize");

        using var idpClient = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false });
        var authorize = await idpClient.GetAsync(login.Headers.Location, TestContext.Current.CancellationToken);
        authorize.StatusCode.ShouldBe(HttpStatusCode.Redirect);
        var callbackUrl = authorize.Headers.Location!;
        var callback = await browser.GetAsync(callbackUrl.PathAndQuery);
        return (browser, callback, callbackUrl);
    }

    private static async Task ShouldHaveNoSessionAsync(HttpClient browser) =>
        (await browser.GetAsync("/api/v1/me")).StatusCode.ShouldBe(HttpStatusCode.Unauthorized, "không được có phiên đăng nhập");

    [Fact]
    public async Task Dang_nhap_thanh_cong_cho_nguoi_dung_da_cap_phat_ghi_moc_dang_nhap_va_co_phien()
    {
        await ProvisionAsync("demo_head_kt", "idp-sub-demo-head-kt");
        var before = Idp.AuthorizeRequests.Count;
        var (browser, callback, _) = await SignInAsync(returnUrl: "/ho-so");

        callback.StatusCode.ShouldBe(HttpStatusCode.Redirect);
        callback.Headers.Location!.ToString().ShouldBe("/ho-so", "quay lại đúng trang đã xin");
        var me = await browser.GetAsync("/api/v1/me");
        me.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await me.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("demo_head_kt");

        (await api.ScalarAsync<DateTime?>("SELECT last_login_at FROM hoso.users WHERE username = 'demo_head_kt'")).ShouldNotBeNull();
        var logins = await Eventually.ForAsync(
            () => api.ScalarAsync<long>("SELECT count(*) FROM hoso.access_events e JOIN hoso.users u ON u.id = e.user_id WHERE u.username = 'demo_head_kt' AND e.action = 'login'"),
            n => n >= 1, TimeSpan.FromSeconds(10));
        logins.ShouldBeGreaterThanOrEqualTo(1);

        // Yêu cầu gửi tới IdP: code + PKCE S256, có state và nonce, bí mật client không lộ trên URL của trình duyệt.
        var request = Idp.AuthorizeRequests.Skip(before).Last();
        request["response_type"].ShouldBe("code");
        request["code_challenge_method"].ShouldBe("S256");
        request["code_challenge"].Length.ShouldBeGreaterThanOrEqualTo(43);
        request["state"].ShouldNotBeNullOrEmpty();
        request["nonce"].ShouldNotBeNullOrEmpty();
        request["scope"].Split(' ').ShouldContain("openid");
        request["redirect_uri"].ShouldBe("https://localhost/api/v1/auth/callback");
        request.ContainsKey("client_secret").ShouldBeFalse();
        Idp.Rejections.ShouldBeEmpty();
    }

    [Fact]
    public async Task Tai_khoan_khong_co_trong_he_thong_hoac_bi_khoa_bi_tu_choi_va_khong_co_phien()
    {
        // sub lạ: đăng nhập Keycloak được nhưng quản trị chưa cấp tài khoản trong hệ thống.
        Idp.NextSubject = "idp-sub-nguoi-la";
        Idp.NextTamper = FakeOidcProvider.Tamper.None;
        var (stranger, strangerCallback, _) = await SignInAsync();
        strangerCallback.StatusCode.ShouldBe(HttpStatusCode.Redirect);
        strangerCallback.Headers.Location!.ToString().ShouldBe("/dang-nhap?loi=khong-co-quyen");
        await ShouldHaveNoSessionAsync(stranger);

        // Có tài khoản nhưng bị khóa.
        await ProvisionAsync("demo_cv_vp", "idp-sub-bi-khoa", active: false);
        var (locked, lockedCallback, _) = await SignInAsync();
        lockedCallback.Headers.Location!.ToString().ShouldBe("/dang-nhap?loi=khong-co-quyen");
        await ShouldHaveNoSessionAsync(locked);
        (await api.ScalarAsync<DateTime?>("SELECT last_login_at FROM hoso.users WHERE username = 'demo_cv_vp'")).ShouldBeNull("đăng nhập bị từ chối không được ghi mốc đăng nhập");
        await api.ExecuteAsync("UPDATE hoso.users SET active = true WHERE username = 'demo_cv_vp'");
    }

    [Theory]
    [InlineData(FakeOidcProvider.Tamper.WrongNonce)]
    [InlineData(FakeOidcProvider.Tamper.WrongAudience)]
    [InlineData(FakeOidcProvider.Tamper.WrongIssuer)]
    [InlineData(FakeOidcProvider.Tamper.Expired)]
    [InlineData(FakeOidcProvider.Tamper.SignedWithOtherKey)]
    [InlineData(FakeOidcProvider.Tamper.NoSubject)]
    public async Task Token_sai_nonce_doi_tuong_nguoi_phat_het_han_ky_sai_khoa_hoac_thieu_sub_bi_tu_choi(FakeOidcProvider.Tamper tamper)
    {
        await ProvisionAsync("demo_head_ht", "idp-sub-demo-head-ht");
        Idp.NextTamper = tamper;
        var (browser, callback, _) = await SignInAsync();
        callback.StatusCode.ShouldBe(HttpStatusCode.Redirect);
        callback.Headers.Location!.ToString().ShouldBe("/dang-nhap?loi=khong-co-quyen", $"id_token {tamper} phải bị từ chối");
        await ShouldHaveNoSessionAsync(browser);
        Idp.NextTamper = FakeOidcProvider.Tamper.None;
    }

    [Fact]
    public async Task Doi_state_hoac_dung_lai_mot_callback_thi_bi_tu_choi()
    {
        await ProvisionAsync("demo_head_ht", "idp-sub-demo-head-ht");

        // State bị sửa (CSRF đăng nhập): từ chối.
        var (forged, forgedCallback, _) = await SignInWithStateChangedAsync();
        forgedCallback.Headers.Location!.ToString().ShouldBe("/dang-nhap?loi=khong-co-quyen");
        await ShouldHaveNoSessionAsync(forged);

        // Dùng lại đúng callback đã thành công: mã đổi token và cookie tương quan đều chỉ dùng một lần.
        var (browser, first, callbackUrl) = await SignInAsync();
        first.Headers.Location!.ToString().ShouldBe("/viec-cua-toi");
        browser.DefaultRequestHeaders.Clear();
        var replay = await NewBrowser(api).GetAsync(callbackUrl.PathAndQuery);                // trình duyệt khác, không có cookie tương quan
        replay.Headers.Location!.ToString().ShouldBe("/dang-nhap?loi=khong-co-quyen");
        var replaySameBrowser = await browser.GetAsync(callbackUrl.PathAndQuery);             // cùng trình duyệt nhưng mã đã dùng
        replaySameBrowser.Headers.Location!.ToString().ShouldBe("/dang-nhap?loi=khong-co-quyen");
    }

    private async Task<(HttpClient Browser, HttpResponseMessage Callback, Uri Url)> SignInWithStateChangedAsync()
    {
        var browser = NewBrowser(api);
        var login = await browser.GetAsync("/api/v1/auth/login");
        using var idpClient = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false });
        var authorize = await idpClient.GetAsync(login.Headers.Location, TestContext.Current.CancellationToken);
        var location = authorize.Headers.Location!;
        var forgedQuery = System.Web.HttpUtility.ParseQueryString(location.Query);
        forgedQuery["state"] = "state-gia-mao";
        var forged = $"{location.AbsolutePath}?code={Uri.EscapeDataString(forgedQuery["code"]!)}&state={forgedQuery["state"]}";
        return (browser, await browser.GetAsync(forged), location);
    }

    [Fact]
    public async Task Sai_bi_mat_client_thi_IdP_tu_choi_va_dang_nhap_that_bai()
    {
        await ProvisionAsync("demo_head_ht", "idp-sub-demo-head-ht");
        var rejected = Idp.Rejections.Count;
        await using var wrongSecret = api.WithWebHostBuilder(b => b.UseSetting("Auth:ClientSecret", "bi-mat-sai"));
        var (browser, callback, _) = await SignInAsync(wrongSecret);
        callback.Headers.Location!.ToString().ShouldBe("/dang-nhap?loi=khong-co-quyen");
        await ShouldHaveNoSessionAsync(browser);
        Idp.Rejections.Skip(rejected).ShouldContain("sai bí mật client");
    }

    [Fact]
    public async Task O_che_do_OIDC_dang_nhap_gia_lap_bi_tat_va_goi_API_khi_chua_dang_nhap_tra_401_chu_khong_chuyen_huong()
    {
        api.RequireDatabase();
        var browser = NewBrowser(api);
        (await browser.GetAsync("/api/v1/auth/dev-login?username=demo_head_kt")).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        // Trình duyệt/Next gọi API khi hết phiên phải nhận 401 để tự chuyển trang đăng nhập; không được bị chuyển hướng sang IdP.
        var unauthenticated = await browser.GetAsync("/api/v1/dossiers");
        unauthenticated.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        unauthenticated.Headers.Location.ShouldBeNull();
    }

    [Fact]
    public async Task Dang_xuat_thu_hoi_phien_gui_id_token_hint_va_cookie_cu_khong_dung_lai_duoc()
    {
        await ProvisionAsync("demo_head_kt", "idp-sub-demo-head-kt");
        var (browser, callback, _) = await SignInAsync();
        (await browser.GetAsync("/api/v1/me")).StatusCode.ShouldBe(HttpStatusCode.OK);
        var sessionCookie = callback.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("hoso_session_test=", StringComparison.Ordinal));
        var cookieValue = sessionCookie[..sessionCookie.IndexOf(';')];
        cookieValue.Length.ShouldBeLessThan(420, "cookie chỉ có khóa phiên, không chứa id_token (một JWT dài hơn thế nhiều)");
        Idp.LastIdToken.ShouldNotBeNull();
        cookieValue.ShouldNotContain(Idp.LastIdToken[..30]);

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/logout");
        request.Headers.Add("X-CSRF", "1");
        var logout = await browser.SendAsync(request, TestContext.Current.CancellationToken);
        logout.StatusCode.ShouldBe(HttpStatusCode.Redirect);
        logout.Headers.Location!.ToString().ShouldStartWith(Idp.BaseUrl + "/logout");
        await ShouldHaveNoSessionAsync(browser);

        // Cookie cũ (như thể bị lộ hoặc trình duyệt khác còn giữ) không dùng lại được: phiên đã bị thu hồi trong CSDL.
        var replay = NewBrowser(api);
        var replayRequest = new HttpRequestMessage(HttpMethod.Get, "/api/v1/me");
        replayRequest.Headers.Add("Cookie", cookieValue);
        (await replay.SendAsync(replayRequest, TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);

        // IdP nhận id_token_hint đúng id_token đã phát (nên không hỏi xác nhận đăng xuất), rồi đưa người dùng về API và sang trang đăng nhập.
        using var idpClient = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false });
        var atIdp = await idpClient.GetAsync(logout.Headers.Location, TestContext.Current.CancellationToken);
        atIdp.StatusCode.ShouldBe(HttpStatusCode.Redirect);
        var received = Idp.LogoutRequests.Last();
        received["id_token_hint"].ShouldBe(Idp.LastIdToken);
        received["post_logout_redirect_uri"].ShouldBe("https://localhost/api/v1/auth/signed-out");
        atIdp.Headers.Location!.ToString().ShouldStartWith("https://localhost/api/v1/auth/signed-out");
        var back = await browser.GetAsync(atIdp.Headers.Location!.PathAndQuery);
        back.Headers.Location!.ToString().ShouldBe("/dang-nhap");
    }

    [Fact]
    public async Task Phien_OIDC_bi_thu_hoi_trong_CSDL_thi_het_hieu_luc_ngay()
    {
        await ProvisionAsync("demo_cv_vp", "idp-sub-demo-cv-vp");
        var (browser, _, _) = await SignInAsync();
        (await browser.GetAsync("/api/v1/me")).StatusCode.ShouldBe(HttpStatusCode.OK);

        // Khóa tài khoản và nút "buộc đăng xuất" đều chỉ đặt revoked_at (đường quản trị có test ở AdminSafetyTests và SessionTests);
        // ở đây kiểm chứng phiên đăng nhập qua OIDC cũng hết hiệu lực ngay, không phải chờ hết hạn cookie.
        var userId = await api.UserIdAsync("demo_cv_vp");
        await api.ExecuteAsync("UPDATE hoso.auth_sessions SET revoked_at = now(), revoked_reason = 'account_locked' WHERE user_id = $1 AND revoked_at IS NULL", userId);
        await ShouldHaveNoSessionAsync(browser);
    }

    // ---- BE-95: MFA cho phân công đặc quyền ----

    private sealed record MeInfo(bool MfaRequired, string[] Permissions);

    [Fact]
    public async Task Quan_tri_dang_nhap_khong_MFA_bi_chan_moi_thu_tru_me_va_co_MFA_thi_vao_duoc()
    {
        await ProvisionAsync("demo_admin", "idp-sub-demo-admin");
        var (plain, _, _) = await SignInAsync();
        var me = await (await plain.GetAsync("/api/v1/me")).ReadAsync<MeInfo>();
        me.MfaRequired.ShouldBeTrue("giao diện biết phải đăng nhập lại có MFA");
        me.Permissions.ShouldBeEmpty("quyền của phân công đặc quyền không được gắn khi chưa có MFA");
        var blocked = await plain.GetAsync("/api/v1/admin/users");
        blocked.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await blocked.ProblemCodeAsync()).ShouldBe("mfa_required");
        (await blocked.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("/api/v1/auth/login?mfa=true");
        (await plain.GetAsync("/api/v1/dossiers")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        // Chỉ mật khẩu (amr=pwd) vẫn chưa phải MFA.
        await ProvisionAsync("demo_admin", "idp-sub-demo-admin");
        Idp.NextAmr = ["pwd"];
        var (passwordOnly, _, _) = await SignInAsync();
        (await passwordOnly.GetAsync("/api/v1/admin/users")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        // Có mật khẩu và mã OTP (amr chứa otp): vào được khu quản trị.
        await ProvisionAsync("demo_admin", "idp-sub-demo-admin");
        Idp.NextAmr = ["pwd", "otp"];
        var (strong, _, _) = await SignInAsync();
        (await strong.GetAsync("/api/v1/admin/users")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await (await strong.GetAsync("/api/v1/me")).ReadAsync<MeInfo>()).MfaRequired.ShouldBeFalse();
    }

    [Fact]
    public async Task Muc_acr_cau_hinh_la_MFA_cung_duoc_chap_nhan_va_vai_tro_thuong_khong_bi_anh_huong()
    {
        await ProvisionAsync("demo_admin", "idp-sub-demo-admin");
        Idp.NextAcr = "2";
        var (byAcr, _, _) = await SignInAsync();
        (await byAcr.GetAsync("/api/v1/admin/users")).StatusCode.ShouldBe(HttpStatusCode.OK);

        await ProvisionAsync("demo_admin", "idp-sub-demo-admin");
        Idp.NextAcr = "1";
        var (lowLevel, _, _) = await SignInAsync();
        (await lowLevel.GetAsync("/api/v1/admin/users")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        // Chuyên viên không thuộc danh sách vai trò cần MFA: đăng nhập thường là đủ.
        await ProvisionAsync("demo_cv_ht", "idp-sub-demo-cv-ht");
        var (employee, _, _) = await SignInAsync();
        (await employee.GetAsync("/api/v1/dossiers")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await (await employee.GetAsync("/api/v1/me")).ReadAsync<MeInfo>()).MfaRequired.ShouldBeFalse();
    }

    [Fact]
    public async Task Yeu_cau_dang_nhap_lai_co_MFA_gui_acr_values_cho_nha_cung_cap_danh_tinh()
    {
        var browser = NewBrowser(api);
        var before = Idp.AuthorizeRequests.Count;
        using var idp = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false });

        var normal = await browser.GetAsync("/api/v1/auth/login");
        await idp.GetAsync(normal.Headers.Location, TestContext.Current.CancellationToken);
        Idp.AuthorizeRequests.Skip(before).Last().ContainsKey("acr_values").ShouldBeFalse("đăng nhập thường không đòi mức xác thực");

        var stepUp = await browser.GetAsync("/api/v1/auth/login?mfa=true");
        await idp.GetAsync(stepUp.Headers.Location, TestContext.Current.CancellationToken);
        Idp.AuthorizeRequests.Last()["acr_values"].ShouldBe("2");
    }
}
