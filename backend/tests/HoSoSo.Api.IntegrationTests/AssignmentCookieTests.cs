using System.Net;
using System.Net.Http.Json;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Application.Common;
using Microsoft.Extensions.DependencyInjection;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>
/// BE-118: &lt;img&gt;, EventSource và liên kết tải tệp không đặt được header, nên với request ĐỌC API nhận phân công từ cookie hoso_assignment.
/// Cookie chỉ là gợi ý ngầm; mọi chỗ khác giữ nguyên quy tắc của header (BE-13, BE-90).
/// </summary>
public sealed class AssignmentCookieTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private static HttpRequestMessage Request(HttpMethod method, string url, string? cookie = null, string? header = null, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        if (cookie is not null) request.Headers.Add("Cookie", $"hoso_assignment={cookie}");
        if (header is not null) request.Headers.Add("X-Assignment-Id", header);
        if (body is not null) request.Content = JsonContent.Create(body);
        return request;
    }

    /// <summary>Trưởng phòng Hạ tầng có phân công riêng (không thấy hồ sơ phòng Kinh tế) và một ủy quyền xem hồ sơ phòng Kinh tế.</summary>
    private async Task<(string Own, string Delegated, Guid KtDossier)> ArrangeAsync()
    {
        var kt = await api.ScalarAsync<Guid>("SELECT id FROM hoso.dossiers WHERE code = 'DEMO-2026-0002'");
        var fromRole = await api.ScalarAsync<Guid>("SELECT ur.id FROM hoso.user_roles ur JOIN hoso.users u ON u.id = ur.user_id WHERE u.username = 'demo_head_kt' AND ur.role_code = 'manager'");
        var delegation = await api.ScalarAsync<Guid>(
            "INSERT INTO hoso.delegations(from_user_role_id, to_user_id, permission_codes, valid_until, basis, created_by) VALUES ($1, $2, ARRAY['dossier.read','dossier.assign'], now() + interval '3 days', 'Thử phân công qua cookie', $3) RETURNING id",
            fromRole, await api.UserIdAsync("demo_head_ht"), await api.UserIdAsync("demo_admin"));
        using (var scope = api.Services.CreateScope()) scope.ServiceProvider.GetRequiredService<IIdentityService>().Invalidate(await api.UserIdAsync("demo_head_ht"));
        return (await api.AssignmentIdAsync("demo_head_ht", "manager"), $"d:{delegation}", kt);
    }

    [Fact]
    public async Task Request_doc_khong_co_header_dung_phan_cong_trong_cookie()
    {
        var (own, delegated, kt) = await ArrangeAsync();
        var http = await api.LoginAsync("demo_head_ht");     // không header X-Assignment-Id
        var url = $"/api/v1/dossiers/{kt}";

        (await http.SendAsync(Request(HttpMethod.Get, url), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound, "mặc định là phân công riêng: không thấy hồ sơ phòng Kinh tế");
        (await http.SendAsync(Request(HttpMethod.Get, url, cookie: delegated), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.OK, "cookie chọn ủy quyền xem hồ sơ phòng Kinh tế");
        (await http.SendAsync(Request(HttpMethod.Get, url, cookie: own), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        // /me phản ánh đúng phân công lấy từ cookie (SSE và ảnh dùng cùng bộ lọc phân công này).
        var me = await http.SendAsync(Request(HttpMethod.Get, "/api/v1/me", cookie: delegated), TestContext.Current.CancellationToken);
        me.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Header_luon_thang_cookie_va_header_sai_van_bi_tu_choi_403()
    {
        var (own, delegated, kt) = await ArrangeAsync();
        var http = await api.LoginAsync("demo_head_ht");
        var url = $"/api/v1/dossiers/{kt}";

        (await http.SendAsync(Request(HttpMethod.Get, url, cookie: delegated, header: own), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound, "header chọn phân công riêng, cookie bị bỏ qua");
        (await http.SendAsync(Request(HttpMethod.Get, url, cookie: own, header: delegated), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var rejected = await http.SendAsync(Request(HttpMethod.Get, url, cookie: delegated, header: Guid.NewGuid().ToString()), TestContext.Current.CancellationToken);
        rejected.StatusCode.ShouldBe(HttpStatusCode.Forbidden, "lựa chọn tường minh sai vẫn 403 như trước, cookie đúng cũng không cứu");
        (await rejected.ProblemCodeAsync()).ShouldBe("assignment_not_allowed");
    }

    [Fact]
    public async Task Cookie_sai_cu_hoac_cua_nguoi_khac_bi_bo_qua_va_khong_nang_duoc_quyen()
    {
        var (_, _, kt) = await ArrangeAsync();
        var http = await api.LoginAsync("demo_head_ht");
        var url = $"/api/v1/dossiers/{kt}";
        var others = await api.AssignmentIdAsync("demo_head_kt", "manager");      // phân công thật của NGƯỜI KHÁC, đủ quyền xem hồ sơ Kinh tế
        var revoked = await api.ScalarAsync<Guid>(
            "INSERT INTO hoso.delegations(from_user_role_id, to_user_id, permission_codes, valid_until, revoked_at, basis, created_by) " +
            "SELECT ur.id, $1, ARRAY['dossier.read'], now() + interval '3 days', now(), 'Đã thu hồi', $2 FROM hoso.user_roles ur JOIN hoso.users u ON u.id = ur.user_id WHERE u.username = 'demo_head_kt' AND ur.role_code = 'manager' RETURNING id",
            await api.UserIdAsync("demo_head_ht"), await api.UserIdAsync("demo_admin"));

        foreach (var bad in new[] { others, $"d:{revoked}", Guid.NewGuid().ToString(), "khong-phai-ma", new string('x', 5000) })
        {
            var response = await http.SendAsync(Request(HttpMethod.Get, url, cookie: bad), TestContext.Current.CancellationToken);
            response.StatusCode.ShouldBe(HttpStatusCode.NotFound, $"cookie {bad[..Math.Min(bad.Length, 20)]} không được chọn phân công của người khác hay đã thu hồi; dùng mặc định (không thấy hồ sơ Kinh tế)");
        }
        // Cookie sai không làm hỏng các request cần phiên: /me vẫn 200 để giao diện tự sửa cookie (FE-46), không rơi vào vòng 403.
        (await http.SendAsync(Request(HttpMethod.Get, "/api/v1/me", cookie: others), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Request_ghi_khong_bao_gio_lay_phan_cong_tu_cookie()
    {
        var (own, delegated, kt) = await ArrangeAsync();
        var http = await api.LoginAsync("demo_head_ht");
        var employee = await api.UserIdAsync("demo_cv_kt");
        var url = $"/api/v1/dossiers/{kt}/assignment";
        var body = new { userId = employee, note = "giao việc thử cookie" };

        // Cùng cookie ủy quyền (có quyền giao) nhưng request GHI bỏ qua cookie, dùng phân công riêng → hồ sơ ngoài phạm vi.
        (await http.SendAsync(Request(HttpMethod.Put, url, cookie: delegated, body: body), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.dossier_assignments WHERE dossier_id = $1 AND assigned_by = $2", kt, await api.UserIdAsync("demo_head_ht"))).ShouldBe(0);
        // Nêu rõ bằng header thì giao được: hành động ghi vẫn phải khai báo phân công.
        (await http.SendAsync(Request(HttpMethod.Put, url, header: delegated, body: body), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.OK);
        _ = own;
    }

    [Fact]
    public async Task Chua_dang_nhap_thi_cookie_khong_co_tac_dung()
    {
        var (_, delegated, kt) = await ArrangeAsync();
        var anonymous = api.CreateClient();
        (await anonymous.SendAsync(Request(HttpMethod.Get, $"/api/v1/dossiers/{kt}", cookie: delegated), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}
