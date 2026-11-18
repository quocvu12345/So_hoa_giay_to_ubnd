using System.Net;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Infrastructure.Auditing;
using Microsoft.Extensions.DependencyInjection;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-33: thủ tục hành chính: tìm không dấu, lọc, chi tiết kèm thành phần và mẫu, cảnh báo bãi bỏ/thay thế, tải mẫu.</summary>
public sealed class ProceduresTests : IClassFixture<DbApiFactory>
{
    private readonly DbApiFactory _api;
    // xunit tạo một instance cho mỗi test nên mã mẫu phải là static để mọi test dùng chung dữ liệu mồi.
    private static readonly Guid _templateWithFile = Guid.NewGuid();
    private static readonly Guid _templateWithoutFile = Guid.NewGuid();
    private static readonly byte[] FileBytes = System.Text.Encoding.UTF8.GetBytes("MẪU TỜ KHAI GIẢ LẬP - nội dung thử");

    private sealed record Item(string Id, string? ProcedureCode, string Name, string? Domain, string LifecycleStatus, int ComponentCount);
    private sealed record Page(List<Item> Items, int Total);
    private sealed record Template(Guid Id, string Kind, string Filename, bool Downloadable);
    private sealed record Component(string Section, int Position, string Name, bool RequiredAsPublished, List<Template> Templates);
    private sealed record Event(string Status, string Label);
    private sealed record Detail(string Id, string Name, string LifecycleStatus, string? Warning, List<Component> Components, List<Event> Lifecycle, List<Template> ProcedureFiles);
    private sealed record Domain(string Domain1, int Count);

    public ProceduresTests(DbApiFactory api)
    {
        _api = api;
    }

