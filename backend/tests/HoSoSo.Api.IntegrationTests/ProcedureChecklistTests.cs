using System.Net;
using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-64: danh sách kiểm tra theo thành phần của thủ tục (ok / pending / missing) và việc cần làm.</summary>
public sealed class ProcedureChecklistTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private const string GroupHt = "U15";
    private static readonly Guid ToKhai = Guid.NewGuid();        // bắt buộc
    private static readonly Guid GiayUyQuyen = Guid.NewGuid();   // bắt buộc
    private static readonly Guid BanVe = Guid.NewGuid();         // không bắt buộc theo bản công bố

    private sealed record Component(Guid ComponentId, string Name, bool Required, string State, List<Guid> DocumentIds, string Todo);
    private sealed record Summary(int RequiredCount, int RequiredOk, int RequiredPending, int RequiredMissing, bool AllRequiredOk, string? Warning, bool Enforced);
    private sealed record Item(Guid DocumentId, string State, Guid? ComponentId);
    private sealed record Checklist(CompletenessDto Summary, List<Item> Items, string? ProcedureId, string? ProcedureName, List<Component>? Components, Summary? Procedure);
    private sealed record ActionRow(string Action, bool Enabled, string? DisabledReason, string? Warning);
    private sealed record Detail(Guid Id, uint Version, string? ProcedureId, string? ProcedureName);

    private async Task SeedAsync()
    {
        api.RequireDatabase();
        if (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.procedures WHERE id = 'chk-001'") > 0) return;
        await api.ExecuteAsync("""
            INSERT INTO hoso.procedures(id, procedure_code, name, lifecycle_status) VALUES
              ('chk-001','9.000001','Thủ tục thử danh sách kiểm tra','active'),
              ('chk-002','9.000002','Thủ tục khác','active'),
              ('chk-old','9.000003','Thủ tục đã bãi bỏ','repealed')
            """);
        await api.ExecuteAsync("INSERT INTO hoso.procedure_components(id, procedure_id, section, position, name, required_as_published, original_quantity, copy_quantity) VALUES ($1,'chk-001','Hồ sơ gồm:',1,'Tờ khai',true,1,0)", ToKhai);
        await api.ExecuteAsync("INSERT INTO hoso.procedure_components(id, procedure_id, section, position, name, required_as_published) VALUES ($1,'chk-001','Hồ sơ gồm:',2,'Giấy ủy quyền',true)", GiayUyQuyen);
        await api.ExecuteAsync("INSERT INTO hoso.procedure_components(id, procedure_id, section, position, name, required_as_published) VALUES ($1,'chk-001','Hồ sơ gồm:',3,'Bản vẽ kèm theo',false)", BanVe);
    }

    private async Task<Detail> CreateAsync(HttpClient http, string title, string? procedureId = "chk-001") =>
        await (await http.PostJsonAsync("/api/v1/dossiers", new { title, workGroupCode = GroupHt, procedureId })).ReadAsync<Detail>();

    private Task<Guid> PublicDocAsync(string key) => api.ScalarAsync<Guid>("SELECT id FROM hoso.documents WHERE external_key = $1", key);

    private async Task VerifyAsync(Guid[] documents)
    {
        var reviewer = await api.UserIdAsync("demo_cv_ht");
        await api.ExecuteAsync("UPDATE hoso.documents SET data_review_status = 'verified', reviewed_by = $1, reviewed_at = now() WHERE id = ANY($2)", reviewer, documents);
    }

    private static async Task<Checklist> ChecklistAsync(HttpClient http, Guid id) =>
        await (await http.GetAsync($"/api/v1/dossiers/{id}/checklist")).ReadAsync<Checklist>();

    [Fact]
    public async Task Ho_so_theo_thu_tuc_liet_ke_tung_thanh_phan_va_viec_can_lam()
    {
        await SeedAsync();
        var http = await api.LoginAsync("demo_cv_ht");
        var d = await CreateAsync(http, "Hồ sơ theo thủ tục để thử danh sách kiểm tra");
        d.ProcedureId.ShouldBe("chk-001");
        d.ProcedureName.ShouldBe("Thủ tục thử danh sách kiểm tra");

        var empty = await ChecklistAsync(http, d.Id);
        var components = empty.Components.ShouldNotBeNull();
        components.Select(c => c.Name).ShouldBe(["Tờ khai", "Giấy ủy quyền", "Bản vẽ kèm theo"], "đúng thứ tự trong thủ tục");
        components.ShouldAllBe(c => c.State == "missing");
        components.Single(c => c.ComponentId == ToKhai).Todo.ShouldContain("Thiếu «Tờ khai»");
        components.Single(c => c.ComponentId == BanVe).Todo.ShouldContain("Không bắt buộc");
        var summary = empty.Procedure.ShouldNotBeNull();
        (summary.RequiredCount, summary.RequiredMissing, summary.AllRequiredOk).ShouldBe((2, 2, false));
        summary.Warning.ShouldNotBeNull().ShouldContain("2 thành phần bắt buộc chưa có giấy tờ");
    }

    [Fact]
    public async Task Gan_giay_to_vao_thanh_phan_chuyen_missing_thanh_pending_roi_ok_khi_da_doi_chieu()
    {
        await SeedAsync();
        var http = await api.LoginAsync("demo_cv_ht");
        var d = await CreateAsync(http, "Hồ sơ thử trạng thái từng thành phần");
        var first = await PublicDocAsync("public-001");
        var second = await PublicDocAsync("public-003");

        (await http.PostJsonAsync($"/api/v1/dossiers/{d.Id}/documents", new { documentId = first, procedureComponentId = ToKhai })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await http.PostJsonAsync($"/api/v1/dossiers/{d.Id}/documents", new { documentId = second })).StatusCode.ShouldBe(HttpStatusCode.OK);
        await api.ExecuteAsync("UPDATE hoso.documents SET data_review_status = 'pending', reviewed_by = NULL, reviewed_at = NULL WHERE id = ANY($1)", new[] { first, second });

        var pending = await ChecklistAsync(http, d.Id);
        var tokhai = pending.Components!.Single(c => c.ComponentId == ToKhai);
        tokhai.State.ShouldBe("pending");
        tokhai.DocumentIds.ShouldBe([first]);
        tokhai.Todo.ShouldContain("Đối chiếu 1 giấy tờ");
        pending.Items.Single(i => i.DocumentId == first).ComponentId.ShouldBe(ToKhai);
        pending.Items.Single(i => i.DocumentId == second).ComponentId.ShouldBeNull("giấy tờ chưa gán thành phần");
        (pending.Procedure!.RequiredPending, pending.Procedure.RequiredMissing).ShouldBe((1, 1));

        // Gán giấy tờ thứ hai bằng cách sắp xếp lại; đối chiếu xong cả hai.
        (await http.PatchJsonAsync($"/api/v1/dossiers/{d.Id}/documents", new[] { new { documentId = second, procedureComponentId = GiayUyQuyen } })).StatusCode.ShouldBe(HttpStatusCode.OK);
        await VerifyAsync(new[] { first, second });
        var verified = await ChecklistAsync(http, d.Id);
        verified.Components!.Where(c => c.Required).ShouldAllBe(c => c.State == "ok");
        verified.Components!.Single(c => c.ComponentId == BanVe).State.ShouldBe("missing", "mục không bắt buộc vẫn hiện, nhưng không tính vào đủ/thiếu");
        verified.Procedure!.AllRequiredOk.ShouldBeTrue();
        verified.Procedure.Warning.ShouldBeNull();

        // Gỡ gán thì thành phần quay lại thiếu.
        await http.PatchJsonAsync($"/api/v1/dossiers/{d.Id}/documents", new[] { new { documentId = second, clearProcedureComponent = true } });
        (await ChecklistAsync(http, d.Id)).Components!.Single(c => c.ComponentId == GiayUyQuyen).State.ShouldBe("missing");
    }

    [Fact]
    public async Task Thieu_thanh_phan_bat_buoc_chi_canh_bao_khong_khoa_nut_vi_CSDL_khong_chan()
    {
        await SeedAsync();
        var http = await api.LoginAsync("demo_cv_ht");
        var d = await CreateAsync(http, "Hồ sơ thiếu thành phần nhưng giấy tờ đã đủ");
        var doc = await PublicDocAsync("public-004");
        await http.PostJsonAsync($"/api/v1/dossiers/{d.Id}/documents", new { documentId = doc });
        await VerifyAsync(new[] { doc });

        var actions = await (await http.GetAsync($"/api/v1/dossiers/{d.Id}/actions")).ReadAsync<List<ActionRow>>();
        var submit = actions.Single(a => a.Action == "submit");
        submit.Enabled.ShouldBeTrue("cổng cứng vẫn chỉ xét giấy tờ đã có trong hồ sơ");
        submit.DisabledReason.ShouldBeNull();
        submit.Warning.ShouldNotBeNull().ShouldContain("thành phần bắt buộc");
    }

    [Fact]
    public async Task Ho_so_khong_co_thu_tuc_khong_co_phan_thanh_phan_va_khong_canh_bao()
    {
        await SeedAsync();
        var http = await api.LoginAsync("demo_cv_ht");
        var d = await CreateAsync(http, "Hồ sơ không gắn thủ tục nào cả", procedureId: null);
        var checklist = await ChecklistAsync(http, d.Id);
        checklist.ProcedureId.ShouldBeNull();
        checklist.Components.ShouldBeNull();
        checklist.Procedure.ShouldBeNull();
    }

    [Fact]
    public async Task Chon_thu_tuc_va_gan_thanh_phan_sai_bi_tu_choi_bang_loi_tung_truong()
    {
        await SeedAsync();
        var http = await api.LoginAsync("demo_cv_ht");

        var missing = await http.PostJsonAsync("/api/v1/dossiers", new { title = "Hồ sơ chọn thủ tục không có", workGroupCode = GroupHt, procedureId = "khong-co" });
        missing.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await missing.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("procedureId");

        var repealed = await http.PostJsonAsync("/api/v1/dossiers", new { title = "Hồ sơ chọn thủ tục đã bãi bỏ", workGroupCode = GroupHt, procedureId = "chk-old" });
        repealed.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await repealed.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("bãi bỏ");

        var d = await CreateAsync(http, "Hồ sơ thử gán thành phần sai", procedureId: null);
        var doc = await PublicDocAsync("public-001");
        var noProcedure = await http.PostJsonAsync($"/api/v1/dossiers/{d.Id}/documents", new { documentId = doc, procedureComponentId = ToKhai });
        noProcedure.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await noProcedure.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("chưa chọn thủ tục");

        var other = await CreateAsync(http, "Hồ sơ theo thủ tục khác", "chk-002");
        var wrong = await http.PostJsonAsync($"/api/v1/dossiers/{other.Id}/documents", new { documentId = doc, procedureComponentId = ToKhai });
        wrong.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await wrong.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("không thuộc thủ tục");
        (await ChecklistAsync(http, other.Id)).Items.ShouldBeEmpty("lần thêm sai không để lại giấy tờ nào");
    }

    [Fact]
    public async Task Doi_hoac_bo_thu_tuc_go_gan_cac_giay_to_da_gan_thanh_phan_cu_nhung_giu_giay_to()
    {
        await SeedAsync();
        var http = await api.LoginAsync("demo_cv_ht");
        var d = await CreateAsync(http, "Hồ sơ đổi thủ tục giữa chừng");
        var doc = await PublicDocAsync("public-003");
        await http.PostJsonAsync($"/api/v1/dossiers/{d.Id}/documents", new { documentId = doc, procedureComponentId = ToKhai });

        // Thêm giấy tờ đã làm đổi phiên bản hồ sơ: lấy bản mới nhất trước khi sửa.
        var current = await (await http.GetAsync($"/api/v1/dossiers/{d.Id}")).ReadAsync<Detail>();
        var changed = await (await http.PatchJsonAsync($"/api/v1/dossiers/{d.Id}", new { version = current.Version, procedureId = "chk-002" })).ReadAsync<Detail>();
        changed.ProcedureId.ShouldBe("chk-002");
        var after = await ChecklistAsync(http, d.Id);
        after.Items.Single().ComponentId.ShouldBeNull("thành phần của thủ tục cũ đã được gỡ gán");
        after.Items.Single().DocumentId.ShouldBe(doc, "giấy tờ vẫn nằm trong hồ sơ");

        var cleared = await (await http.PatchJsonAsync($"/api/v1/dossiers/{d.Id}", new { version = changed.Version, procedureId = "" })).ReadAsync<Detail>();
        cleared.ProcedureId.ShouldBeNull();
        (await ChecklistAsync(http, d.Id)).Components.ShouldBeNull();
    }
    [Fact]
    public async Task Khi_co_quan_bat_khoa_cung_thi_thieu_thanh_phan_bat_buoc_khoa_nut_va_CSDL_chan_buoc_chuyen()
    {
        await SeedAsync();
        var http = await api.LoginAsync("demo_cv_ht");
        var admin = await api.LoginAsync("demo_admin");
        var d = await CreateAsync(http, "Hồ sơ thử khóa cứng thành phần thủ tục");
        var first = await PublicDocAsync("public-004");
        var second = await PublicDocAsync("public-001");
        await http.PostJsonAsync($"/api/v1/dossiers/{d.Id}/documents", new { documentId = first });
        await VerifyAsync([first, second]);

        // Mặc định tắt: cùng hồ sơ này vẫn gửi được (chỉ cảnh báo).
        (await ChecklistAsync(http, d.Id)).Procedure!.Enforced.ShouldBeFalse();

        try
        {
            (await admin.PatchJsonAsync("/api/v1/admin/settings", new { key = "dossier.enforce_procedure_components", value = "true" })).StatusCode
                .ShouldBe(HttpStatusCode.BadRequest, "chuỗi \"true\" không phải boolean: không được âm thầm coi là bật");
            (await admin.PatchJsonAsync("/api/v1/admin/settings", new { key = "dossier.enforce_procedure_components", value = true })).StatusCode.ShouldBe(HttpStatusCode.OK);

            (await ChecklistAsync(http, d.Id)).Procedure!.Enforced.ShouldBeTrue();
            var blocked = (await (await http.GetAsync($"/api/v1/dossiers/{d.Id}/actions")).ReadAsync<List<ActionRow>>()).Single(a => a.Action == "submit");
            blocked.Enabled.ShouldBeFalse();
            blocked.DisabledReason.ShouldNotBeNull().ShouldContain("2 thành phần bắt buộc chưa có giấy tờ");
            blocked.Warning.ShouldBeNull("đã khóa thì không còn là cảnh báo");

            // CSDL chặn thật, không chỉ giao diện: gọi thẳng chuyển bước cũng bị từ chối.
            var transition = await http.PostJsonAsync($"/api/v1/dossiers/{d.Id}/transitions", new { action = "submit" });
            transition.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
            (await transition.ProblemCodeAsync()).ShouldBe("dossier_incomplete");

            // Gán đủ hai thành phần bắt buộc (mục không bắt buộc không cần), đã đối chiếu: mở khóa.
            await http.PostJsonAsync($"/api/v1/dossiers/{d.Id}/documents", new { documentId = second });
            await http.PatchJsonAsync($"/api/v1/dossiers/{d.Id}/documents", new object[]
            {
                new { documentId = first, procedureComponentId = ToKhai },
                new { documentId = second, procedureComponentId = GiayUyQuyen },
            });
            var ready = (await (await http.GetAsync($"/api/v1/dossiers/{d.Id}/actions")).ReadAsync<List<ActionRow>>()).Single(a => a.Action == "submit");
            ready.Enabled.ShouldBeTrue(ready.DisabledReason);
            (await http.PostJsonAsync($"/api/v1/dossiers/{d.Id}/transitions", new { action = "submit" })).StatusCode.ShouldBe(HttpStatusCode.OK);

            // Hồ sơ không gắn thủ tục không bị ảnh hưởng dù khóa đang bật.
            var plain = await CreateAsync(http, "Hồ sơ không gắn thủ tục khi khóa cứng đang bật", procedureId: null);
            await http.PostJsonAsync($"/api/v1/dossiers/{plain.Id}/documents", new { documentId = first });
            (await http.PostJsonAsync($"/api/v1/dossiers/{plain.Id}/transitions", new { action = "submit" })).StatusCode.ShouldBe(HttpStatusCode.OK);
        }
        finally
        {
            await api.ExecuteAsync("UPDATE hoso.system_settings SET value = 'false'::jsonb WHERE key = 'dossier.enforce_procedure_components'");
        }
    }
}
