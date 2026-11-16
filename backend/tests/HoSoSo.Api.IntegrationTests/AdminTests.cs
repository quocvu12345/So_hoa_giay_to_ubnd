using System.Net;
using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-34: quản trị người dùng, phân công, ủy quyền; hiệu lực tức thì và các chốt chặn an toàn.</summary>
public sealed class AdminTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record UserItem(Guid Id, string Username, string DisplayName, bool Active, int ActiveAssignments, List<string> Roles);
    private sealed record AssignmentItem(Guid Id, string Role, string? OrganizationCode, string? DepartmentCode, string State);
    private sealed record DelegationItem(Guid Id, string FromRole, string ToUsername, List<string> PermissionCodes, string State);
    private sealed record UserDetail(UserItem User, List<AssignmentItem> Assignments, List<DelegationItem> Delegations);
    private sealed record MeDto(List<MeAssignment> Assignments, MeAssignment ActiveAssignment, string[] Permissions);
    private sealed record MeAssignment(string Id, string Role);

    private async Task<Guid> NewUserAsync(HttpClient admin, string username, bool demo = true)
    {
        var created = await (await admin.PostJsonAsync("/api/v1/admin/users", new { username, displayName = $"Người dùng thử {username}" })).ReadAsync<UserDetail>();
        if (demo) await api.ExecuteAsync("UPDATE hoso.users SET is_demo = true WHERE id = $1", created.User.Id);   // để đăng nhập được bằng đường dev
        return created.User.Id;
    }

    [Fact]
    public async Task Chi_quan_tri_nguoi_dung_moi_vao_duoc_khu_quan_tri()
    {
        foreach (var user in new[] { "demo_cv_ht", "demo_head_kt", "demo_clerk_ubnd", "demo_chair" })
        {
            var http = await api.LoginAsync(user);
            (await http.GetAsync("/api/v1/admin/users")).StatusCode.ShouldBe(HttpStatusCode.Forbidden, user);
            (await http.PostJsonAsync("/api/v1/admin/assignments", new { })).StatusCode.ShouldBe(HttpStatusCode.Forbidden, user);
        }
        var admin = await api.LoginAsync("demo_admin");
        var all = await (await admin.GetAsync("/api/v1/admin/users")).ReadAsync<List<UserItem>>();
        all.Count.ShouldBeGreaterThanOrEqualTo(25);
        (await (await admin.GetAsync("/api/v1/admin/users?q=head_kt")).ReadAsync<List<UserItem>>()).Select(u => u.Username).ShouldBe(["demo_head_kt"]);
    }

    [Fact]
    public async Task Tao_nguoi_dung_kiem_tra_ten_va_chan_trung()
    {
        var admin = await api.LoginAsync("demo_admin");
        var id = await NewUserAsync(admin, "chuyen.vien.moi", demo: false);
        (await api.ScalarAsync<bool>("SELECT active FROM hoso.users WHERE id = $1", id)).ShouldBeTrue();

        var duplicate = await admin.PostJsonAsync("/api/v1/admin/users", new { username = "Chuyen.Vien.Moi", displayName = "Trùng tên" });
        duplicate.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await duplicate.ProblemCodeAsync()).ShouldBe("duplicate_value");

        var invalid = await admin.PostJsonAsync("/api/v1/admin/users", new { username = "Có Dấu", displayName = "x" });
        invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await invalid.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("\"username\"");

        // Người thật phải đăng nhập bằng danh tính của cơ quan, không dùng được đường đăng nhập dev.
        (await api.CreateClient(new() { AllowAutoRedirect = false }).GetAsync("/api/v1/auth/dev-login?username=chuyen.vien.moi")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        // Thay đổi được ghi vết kèm người thực hiện.
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.audit_events WHERE table_name = 'users' AND operation = 'INSERT' AND actor_subject = $1", (await api.UserIdAsync("demo_admin")).ToString())).ShouldBeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public async Task Phan_cong_sai_hinh_dang_bi_tu_choi_voi_thong_diep_ro()
    {
        var admin = await api.LoginAsync("demo_admin");
        var user = await NewUserAsync(admin, "thu.phan.cong");
        var basis = "Quyết định 12/QĐ-UBND ngày 01/01/2026";

        var noDept = await admin.PostJsonAsync("/api/v1/admin/assignments", new { userId = user, roleCode = "employee", organizationCode = "tl-ubnd", basis });
        noDept.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await noDept.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("departmentCode");

        (await admin.PostJsonAsync("/api/v1/admin/assignments", new { userId = user, roleCode = "technical_admin", organizationCode = "tl-ubnd", basis })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await admin.PostJsonAsync("/api/v1/admin/assignments", new { userId = user, roleCode = "ke_toan", basis })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await admin.PostJsonAsync("/api/v1/admin/assignments", new { userId = user, roleCode = "clerk", organizationCode = "tl-ubnd", basis = "ngắn" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await admin.PostJsonAsync("/api/v1/admin/assignments", new { userId = user, roleCode = "clerk", organizationCode = "tl-ubnd", basis,
            validFrom = "2026-06-01T00:00:00Z", validUntil = "2026-05-01T00:00:00Z" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        // Phòng Hạ tầng thuộc UBND, không thuộc HĐND: ràng buộc khóa ngoại → 422.
        var wrongOrg = await admin.PostJsonAsync("/api/v1/admin/assignments", new { userId = user, roleCode = "employee", organizationCode = "tl-hdnd", departmentCode = "ht", basis });
        wrongOrg.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await admin.PostJsonAsync("/api/v1/admin/assignments", new { userId = Guid.NewGuid(), roleCode = "clerk", organizationCode = "tl-ubnd", basis })).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Cap_va_thu_hoi_phan_cong_co_hieu_luc_ngay_khong_cho_bo_nho_dem()
    {
        var admin = await api.LoginAsync("demo_admin");
        var userId = await NewUserAsync(admin, "nhan.vien.thu");
        var user = await api.LoginAsync("nhan.vien.thu");
        var before = await user.GetAsync("/api/v1/me");
        before.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await before.ProblemCodeAsync()).ShouldBe("no_assignment");

        var created = await (await admin.PostJsonAsync("/api/v1/admin/assignments",
            new { userId, roleCode = "employee", organizationCode = "tl-ubnd", departmentCode = "ht", basis = "Quyết định 15/QĐ-UBND về phân công cán bộ" })).ReadAsync<AssignmentItem>();
        created.State.ShouldBe("active");
        var me = await (await user.GetAsync("/api/v1/me")).ReadAsync<MeDto>();
        me.ActiveAssignment.Role.ShouldBe("employee");
        me.Permissions.ShouldContain("dossier.prepare");

        (await admin.PostJsonAsync($"/api/v1/admin/assignments/{created.Id}/end")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await user.GetAsync("/api/v1/me")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await admin.PostJsonAsync($"/api/v1/admin/assignments/{created.Id}/end")).StatusCode.ShouldBe(HttpStatusCode.Conflict);

        var detail = await (await admin.GetAsync($"/api/v1/admin/users/{userId}")).ReadAsync<UserDetail>();
        detail.Assignments.Single().State.ShouldBe("ended");
        detail.User.ActiveAssignments.ShouldBe(0);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.audit_events WHERE table_name = 'user_roles' AND actor_subject = $1", (await api.UserIdAsync("demo_admin")).ToString())).ShouldBeGreaterThanOrEqualTo(2);
    }

    [Fact]
    public async Task Uy_quyen_gioi_han_theo_quyen_cua_vai_tro_toi_da_90_ngay_va_thu_hoi_duoc()
    {
        var admin = await api.LoginAsync("demo_admin");
        var from = await api.AssignmentIdAsync("demo_head_nv", "manager");
        var to = await api.UserIdAsync("demo_cv_nv");
        var basis = "Ủy quyền trong thời gian đi công tác theo Quyết định 33/QĐ-UBND";
        var until = DateTimeOffset.UtcNow.AddDays(30);

        // Quyền "cho ý kiến lãnh đạo" không thuộc trưởng phòng nên không ủy quyền được.
        var beyond = await admin.PostJsonAsync("/api/v1/admin/delegations", new { fromAssignmentId = from, toUserId = to, permissionCodes = new[] { "dossier.read", "dossier.decide" }, validUntil = until, basis });
        beyond.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await beyond.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("dossier.decide");
        (await admin.PostJsonAsync("/api/v1/admin/delegations", new { fromAssignmentId = from, toUserId = to, permissionCodes = new[] { "dossier.read" }, validUntil = DateTimeOffset.UtcNow.AddDays(120), basis })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await admin.PostJsonAsync("/api/v1/admin/delegations", new { fromAssignmentId = from, toUserId = await api.UserIdAsync("demo_head_nv"), permissionCodes = new[] { "dossier.read" }, validUntil = until, basis })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var created = await (await admin.PostJsonAsync("/api/v1/admin/delegations", new { fromAssignmentId = from, toUserId = to, permissionCodes = new[] { "dossier.read", "dossier.accept" }, validUntil = until, basis })).ReadAsync<DelegationItem>();
        created.State.ShouldBe("active");
        var delegate1 = await api.LoginAsync("demo_cv_nv");
        (await (await delegate1.GetAsync("/api/v1/me")).ReadAsync<MeDto>()).Assignments.Count.ShouldBe(2);

        (await admin.PostJsonAsync($"/api/v1/admin/delegations/{created.Id}/revoke")).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await (await delegate1.GetAsync("/api/v1/me")).ReadAsync<MeDto>()).Assignments.Count.ShouldBe(1);
        (await admin.PostJsonAsync($"/api/v1/admin/delegations/{created.Id}/revoke")).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var detail = await (await admin.GetAsync($"/api/v1/admin/users/{to}")).ReadAsync<UserDetail>();
        detail.Delegations.Single().State.ShouldBe("revoked");
    }
}
