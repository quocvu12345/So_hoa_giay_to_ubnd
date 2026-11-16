using System.Net;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Infrastructure.Auditing;
using Microsoft.Extensions.DependencyInjection;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-15, BE-16: ai thấy hồ sơ nào. Đối chiếu kết quả API với quy tắc hoso.scope_matches và với kỳ vọng nghiệp vụ.</summary>
public sealed class ScopeTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private static readonly string[] AllDemo = ["DEMO-2026-0001", "DEMO-2026-0002", "DEMO-2026-0003", "DEMO-2026-0004", "DEMO-2026-0005", "DEMO-2026-0006", "DEMO-2026-0007", "DEMO-2026-0008"];

    private async Task<string[]> VisibleCodesAsync(string username)
    {
        var http = await api.LoginAsync(username);
        var page = await (await http.GetAsync("/api/v1/dossiers?limit=100")).ReadAsync<PageDto<DossierItem>>();
        return page.Items.Select(i => i.Code).Order().ToArray();
    }

    [Theory]
    [InlineData("demo_cv_ht", new[] { "DEMO-2026-0001", "DEMO-2026-0008" })]            // chuyên viên: hồ sơ mình chủ trì
    [InlineData("demo_cv_kt", new[] { "DEMO-2026-0002", "DEMO-2026-0003" })]
    [InlineData("demo_head_kt", new[] { "DEMO-2026-0002", "DEMO-2026-0003" })]          // trưởng phòng: theo đơn vị
    [InlineData("demo_head_ht", new[] { "DEMO-2026-0001", "DEMO-2026-0008" })]
    [InlineData("demo_head_bkt", new[] { "DEMO-2026-0005" })]
    [InlineData("demo_chair", new[] { "DEMO-2026-0001", "DEMO-2026-0002", "DEMO-2026-0003", "DEMO-2026-0004", "DEMO-2026-0008" })]   // Chủ tịch: chỉ khối UBND
    [InlineData("demo_council", new[] { "DEMO-2026-0005", "DEMO-2026-0006", "DEMO-2026-0007" })]                                    // HĐND: chỉ khối HĐND
    [InlineData("demo_clerk_ubnd", new[] { "DEMO-2026-0001", "DEMO-2026-0002", "DEMO-2026-0003", "DEMO-2026-0004", "DEMO-2026-0008" })]
    [InlineData("demo_clerk_hdnd", new[] { "DEMO-2026-0005", "DEMO-2026-0006", "DEMO-2026-0007" })]
    public async Task Moi_vai_tro_chi_thay_ho_so_trong_pham_vi(string username, string[] expected) =>
        (await VisibleCodesAsync(username)).ShouldBe(expected);

    [Fact]
    public async Task Quan_tri_ky_thuat_khong_doc_duoc_noi_dung_ho_so()
    {
        var http = await api.LoginAsync("demo_admin");
        (await http.GetAsync("/api/v1/dossiers")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Ket_qua_API_khop_voi_ham_scope_matches_cho_moi_cap_nguoi_dung_ho_so()
    {
        api.RequireDatabase();
        var cases = new (string User, string Role)[]
        {
            ("demo_cv_ht", "employee"), ("demo_head_kt", "manager"), ("demo_chair", "chair"), ("demo_council", "council"),
            ("demo_clerk_ubnd", "clerk"), ("demo_clerk_hdnd", "clerk"), ("demo_head_bkt", "manager"), ("demo_cv_tt", "employee"),
        };
        foreach (var (user, role) in cases)
        {
            var userId = await api.UserIdAsync(user);
            await using var command = api.Data.CreateCommand("SELECT code FROM hoso.dossiers WHERE hoso.scope_matches($1, id, $2) ORDER BY code");
            command.Parameters.AddWithValue(userId);
            command.Parameters.AddWithValue(await api.AssignmentIdAsync(user, role));     // phạm vi theo đúng phân công, không theo vai trò chung
            await using var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
            var expected = new List<string>();
            while (await reader.ReadAsync(TestContext.Current.CancellationToken)) expected.Add(reader.GetString(0));
            string.Join(",", await VisibleCodesAsync(user)).ShouldBe(string.Join(",", expected), $"{user} ({role})");
        }
    }

    [Fact]
    public async Task Ho_so_ngoai_pham_vi_tra_404_khong_lo_su_ton_tai()
    {
        var other = await api.ScalarAsync<Guid>("SELECT id FROM hoso.dossiers WHERE code = 'DEMO-2026-0002'");
        var http = await api.LoginAsync("demo_cv_ht");
        var response = await http.GetAsync($"/api/v1/dossiers/{other}");
        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await response.ProblemCodeAsync()).ShouldBe("not_found");
        (await http.GetAsync($"/api/v1/dossiers/{other}/history")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await http.GetAsync($"/api/v1/dossiers/{other}/checklist")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await http.PostJsonAsync($"/api/v1/dossiers/{other}/transitions", new { action = "submit" })).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Ho_so_han_che_can_quyen_cap_rieng_moi_xem_duoc()
    {
        var id = await api.ScalarAsync<Guid>("SELECT id FROM hoso.dossiers WHERE code = 'DEMO-2026-0008'");
        await api.ExecuteAsync("UPDATE hoso.dossiers SET access_level = 'restricted' WHERE id = $1", id);
        var http = await api.LoginAsync("demo_cv_ht");
        (await http.GetAsync($"/api/v1/dossiers/{id}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        var admin = await api.UserIdAsync("demo_admin");
        var cv = await api.UserIdAsync("demo_cv_ht");
        await api.ExecuteAsync(
            "INSERT INTO hoso.document_access_grants(dossier_id, grantee_user_id, access, valid_until, reason, granted_by) VALUES ($1, $2, 'view', now() + interval '1 day', 'Cấp quyền xem để đối chiếu hồ sơ', $3)",
            id, cv, admin);
        (await http.GetAsync($"/api/v1/dossiers/{id}")).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Phan_trang_keyset_khong_trung_khong_sot()
    {
        var http = await api.LoginAsync("demo_clerk_ubnd");
        var seen = new List<string>();
        string? cursor = null;
        var pages = 0;
        do
        {
            var page = await (await http.GetAsync($"/api/v1/dossiers?limit=2{(cursor is null ? "" : $"&cursor={cursor}")}")).ReadAsync<PageDto<DossierItem>>();
            seen.AddRange(page.Items.Select(i => i.Code));
            cursor = page.NextCursor;
            pages++;
        } while (cursor is not null && pages < 10);
        pages.ShouldBe(3);
        seen.Count.ShouldBe(5);
        seen.Distinct().Count().ShouldBe(5);
        (await http.GetAsync("/api/v1/dossiers?cursor=khong-hop-le")).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Tim_khong_dau_khop_tieu_de_co_dau()
    {
        var http = await api.LoginAsync("demo_clerk_ubnd");
        var page = await (await http.GetAsync("/api/v1/dossiers?q=dat%20dai")).ReadAsync<PageDto<DossierItem>>();
        page.Items.Select(i => i.Code).ShouldBe(["DEMO-2026-0001"]);
        var byCode = await (await http.GetAsync("/api/v1/dossiers?q=0003")).ReadAsync<PageDto<DossierItem>>();
        byCode.Items.Select(i => i.Code).ShouldBe(["DEMO-2026-0003"]);
    }

    [Fact]
    public async Task Xem_chi_tiet_ho_so_duoc_ghi_vao_nhat_ky_truy_cap()
    {
        var id = await api.ScalarAsync<Guid>("SELECT id FROM hoso.dossiers WHERE code = 'DEMO-2026-0004'");
        var http = await api.LoginAsync("demo_clerk_ubnd");
        (await http.GetAsync($"/api/v1/dossiers/{id}")).StatusCode.ShouldBe(HttpStatusCode.OK);
        await api.Services.GetRequiredService<AccessEventQueue>().DrainAsync(TimeSpan.FromSeconds(10));
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.access_events WHERE action = 'view' AND object_type = 'dossier' AND object_id = $1", id)).ShouldBe(1);
    }
}
