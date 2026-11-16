using System.Net;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Application.Common;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>
/// BE-90: phạm vi hồ sơ tính theo ĐÚNG phân công đang chọn, không theo hợp của mọi phân công cùng vai trò.
/// Hai ca đầu là hai lỗi tái hiện được trong rà soát bảo mật: quyền của phân công riêng áp lên hồ sơ chỉ có ủy quyền xem,
/// và người kiêm nhiệm hai đơn vị vẫn thấy hồ sơ đơn vị còn lại khi đang chọn một đơn vị.
/// </summary>
public sealed class AssignmentScopeTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private void Forget(Guid userId)
    {
        using var scope = api.Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<IIdentityService>().Invalidate(userId);
    }

    private Task<Guid> KtDossierAsync() => api.ScalarAsync<Guid>("SELECT id FROM hoso.dossiers WHERE code = 'DEMO-2026-0002'");

    private async Task<Guid> DelegationAsync(string from, string to, string permissions)
    {
        var fromRole = await api.ScalarAsync<Guid>("SELECT ur.id FROM hoso.user_roles ur JOIN hoso.users u ON u.id = ur.user_id WHERE u.username = $1 AND ur.role_code = 'manager'", from);
        var toUser = await api.UserIdAsync(to);
        var admin = await api.UserIdAsync("demo_admin");
        var id = await api.ScalarAsync<Guid>(
            $"INSERT INTO hoso.delegations(from_user_role_id, to_user_id, permission_codes, valid_until, basis, created_by) VALUES ($1, $2, ARRAY[{permissions}], now() + interval '3 days', 'Ủy quyền thử phạm vi theo phân công', $3) RETURNING id",
            fromRole, toUser, admin);
        Forget(toUser);
        return id;
    }

    [Fact]
    public async Task Uy_quyen_chi_xem_khong_cho_phan_cong_rieng_giao_viec_ho_so_don_vi_khac()
    {
        var kt = await KtDossierAsync();
        var employeeKt = await api.UserIdAsync("demo_cv_kt");
        var delegation = await DelegationAsync("demo_head_kt", "demo_head_ht", "'dossier.read'");
        var own = await api.AssignmentIdAsync("demo_head_ht", "manager");

        // Đang dùng phân công RIÊNG (trưởng phòng Hạ tầng, đủ quyền giao việc): hồ sơ phòng Kinh tế không thuộc phạm vi → 404.
        var ownSession = await api.LoginAsync("demo_head_ht", own);
        (await ownSession.GetAsync($"/api/v1/dossiers/{kt}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ownSession.PutJsonAsync($"/api/v1/dossiers/{kt}/assignment", new { userId = employeeKt, note = "giao việc vượt phạm vi" })).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.dossier_assignments WHERE dossier_id = $1 AND assigned_by = $2", kt, await api.UserIdAsync("demo_head_ht"))).ShouldBe(0);

        // Đang dùng chính ủy quyền: đọc được (có quyền xem), nhưng không giao việc được (ủy quyền không có quyền giao).
        var delegated = await api.LoginAsync("demo_head_ht", $"d:{delegation}");
        (await delegated.GetAsync($"/api/v1/dossiers/{kt}")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await delegated.PutJsonAsync($"/api/v1/dossiers/{kt}/assignment", new { userId = employeeKt, note = "giao việc bằng ủy quyền chỉ xem" })).StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        // Mở rộng ủy quyền có quyền giao thì giao được, và người giao ghi đúng là người nhận ủy quyền.
        await api.ExecuteAsync("UPDATE hoso.delegations SET permission_codes = ARRAY['dossier.read','dossier.assign'] WHERE id = $1", delegation);
        Forget(await api.UserIdAsync("demo_head_ht"));
        (await delegated.PutJsonAsync($"/api/v1/dossiers/{kt}/assignment", new { userId = employeeKt, note = "giao việc theo ủy quyền có quyền giao" })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.dossier_assignments WHERE dossier_id = $1 AND assigned_by = $2", kt, await api.UserIdAsync("demo_head_ht"))).ShouldBe(1);

        // Thu hồi ủy quyền: dùng mã ủy quyền cũ bị từ chối, và phân công riêng vẫn không thấy hồ sơ phòng Kinh tế.
        await api.ExecuteAsync("UPDATE hoso.delegations SET revoked_at = now() WHERE id = $1", delegation);
        Forget(await api.UserIdAsync("demo_head_ht"));
        (await delegated.GetAsync($"/api/v1/dossiers/{kt}")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await ownSession.GetAsync($"/api/v1/dossiers/{kt}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    private async Task<(Guid Dossier, string Code, string Dept)> OtherUnitDossierAsync()
    {
        await using var command = api.Data.CreateCommand("SELECT id, code, department_code FROM hoso.dossiers WHERE organization_code = 'tl-ubnd' AND department_code NOT IN ('ht', 'kt') ORDER BY code LIMIT 1");
        await using var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
        (await reader.ReadAsync(TestContext.Current.CancellationToken)).ShouldBeTrue("cần một hồ sơ của đơn vị khác Hạ tầng và Kinh tế");
        return (reader.GetGuid(0), reader.GetString(1), reader.GetString(2));
    }

    [Fact]
    public async Task Kiem_nhiem_hai_don_vi_chon_don_vi_nao_thay_dung_ho_so_don_vi_do()
    {
        var headHt = await api.UserIdAsync("demo_head_ht");
        var (other, code, dept) = await OtherUnitDossierAsync();
        var htAssignment = await api.AssignmentIdAsync("demo_head_ht", "manager");
        // Cùng vai trò trưởng phòng, thêm một phân công ở đơn vị còn lại (kiêm nhiệm).
        var otherAssignment = (await api.ScalarAsync<Guid>(
            "INSERT INTO hoso.user_roles(user_id, role_code, organization_code, department_code, valid_from, assignment_basis) VALUES ($1, 'manager', 'tl-ubnd', $2, now() - interval '1 day', 'Kiêm nhiệm thử') RETURNING id",
            headHt, dept)).ToString();
        Forget(headHt);

        var asHt = await api.LoginAsync("demo_head_ht", htAssignment);
        var asOther = await api.LoginAsync("demo_head_ht", otherAssignment);

        async Task<(HttpStatusCode Detail, bool InList, bool InSearch)> ProbeAsync(HttpClient http)
        {
            var detail = (await http.GetAsync($"/api/v1/dossiers/{other}")).StatusCode;
            var list = await (await http.GetAsync("/api/v1/dossiers?limit=100")).ReadAsync<PageDto<DossierItem>>();
            var search = await (await http.GetAsync($"/api/v1/search?q={Uri.EscapeDataString(code)}&kind=dossiers")).ReadAsync<Search>();
            return (detail, list.Items.Any(i => i.Id == other), search.Hits.Any(h => h.Id == other));
        }

        (await ProbeAsync(asHt)).ShouldBe((HttpStatusCode.NotFound, false, false), "đang chọn đơn vị Hạ tầng: không thấy hồ sơ đơn vị kia ở bất kỳ đâu");
        (await ProbeAsync(asOther)).ShouldBe((HttpStatusCode.OK, true, true), "đang chọn đơn vị kia: thấy");

        // Hồ sơ của Hạ tầng thì ngược lại.
        var ht = await api.ScalarAsync<Guid>("SELECT id FROM hoso.dossiers WHERE organization_code = 'tl-ubnd' AND department_code = 'ht' ORDER BY code LIMIT 1");
        (await asHt.GetAsync($"/api/v1/dossiers/{ht}")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await asOther.GetAsync($"/api/v1/dossiers/{ht}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        // Giao việc, chuyển bước, lịch sử, danh sách kiểm tra: đều theo phân công đang chọn.
        (await asHt.GetAsync($"/api/v1/dossiers/{other}/history")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await asHt.GetAsync($"/api/v1/dossiers/{other}/checklist")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await asHt.PostJsonAsync($"/api/v1/dossiers/{other}/transitions", new { action = "accept", note = "Ý kiến đủ dài để hợp lệ" })).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        // Hết hạn phân công thứ hai thì đơn vị kia biến mất cả với mã phân công cũ (API từ chối mã không còn hiệu lực).
        await api.ExecuteAsync("UPDATE hoso.user_roles SET valid_until = now() - interval '1 minute' WHERE id = $1", Guid.Parse(otherAssignment));
        Forget(headHt);
        (await asOther.GetAsync($"/api/v1/dossiers/{other}")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Chi_dung_phan_cong_cua_chinh_minh_con_hieu_luc_moi_khop_o_tang_CSDL()
    {
        var kt = await KtDossierAsync();
        var headKt = await api.UserIdAsync("demo_head_kt");
        var headHt = await api.UserIdAsync("demo_head_ht");
        var mine = await api.AssignmentIdAsync("demo_head_kt", "manager");
        var others = await api.AssignmentIdAsync("demo_head_ht", "manager");

        async Task<bool> Matches(Guid user, string? assignment) => assignment is null
            ? await api.ScalarAsync<bool>("SELECT hoso.scope_matches($1, $2, NULL)", user, kt)
            : await api.ScalarAsync<bool>("SELECT hoso.scope_matches($1, $2, $3)", user, kt, assignment);

        (await Matches(headKt, mine)).ShouldBeTrue();
        (await Matches(headKt, "manager")).ShouldBeFalse("vai trò không phải mã phân công: không khớp (hàm cũ nhận vai trò đã bị xóa)");
        (await Matches(headKt, "khong-phai-ma")).ShouldBeFalse("sai dạng: không ném lỗi ép kiểu, chỉ không khớp");
        (await Matches(headKt, "")).ShouldBeFalse();
        (await Matches(headKt, null)).ShouldBeFalse();
        (await Matches(headKt, Guid.NewGuid().ToString())).ShouldBeFalse("mã không tồn tại");
        (await Matches(headKt, $"d:{Guid.NewGuid()}")).ShouldBeFalse("ủy quyền không tồn tại");
        (await Matches(headHt, mine)).ShouldBeFalse("phân công của người khác không dùng được");
        (await Matches(headKt, others)).ShouldBeFalse("dùng mã phân công của người khác");
        (await Matches(headHt, others)).ShouldBeFalse("trưởng phòng Hạ tầng không thấy hồ sơ Kinh tế");

        // Ủy quyền: chỉ người nhận, chỉ khi còn hiệu lực, chưa thu hồi, và cả hai bên còn hoạt động.
        var delegation = await DelegationAsync("demo_head_kt", "demo_head_ht", "'dossier.read'");
        var code = $"d:{delegation}";
        (await Matches(headHt, code)).ShouldBeTrue("người nhận ủy quyền thấy hồ sơ của người ủy quyền");
        (await Matches(headKt, code)).ShouldBeFalse("người khác không dùng được mã ủy quyền");
        await api.ExecuteAsync("UPDATE hoso.users SET active = false WHERE id = $1", headKt);
        try { (await Matches(headHt, code)).ShouldBeFalse("người ủy quyền bị khóa thì ủy quyền mất hiệu lực"); }
        finally { await api.ExecuteAsync("UPDATE hoso.users SET active = true WHERE id = $1", headKt); }
        await api.ExecuteAsync("UPDATE hoso.delegations SET valid_until = now() - interval '1 second', valid_from = now() - interval '2 days' WHERE id = $1", delegation);
        (await Matches(headHt, code)).ShouldBeFalse("ủy quyền hết hạn");

        // Chuyển bước và giao việc ở tầng CSDL cũng khóa theo phân công: dùng mã của người khác là ngoài phạm vi (HS001).
        var outsideTransition = await Should.ThrowAsync<PostgresException>(() =>
            api.ScalarAsync<string>("SELECT hoso.transition_dossier($1, $2, $3, 'accept', 'Ý kiến đủ dài để hợp lệ', NULL)", kt, headHt, others));
        outsideTransition.SqlState.ShouldBe("HS001");
        var employeeKt = await api.UserIdAsync("demo_cv_kt");
        var outsideAssign = await Should.ThrowAsync<PostgresException>(() =>
            api.ExecuteAsync("SELECT hoso.assign_dossier($1, $2, $3, $4, NULL, 'x')", kt, headHt, others, employeeKt));
        outsideAssign.SqlState.ShouldBe("HS001");

        (await api.ScalarAsync<string>("SELECT role_code || '/' || organization_code || '/' || coalesce(department_code, '-') FROM hoso.assignment_scope($1, $2)", headKt, mine)).ShouldBe("manager/tl-ubnd/kt");
    }

    [Fact]
    public async Task Su_kien_dossier_changed_chi_toi_ket_noi_dang_chon_dung_phan_cong()
    {
        var headHt = await api.UserIdAsync("demo_head_ht");
        var (other, _, dept) = await OtherUnitDossierAsync();
        var htAssignment = await api.AssignmentIdAsync("demo_head_ht", "manager");
        var otherAssignment = (await api.ScalarAsync<Guid>(
            "INSERT INTO hoso.user_roles(user_id, role_code, organization_code, department_code, valid_from, assignment_basis) VALUES ($1, 'manager', 'tl-ubnd', $2, now() - interval '1 day', 'Kiêm nhiệm thử SSE') RETURNING id",
            headHt, dept)).ToString();
        Forget(headHt);

        await using var asHt = await SseClient.ConnectAsync(await api.LoginAsync("demo_head_ht", htAssignment));
        await using var asOther = await SseClient.ConnectAsync(await api.LoginAsync("demo_head_ht", otherAssignment));
        await api.ExecuteAsync("SELECT pg_notify('dossier_changed', json_build_object('dossierId', $1::uuid, 'status', 'draft')::text)", other);

        (await asOther.WaitForAsync("dossier.changed", where: e => e.Data.Contains(other.ToString()))).Data.ShouldContain("draft");
        (await asHt.StaysQuietAsync("dossier.changed", TimeSpan.FromSeconds(1.5))).ShouldBeTrue("kết nối đang chọn Hạ tầng của cùng người dùng không được báo hồ sơ đơn vị kia");
    }

    private sealed record Search(List<Hit> Hits);
    private sealed record Hit(string Kind, Guid Id);
}
