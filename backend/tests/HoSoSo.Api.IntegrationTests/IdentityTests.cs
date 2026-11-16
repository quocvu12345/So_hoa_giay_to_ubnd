using System.Net;
using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-12, BE-13, BE-14, BE-30: đăng nhập, phân công đang dùng, ủy quyền, hết hạn.</summary>
public sealed class IdentityTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record MeDto(UserDto User, List<AssignmentDto> Assignments, AssignmentDto ActiveAssignment, string[] Permissions);
    private sealed record UserDto(string Id, string Username);
    private sealed record AssignmentDto(string Id, string Role, string? OrganizationCode, string? DepartmentCode, string? OrganizationName, string? DepartmentName, DateTimeOffset? DelegatedUntil);

    [Fact]
    public async Task Dang_nhap_dev_chi_cho_nguoi_dung_gia_lap_va_ghi_nhan_dang_nhap()
    {
        var http = await api.LoginAsync("demo_head_kt");
        var me = await (await http.GetAsync("/api/v1/me")).ReadAsync<MeDto>();
        me.User.Username.ShouldBe("demo_head_kt");
        me.ActiveAssignment.Role.ShouldBe("manager");
        me.ActiveAssignment.DepartmentCode.ShouldBe("kt");
        me.ActiveAssignment.DepartmentName.ShouldBe("Phòng Kinh tế");
        me.Permissions.ShouldContain("dossier.assign");
        me.Permissions.ShouldNotContain("intake.upload");

        (await api.ScalarAsync<DateTime?>("SELECT last_login_at FROM hoso.users WHERE username = 'demo_head_kt'")).ShouldNotBeNull();
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.access_events e JOIN hoso.users u ON u.id = e.user_id WHERE u.username = 'demo_head_kt' AND e.action = 'login'")).ShouldBe(1);

        // Người dùng không phải giả lập hoặc không tồn tại: không đăng nhập được bằng đường dev.
        await api.ExecuteAsync("INSERT INTO hoso.users(username, display_name, is_demo) VALUES ('nguoi_that', 'Người thật', false)");
        var anonymous = api.CreateClient(new() { AllowAutoRedirect = false });
        (await anonymous.GetAsync("/api/v1/auth/dev-login?username=nguoi_that")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await anonymous.GetAsync("/api/v1/auth/dev-login?username=khong_co")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Chuyen_huong_ra_ngoai_bi_chan()
    {
        api.RequireDatabase();
        var response = await api.CreateClient(new() { AllowAutoRedirect = false })
            .GetAsync("/api/v1/auth/dev-login?username=demo_cv_ht&returnUrl=//evil.example");
        response.Headers.Location!.ToString().ShouldBe("/viec-cua-toi");
    }

    [Fact]
    public async Task Moi_vai_tro_co_dung_quyen_khi_xem_bang_API()
    {
        var qt = await api.LoginAsync("demo_admin");
        (await qt.GetAsync("/api/v1/dossiers")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        var cv = await api.LoginAsync("demo_cv_ht");
        (await cv.GetAsync("/api/v1/admin/users")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Gui_phan_cong_cua_nguoi_khac_thi_403()
    {
        var other = await api.AssignmentIdAsync("demo_head_kt", "manager");
        var http = await api.LoginAsync("demo_cv_ht", other);
        var response = await http.GetAsync("/api/v1/me");
        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await response.ProblemCodeAsync()).ShouldBe("assignment_not_allowed");
    }

    [Fact]
    public async Task Phan_cong_het_han_khong_dung_duoc()
    {
        var user = await api.UserIdAsync("demo_cv_vx");
        var expired = await api.ScalarAsync<Guid>(
            "INSERT INTO hoso.user_roles(user_id, role_code, organization_code, department_code, valid_from, valid_until, assignment_basis) " +
            "VALUES ($1, 'employee', 'tl-ubnd', 'vx', now() - interval '10 days', now() - interval '1 day', 'Phân công thử đã hết hạn') RETURNING id", user);
        var http = await api.LoginAsync("demo_cv_vx", expired.ToString());
        (await http.GetAsync("/api/v1/me")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Uy_quyen_con_han_chi_cho_phan_quyen_duoc_uy_va_het_han_thi_mat()
    {
        var head = await api.UserIdAsync("demo_head_nv");
        var delegate1 = await api.UserIdAsync("demo_cv_nv");
        var delegateExpired = await api.UserIdAsync("demo_cv_qp");
        var headRole = Guid.Parse(await api.AssignmentIdAsync("demo_head_nv", "manager"));
        var admin = await api.UserIdAsync("demo_admin");

        var active = await api.ScalarAsync<Guid>(
            "INSERT INTO hoso.delegations(from_user_role_id, to_user_id, permission_codes, valid_until, basis, created_by) " +
            "VALUES ($1, $2, ARRAY['dossier.read','dossier.accept'], now() + interval '2 days', 'Ủy quyền thử trong thời gian đi công tác', $3) RETURNING id",
            headRole, delegate1, admin);
        await api.ExecuteAsync(
            "INSERT INTO hoso.delegations(from_user_role_id, to_user_id, permission_codes, valid_from, valid_until, basis, created_by) " +
            "VALUES ($1, $2, ARRAY['dossier.read'], now() - interval '5 days', now() - interval '1 day', 'Ủy quyền đã hết hạn từ hôm qua', $3)",
            headRole, delegateExpired, admin);

        var http = await api.LoginAsync("demo_cv_nv");
        var me = await (await http.GetAsync("/api/v1/me")).ReadAsync<MeDto>();
        me.Assignments.Count.ShouldBe(2);
        var delegated = me.Assignments.Single(a => a.Id == $"d:{active}");
        delegated.Role.ShouldBe("manager");
        delegated.DelegatedUntil.ShouldNotBeNull();

        var asDelegate = await api.LoginAsync("demo_cv_nv", $"d:{active}");
        var delegatedMe = await (await asDelegate.GetAsync("/api/v1/me")).ReadAsync<MeDto>();
        delegatedMe.Permissions.OrderBy(x => x).ToArray().ShouldBe(["dossier.accept", "dossier.read"], "chỉ có phần quyền được ủy, không phải toàn bộ quyền trưởng phòng");

        // Ủy quyền đã hết hạn: chỉ còn phân công của chính mình, đòi dùng thì 403.
        var expiredClient = await api.LoginAsync("demo_cv_qp");
        (await (await expiredClient.GetAsync("/api/v1/me")).ReadAsync<MeDto>()).Assignments.ShouldAllBe(a => a.Role == "employee");
        head.ShouldNotBe(Guid.Empty);
    }

    [Fact]
    public async Task Tai_khoan_bi_khoa_thi_khong_co_phan_cong()
    {
        await api.ExecuteAsync("UPDATE hoso.users SET active = false WHERE username = 'demo_cv_mc'");
        var anonymous = api.CreateClient(new() { AllowAutoRedirect = false });
        (await anonymous.GetAsync("/api/v1/auth/dev-login?username=demo_cv_mc")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }
}
