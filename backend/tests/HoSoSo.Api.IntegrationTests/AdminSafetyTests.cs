using System.Net;
using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>
/// BE-34, các chốt chặn an toàn của quản trị. Lớp riêng (CSDL riêng) vì test khóa chính tài khoản quản trị duy nhất
/// của CSDL mẫu, sẽ làm các test khác trong lớp không đăng nhập được.
/// </summary>
public sealed class AdminSafetyTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record UserItem(Guid Id, string Username);
    private sealed record UserDetail(UserItem User);

    private async Task<Guid> NewUserAsync(HttpClient admin, string username)
    {
        var created = await (await admin.PostJsonAsync("/api/v1/admin/users", new { username, displayName = $"Người dùng thử {username}" })).ReadAsync<UserDetail>();
        await api.ExecuteAsync("UPDATE hoso.users SET is_demo = true WHERE id = $1", created.User.Id);
        return created.User.Id;
    }

    [Fact]
    public async Task Khoa_tai_khoan_chan_ngay_ca_phien_dang_mo_va_khong_duoc_tu_khoa_hay_khoa_quan_tri_cuoi()
    {
        var admin = await api.LoginAsync("demo_admin");
        var adminId = await api.UserIdAsync("demo_admin");
        var target = await api.UserIdAsync("demo_cv_vx");
        var session = await api.LoginAsync("demo_cv_vx");
        (await session.GetAsync("/api/v1/me")).StatusCode.ShouldBe(HttpStatusCode.OK);

        (await admin.PatchJsonAsync($"/api/v1/admin/users/{target}", new { active = false })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await session.GetAsync("/api/v1/me")).StatusCode.ShouldBe(HttpStatusCode.Unauthorized, "khóa tài khoản thu hồi phiên đang mở ngay (BE-12)");
        (await api.CreateClient(new() { AllowAutoRedirect = false }).GetAsync("/api/v1/auth/dev-login?username=demo_cv_vx")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await admin.PatchJsonAsync($"/api/v1/admin/users/{target}", new { active = true })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await session.GetAsync("/api/v1/me")).StatusCode.ShouldBe(HttpStatusCode.Unauthorized, "mở khóa không làm sống lại phiên đã thu hồi; phải đăng nhập lại");
        (await (await api.LoginAsync("demo_cv_vx")).GetAsync("/api/v1/me")).StatusCode.ShouldBe(HttpStatusCode.OK);

        // demo_admin là quản trị duy nhất: không tự khóa mình, không kết thúc phân công quản trị cuối cùng.
        var self = await admin.PatchJsonAsync($"/api/v1/admin/users/{adminId}", new { active = false });
        self.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var assignment = await api.AssignmentIdAsync("demo_admin", "technical_admin");
        var last = await admin.PostJsonAsync($"/api/v1/admin/assignments/{assignment}/end");
        last.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await last.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("cuối cùng");

        // Có quản trị thứ hai thì quản trị thứ hai khóa được người thứ nhất, nhưng sau đó người cuối cùng lại được bảo vệ.
        var second = await NewUserAsync(admin, "quan.tri.hai");
        await admin.PostJsonAsync("/api/v1/admin/assignments", new { userId = second, roleCode = "technical_admin", basis = "Quyết định 20/QĐ-UBND về người quản trị hệ thống" });
        var secondAdmin = await api.LoginAsync("quan.tri.hai");
        (await secondAdmin.PatchJsonAsync($"/api/v1/admin/users/{adminId}", new { active = false })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await secondAdmin.PatchJsonAsync($"/api/v1/admin/users/{second}", new { active = false })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }
}