    private async Task SeedAsync()
    {
        _api.RequireDatabase();
        if (await _api.ScalarAsync<long>("SELECT count(*) FROM hoso.procedures") > 0) return;
        var sha = Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(FileBytes));
        var key = $"blobs/{sha[..2]}/{sha[2..4]}/{sha}";
        var path = Path.Combine(_api.StorageRoot, key.Replace('/', Path.DirectorySeparatorChar));
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await File.WriteAllBytesAsync(path, FileBytes, TestContext.Current.CancellationToken);
        await _api.ExecuteAsync("""
            INSERT INTO hoso.procedures(id, procedure_code, name, domain, managing_agency, lifecycle_status, execution_level) VALUES
              ('hn87-901','1.001001','Thủ tục đăng ký khai sinh','Hộ tịch','Sở Tư pháp','active','Cấp xã'),
              ('dvc-aaa','1.001001','Thủ tục đăng ký khai sinh','Hộ tịch','Bộ Tư pháp','active',NULL),
              ('hn87-902','2.000181','Cấp Giấy phép bán lẻ sản phẩm thuốc lá','Thương mại','Sở Công Thương','repealed','Cấp tỉnh, cấp xã'),
              ('hn87-903','1.002002','Thủ tục đăng ký kết hôn','Hộ tịch','Sở Tư pháp','unverified','Cấp Xã'),
              ('hn87-904','1.003003','Cấp giấy chứng nhận quyền sử dụng đất','Đất đai','Sở Nông nghiệp','active','Cấp xã')
            """);
        await _api.ExecuteAsync("INSERT INTO hoso.procedure_lifecycle_events(procedure_code, status, label, note, evidence) VALUES ('2.000181','repealed','Đã có quyết định bãi bỏ','Giữ lịch sử','[{\"name\":\"Quyết định 762/QĐ-TTPVHCC\"}]'::jsonb)");
        await _api.ExecuteAsync("INSERT INTO hoso.form_templates(id, kind, filename, sha256, byte_size, media_type, storage_key) VALUES ($1,'blank_form','To khai khai sinh.docx',$2,$3,'application/vnd.openxmlformats-officedocument.wordprocessingml.document',$4)",
            _templateWithFile, sha, (long)FileBytes.Length, key);
        await _api.ExecuteAsync("INSERT INTO hoso.form_templates(id, kind, filename, sha256, byte_size, media_type, storage_key) VALUES ($1,'blank_form','Mau rong.docx',$2,0,'application/octet-stream',NULL)",
            _templateWithoutFile, new string('b', 64));
        var c1 = await _api.ScalarAsync<Guid>("INSERT INTO hoso.procedure_components(procedure_id, section, position, name, required_as_published, original_quantity) VALUES ('hn87-901','a) Hồ sơ gồm:',1,'Tờ khai đăng ký khai sinh',true,1) RETURNING id");
        await _api.ExecuteAsync("INSERT INTO hoso.procedure_components(procedure_id, section, position, name) VALUES ('hn87-901','a) Hồ sơ gồm:',2,'Giấy chứng sinh')");
        await _api.ExecuteAsync("INSERT INTO hoso.procedure_component_templates(component_id, template_id) VALUES ($1,$2), ($1,$3)", c1, _templateWithFile, _templateWithoutFile);
        await _api.ExecuteAsync("INSERT INTO hoso.procedure_templates(procedure_id, template_id) VALUES ('hn87-901',$1)", _templateWithFile);
    }

    [Fact]
    public async Task Tim_khong_dau_theo_ten_ma_va_loc_theo_linh_vuc_va_hieu_luc()
    {
        await SeedAsync();
        var http = await _api.LoginAsync("demo_cv_ht");
        var byName = await (await http.GetAsync("/api/v1/procedures?q=khai%20sinh")).ReadAsync<Page>();
        byName.Items.Select(i => i.Id).Order().ToList().ShouldBe(["dvc-aaa", "hn87-901"], "\"khai sinh\" ra thủ tục khai sinh ở cả hai nguồn");
        byName.Items.Single(i => i.Id == "hn87-901").ComponentCount.ShouldBe(2);
        (await (await http.GetAsync("/api/v1/procedures?q=1.002002")).ReadAsync<Page>()).Items.Single().Id.ShouldBe("hn87-903");
        (await (await http.GetAsync("/api/v1/procedures?domain=%C4%90%E1%BA%A5t%20%C4%91ai")).ReadAsync<Page>()).Items.Single().Id.ShouldBe("hn87-904");
        var repealed = await (await http.GetAsync("/api/v1/procedures?status=repealed")).ReadAsync<Page>();
        repealed.Items.Single().LifecycleStatus.ShouldBe("repealed");
        (await (await http.GetAsync("/api/v1/procedures?pageSize=2&page=2")).ReadAsync<Page>()).Items.Count.ShouldBe(2);
        var all = await (await http.GetAsync("/api/v1/procedures?pageSize=100")).ReadAsync<Page>();
        all.Total.ShouldBe(5);
        all.Items.Last().LifecycleStatus.ShouldBe("repealed", "thủ tục đã bãi bỏ xếp cuối");
        (await (await http.GetAsync("/api/v1/procedures/domains")).ReadAsync<List<DomainItem>>()).Select(d => d.Domain).ShouldContain("Hộ tịch");
    }

    private sealed record DomainItem(string Domain, int Count);
    private sealed record LevelItem(string Level, int Count);

    [Fact]
    public async Task Loc_theo_cap_thuc_hien_gop_cach_ghi_hoa_thuong()
    {
        await SeedAsync();
        var http = await _api.LoginAsync("demo_cv_ht");
        // Nguồn ghi "Cấp xã" và "Cấp Xã": một nhóm, nhãn theo cách ghi phổ biến hơn; thủ tục không ghi cấp thì không có nhóm.
        var levels = await (await http.GetAsync("/api/v1/procedures/levels")).ReadAsync<List<LevelItem>>();
        levels.ShouldBe([new LevelItem("Cấp xã", 3), new LevelItem("Cấp tỉnh, cấp xã", 1)]);
        var commune = await (await http.GetAsync("/api/v1/procedures?level=c%E1%BA%A5p%20x%C3%A3&pageSize=100")).ReadAsync<Page>();
        commune.Items.Select(i => i.Id).Order().ToList().ShouldBe(["hn87-901", "hn87-903", "hn87-904"]);
        (await (await http.GetAsync("/api/v1/procedures?level=C%E1%BA%A5p%20x%C3%A3&domain=H%E1%BB%99%20t%E1%BB%8Bch")).ReadAsync<Page>()).Total.ShouldBe(2);
        (await (await http.GetAsync("/api/v1/procedures?level=Li%C3%AAn%20th%C3%B4ng")).ReadAsync<Page>()).Total.ShouldBe(0);
    }

    [Fact]
    public async Task Chi_tiet_thu_tuc_co_thanh_phan_mau_va_canh_bao_khi_da_bai_bo()
    {
        await SeedAsync();
        var http = await _api.LoginAsync("demo_cv_ht");
        var detail = await (await http.GetAsync("/api/v1/procedures/hn87-901")).ReadAsync<Detail>();
        detail.Warning.ShouldBeNull();
        detail.Components.Select(c => c.Position).ShouldBe([1, 2]);
        var withTemplates = detail.Components[0];
        withTemplates.RequiredAsPublished.ShouldBeTrue();
        withTemplates.Templates.Count.ShouldBe(2);
        withTemplates.Templates.Single(t => t.Id == _templateWithFile).Downloadable.ShouldBeTrue();
        withTemplates.Templates.Single(t => t.Id == _templateWithoutFile).Downloadable.ShouldBeFalse("nguồn trả về tệp rỗng nên chưa có nội dung");
        detail.ProcedureFiles.Single().Id.ShouldBe(_templateWithFile);

        var old = await (await http.GetAsync("/api/v1/procedures/hn87-902")).ReadAsync<Detail>();
        (old.LifecycleStatus, old.Lifecycle.Single().Label).ShouldBe(("repealed", "Đã có quyết định bãi bỏ"));
        old.Warning.ShouldNotBeNull().ShouldContain("không dùng mẫu cũ làm mẫu hiện hành");
        (await (await http.GetAsync("/api/v1/procedures/hn87-903")).ReadAsync<Detail>()).Warning.ShouldNotBeNull().ShouldContain("Chưa đối chiếu");
        (await http.GetAsync("/api/v1/procedures/khong-co")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Tai_mau_tu_kho_tep_co_ten_goc_va_ghi_nhat_ky_con_mau_rong_thi_bao_ro()
    {
        await SeedAsync();
        var http = await _api.LoginAsync("demo_cv_ht");
        var response = await http.GetAsync($"/api/v1/form-templates/{_templateWithFile}/file");
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await response.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken)).ShouldBe(FileBytes);
        response.Content.Headers.ContentDisposition?.FileNameStar.ShouldBe("To khai khai sinh.docx");
        response.Content.Headers.ContentType?.MediaType.ShouldBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        await _api.Services.GetRequiredService<AccessEventQueue>().DrainAsync(TimeSpan.FromSeconds(10));
        (await _api.ScalarAsync<long>("SELECT count(*) FROM hoso.access_events WHERE object_id = $1 AND action = 'download'", _templateWithFile)).ShouldBe(1);

        var empty = await http.GetAsync($"/api/v1/form-templates/{_templateWithoutFile}/file");
        empty.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await empty.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("rỗng");
        (await http.GetAsync($"/api/v1/form-templates/{Guid.NewGuid()}/file")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }
}
