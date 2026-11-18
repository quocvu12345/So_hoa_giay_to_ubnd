using System.Net;
using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-130: chi tiết hồ sơ cho biết thời hạn bảo quản áp dụng (cùng luật chọn quy tắc với đề nghị hủy: chỉ quy tắc ĐÃ xác nhận có hiệu lực).</summary>
public sealed class DossierRetentionTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record Retention(string Status, string? Label, short? Years, string? LegalReference, DateTimeOffset? EligibleSince, bool Eligible);
    private sealed record Detail(Guid Id, Retention? Retention);

    // Mỗi ca dùng một nhóm riêng (cùng một CSDL cho cả lớp) nên quy tắc của ca này không lẫn sang ca khác.
    private async Task<Guid> NewDossierAsync(HttpClient http, string group)
    {
        var response = await http.PostJsonAsync("/api/v1/dossiers", new { title = "Bảo quản " + Guid.NewGuid().ToString("N")[..6], workGroupCode = group });
        response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return (await response.ReadAsync<Detail>()).Id;
    }

    private async Task<Retention> RetentionAsync(HttpClient http, Guid id)
    {
        var detail = await (await http.GetAsync($"/api/v1/dossiers/{id}", TestContext.Current.CancellationToken)).ReadAsync<Detail>();
        return detail.Retention.ShouldNotBeNull();
    }

    private async Task AddRuleAsync(string group, string label, short? years, bool confirmed, string? legal = "Luật Lưu trữ 2011")
    {
        var admin = await api.UserIdAsync("demo_admin");
        await api.ExecuteAsync(
            "INSERT INTO hoso.retention_rules(work_group_code, retention_label, retention_years, legal_reference, status, confirmed_by, confirmed_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            group, label, years is null ? DBNull.Value : years, legal ?? (object)DBNull.Value, confirmed ? "confirmed" : "proposed",
            confirmed ? admin : DBNull.Value, confirmed ? DateTimeOffset.UtcNow : DBNull.Value);
    }

    [Fact]
    public async Task Nhom_chua_co_quy_tac_thi_bao_none_va_chi_co_de_xuat_thi_bao_proposed_khong_co_hieu_luc()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        (await RetentionAsync(cv, await NewDossierAsync(cv, "U15"))).ShouldBe(new Retention("none", null, null, null, null, false));

        await AddRuleAsync("U16", "20 năm (đề xuất)", 20, confirmed: false, legal: null);
        var proposed = await RetentionAsync(cv, await NewDossierAsync(cv, "U16"));
        (proposed.Status, proposed.Label, proposed.Years).ShouldBe(("proposed", "20 năm (đề xuất)", (short?)20));
        (proposed.EligibleSince, proposed.Eligible).ShouldBe(((DateTimeOffset?)null, false), "đề xuất chưa có hiệu lực nên không tính ngày đủ hạn");
    }

    [Fact]
    public async Task Quy_tac_da_xac_nhan_co_hieu_luc_va_tinh_ngay_du_han_tu_luc_luu_tru()
    {
        await AddRuleAsync("U17", "10 năm", 10, confirmed: true);
        var cv = await api.LoginAsync("demo_cv_ht");
        var id = await NewDossierAsync(cv, "U17");

        var open = await RetentionAsync(cv, id);
        (open.Status, open.Label, open.Years, open.LegalReference).ShouldBe(("confirmed", "10 năm", (short?)10, "Luật Lưu trữ 2011"));
        (open.EligibleSince, open.Eligible).ShouldBe(((DateTimeOffset?)null, false), "chưa lưu trữ thì chưa có ngày đủ hạn");

        await api.ExecuteAsync("UPDATE hoso.dossiers SET status = 'archived', archived_at = now() - interval '3 years' WHERE id = $1", id);
        var young = await RetentionAsync(cv, id);
        young.Eligible.ShouldBeFalse();
        young.EligibleSince.ShouldNotBeNull().ShouldBeGreaterThan(DateTimeOffset.UtcNow.AddYears(6));

        await api.ExecuteAsync("UPDATE hoso.dossiers SET archived_at = now() - interval '12 years' WHERE id = $1", id);
        var old = await RetentionAsync(cv, id);
        old.Eligible.ShouldBeTrue();
        old.EligibleSince.ShouldNotBeNull().ShouldBeLessThan(DateTimeOffset.UtcNow);
    }

    [Fact]
    public async Task Nhom_co_nhieu_quy_tac_da_xac_nhan_thi_khong_doan_tru_khi_ho_so_da_gan_quy_tac()
    {
        await AddRuleAsync("U18", "5 năm", 5, confirmed: true);
        await AddRuleAsync("U18", "30 năm", 30, confirmed: true);
        var cv = await api.LoginAsync("demo_cv_ht");
        var id = await NewDossierAsync(cv, "U18");
        (await RetentionAsync(cv, id)).Status.ShouldBe("ambiguous");

        // Hồ sơ đã gán quy tắc (khi đề nghị hủy) thì dùng đúng quy tắc đó.
        var thirty = await api.ScalarAsync<Guid>("SELECT id FROM hoso.retention_rules WHERE work_group_code = 'U18' AND retention_years = 30");
        await api.ExecuteAsync("UPDATE hoso.dossiers SET retention_rule_id = $2 WHERE id = $1", id, thirty);
        var assigned = await RetentionAsync(cv, id);
        (assigned.Status, assigned.Years).ShouldBe(("confirmed", (short?)30));
    }

    [Fact]
    public async Task Quy_tac_khong_ghi_so_nam_hoac_chi_ap_cho_loai_giay_to_khong_lam_hong_chi_tiet()
    {
        // Quy tắc "vĩnh viễn" (không có số năm) không phải quy tắc để tính hạn hủy: bỏ qua giống đề nghị hủy.
        await AddRuleAsync("U19", "Vĩnh viễn", null, confirmed: true);
        var cv = await api.LoginAsync("demo_cv_ht");
        var retention = await RetentionAsync(cv, await NewDossierAsync(cv, "U19"));
        (retention.Status, retention.Eligible).ShouldBe(("none", false));
    }

    [Fact]
    public async Task Nguoi_ngoai_pham_vi_van_khong_xem_duoc_chi_tiet_nen_khong_lo_thoi_han()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var id = await NewDossierAsync(cv, "U15");
        var other = await api.LoginAsync("demo_cv_kt");        // chuyên viên phòng khác
        (await other.GetAsync($"/api/v1/dossiers/{id}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }
}
