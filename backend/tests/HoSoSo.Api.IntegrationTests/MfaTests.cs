using System.Net;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Application.Common;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-95: phân công đặc quyền (quản trị kỹ thuật, lãnh đạo, văn thư) chỉ dùng được khi phiên đã qua xác thực nhiều lớp. Luồng OIDC có ở OidcLoginTests.</summary>
public sealed class MfaTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record MeInfo(bool MfaRequired, string[] Permissions, ActiveInfo ActiveAssignment);
    private sealed record ActiveInfo(string Id, string Role);

    private static async Task<HttpClient> LoginAsync(Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> factory, string username, bool mfa, string? assignment = null)
    {
        var http = factory.CreateClient(new() { AllowAutoRedirect = false, HandleCookies = true });
        (await http.GetAsync($"/api/v1/auth/dev-login?username={username}&mfa={mfa.ToString().ToLowerInvariant()}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Redirect);
        http.DefaultRequestHeaders.Add("X-CSRF", "1");
        if (assignment is not null) http.DefaultRequestHeaders.Add("X-Assignment-Id", assignment);
        return http;
    }

    [Theory]
    [InlineData("demo_admin")]          // technical_admin
    [InlineData("demo_clerk_ubnd")]     // clerk
    [InlineData("demo_chair")]          // chair
    [InlineData("demo_council")]        // council
    public async Task Vai_tro_dac_quyen_khong_co_MFA_thi_chi_xem_duoc_me_va_moi_thu_khac_bi_403(string username)
    {
        api.RequireDatabase();
        var http = await LoginAsync(api, username, mfa: false);
        var me = await (await http.GetAsync("/api/v1/me")).ReadAsync<MeInfo>();
        me.MfaRequired.ShouldBeTrue();
        me.Permissions.ShouldBeEmpty();
        foreach (var path in new[] { "/api/v1/dossiers", "/api/v1/workspace/summary", "/api/v1/admin/users", "/api/v1/notifications", "/api/v1/events" })
        {
            var response = await http.GetAsync(path);
            response.StatusCode.ShouldBe(HttpStatusCode.Forbidden, path);
            (await response.ProblemCodeAsync()).ShouldBe("mfa_required", path);
        }
        (await http.GetAsync("/health/live")).StatusCode.ShouldBe(HttpStatusCode.OK);

        // Có MFA thì dùng bình thường: cùng người, không đổi gì khác.
        var strong = await LoginAsync(api, username, mfa: true);
        (await (await strong.GetAsync("/api/v1/me")).ReadAsync<MeInfo>()).MfaRequired.ShouldBeFalse();
        (await strong.GetAsync("/api/v1/workspace/summary")).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Theory]
    [InlineData("demo_cv_ht")]          // employee
    [InlineData("demo_head_ht")]        // manager
    public async Task Vai_tro_thuong_khong_bi_ep_MFA(string username)
    {
        api.RequireDatabase();
        var http = await LoginAsync(api, username, mfa: false);
        (await (await http.GetAsync("/api/v1/me")).ReadAsync<MeInfo>()).MfaRequired.ShouldBeFalse();
        (await http.GetAsync("/api/v1/workspace/summary")).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Nguoi_co_hai_phan_cong_chua_MFA_chi_dung_duoc_phan_cong_khong_can_MFA()
    {
        api.RequireDatabase();
        var user = await api.UserIdAsync("demo_clerk_ubnd");
        var clerk = await api.AssignmentIdAsync("demo_clerk_ubnd", "clerk");
        var employee = (await api.ScalarAsync<Guid>(
            "INSERT INTO hoso.user_roles(user_id, role_code, organization_code, department_code, valid_from, assignment_basis) VALUES ($1, 'employee', 'tl-ubnd', 'ht', now() - interval '1 day', 'Phân công thứ hai thử MFA') RETURNING id", user)).ToString();
        using (var scope = api.Services.CreateScope()) scope.ServiceProvider.GetRequiredService<IIdentityService>().Invalidate(user);

        var asClerk = await LoginAsync(api, "demo_clerk_ubnd", mfa: false, clerk);
        (await asClerk.GetAsync("/api/v1/workspace/summary")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        var asEmployee = await LoginAsync(api, "demo_clerk_ubnd", mfa: false, employee);
        (await asEmployee.GetAsync("/api/v1/workspace/summary")).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task De_trong_danh_sach_vai_tro_thi_tat_kiem_tra_va_cau_hinh_duoc_vai_tro_khac()
    {
        api.RequireDatabase();
        await using var off = api.WithWebHostBuilder(b => b.UseSetting("Auth:MfaRequiredRoles", ""));
        (await (await LoginAsync(off, "demo_admin", mfa: false)).GetAsync("/api/v1/admin/users")).StatusCode.ShouldBe(HttpStatusCode.OK);

        await using var managers = api.WithWebHostBuilder(b => b.UseSetting("Auth:MfaRequiredRoles", "manager"));
        (await (await LoginAsync(managers, "demo_head_ht", mfa: false)).GetAsync("/api/v1/workspace/summary")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await (await LoginAsync(managers, "demo_admin", mfa: false)).GetAsync("/api/v1/admin/users")).StatusCode.ShouldBe(HttpStatusCode.OK);
    }
}
