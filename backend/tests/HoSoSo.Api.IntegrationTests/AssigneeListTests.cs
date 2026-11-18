using System.Net;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Application.Common;
using Microsoft.Extensions.DependencyInjection;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-110: trưởng phòng xem danh sách người có thể giao chủ trì hồ sơ, kèm tải công việc của từng người.</summary>
public sealed class AssigneeListTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record Option(Guid UserId, string DisplayName, bool IsDeputy, bool IsCurrent, int Holding, int Overdue);

    private Task<Guid> HtDossierAsync() => api.ScalarAsync<Guid>("SELECT id FROM hoso.dossiers WHERE code = 'DEMO-2026-0001'");   // phòng Hạ tầng, chủ trì demo_cv_ht

    private async Task<List<Option>> ListAsync(HttpClient http, Guid dossier) =>
        await (await http.GetAsync($"/api/v1/dossiers/{dossier}/assignees", TestContext.Current.CancellationToken)).ReadAsync<List<Option>>();

    private async Task ForgetAsync(string username)
    {
        using var scope = api.Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<IIdentityService>().Invalidate(await api.UserIdAsync(username));
    }

    [Fact]
    public async Task Chi_liet_ke_chuyen_vien_con_hieu_luc_cua_dung_phong_kem_tai_cong_viec()
    {
        var dossier = await HtDossierAsync();
        var manager = await api.LoginAsync("demo_head_ht");
        var options = await ListAsync(manager, dossier);

        options.Select(o => o.DisplayName).ShouldBe(options.OrderByDescending(o => o.IsCurrent).ThenBy(o => o.Holding).Select(o => o.DisplayName), "người đang chủ trì đứng đầu, rồi người ít việc nhất");
        var cvHt = await api.UserIdAsync("demo_cv_ht");
        var cvHt02 = await api.UserIdAsync("demo_cv_ht_02");
        var current = options.Single(o => o.UserId == cvHt);
        current.IsCurrent.ShouldBeTrue();
        current.Holding.ShouldBe(2, "DEMO-2026-0001 và DEMO-2026-0008 (hồ sơ 0007 của phòng khác đã lưu trữ không tính)");
        current.Overdue.ShouldBe(0);
        options.Single(o => o.UserId == cvHt02).ShouldSatisfyAllConditions(o => o.IsCurrent.ShouldBeFalse(), o => o.Holding.ShouldBe(0));

        // Không có trưởng phòng, văn thư, chuyên viên phòng khác.
        var ids = options.Select(o => o.UserId).ToHashSet();
        ids.ShouldNotContain(await api.UserIdAsync("demo_head_ht"));
        ids.ShouldNotContain(await api.UserIdAsync("demo_cv_kt"));
        ids.ShouldNotContain(await api.UserIdAsync("demo_clerk_ubnd"));

        // Chỉ những gì cần để chọn: không email, tên đăng nhập.
        var raw = await (await manager.GetAsync($"/api/v1/dossiers/{dossier}/assignees", TestContext.Current.CancellationToken)).Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.ShouldNotContain("username", Case.Insensitive);
        raw.ShouldNotContain("email", Case.Insensitive);
    }

    [Fact]
    public async Task Danh_sach_khop_dung_quy_tac_cua_ham_giao_viec_nguoi_trong_danh_sach_giao_duoc_nguoi_ngoai_danh_sach_thi_khong()
    {
        var dossier = await HtDossierAsync();
        var manager = await api.LoginAsync("demo_head_ht");
        var inList = (await ListAsync(manager, dossier)).Select(o => o.UserId).ToList();
        inList.ShouldNotBeEmpty();
        foreach (var user in inList)
            (await manager.PutJsonAsync($"/api/v1/dossiers/{dossier}/assignment", new { userId = user, note = "giao thử theo danh sách" })).StatusCode.ShouldBe(HttpStatusCode.OK);

        foreach (var outsider in new[] { "demo_cv_kt", "demo_head_ht", "demo_clerk_ubnd" })
            (await manager.PutJsonAsync($"/api/v1/dossiers/{dossier}/assignment", new { userId = await api.UserIdAsync(outsider), note = "giao thử người ngoài danh sách" }))
                .StatusCode.ShouldNotBe(HttpStatusCode.OK, $"{outsider} không có trong danh sách thì giao cũng bị từ chối");
    }

    [Fact]
    public async Task Hoc_vien_het_han_bi_khoa_hoac_chua_toi_ngay_thi_khong_xuat_hien_va_so_qua_han_tinh_theo_gio_Viet_Nam()
    {
        var dossier = await HtDossierAsync();
        var manager = await api.LoginAsync("demo_head_ht");
        var second = await api.UserIdAsync("demo_cv_ht_02");

        // Hạn nội bộ hôm qua (giờ Việt Nam) → quá hạn; hồ sơ đã lưu trữ thì không tính là đang giữ.
        var vietnamToday = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        await api.ExecuteAsync("UPDATE hoso.dossiers SET internal_due_on = $1 WHERE code = 'DEMO-2026-0001'", vietnamToday.AddDays(-1));
        await api.ExecuteAsync("UPDATE hoso.dossiers SET internal_due_on = $1 WHERE code = 'DEMO-2026-0008'", vietnamToday);          // đúng hôm nay: chưa quá hạn
        var cvHt = await api.UserIdAsync("demo_cv_ht");
        var current = (await ListAsync(manager, dossier)).Single(o => o.UserId == cvHt);
        (current.Holding, current.Overdue).ShouldBe((2, 1));
        await api.ExecuteAsync("UPDATE hoso.dossiers SET status = 'archived', archived_at = now() WHERE code = 'DEMO-2026-0008'");
        var afterArchive = (await ListAsync(manager, dossier)).Single(o => o.UserId == current.UserId);
        (afterArchive.Holding, afterArchive.Overdue).ShouldBe((1, 1));

        // Phân công hết hạn, chưa tới ngày hiệu lực, người bị khóa: đều không có trong danh sách.
        await api.ExecuteAsync("UPDATE hoso.user_roles SET valid_until = now() - interval '1 hour' WHERE user_id = $1 AND role_code = 'employee'", second);
        (await ListAsync(manager, dossier)).ShouldNotContain(o => o.UserId == second);
        await api.ExecuteAsync("UPDATE hoso.user_roles SET valid_until = NULL, valid_from = now() + interval '1 day' WHERE user_id = $1 AND role_code = 'employee'", second);
        await ForgetAsync("demo_cv_ht_02");
        (await ListAsync(manager, dossier)).ShouldNotContain(o => o.UserId == second);
        await api.ExecuteAsync("UPDATE hoso.user_roles SET valid_from = '2025-01-01' WHERE user_id = $1 AND role_code = 'employee'", second);
        (await ListAsync(manager, dossier)).ShouldContain(o => o.UserId == second);
        await api.ExecuteAsync("UPDATE hoso.users SET active = false WHERE id = $1", second);
        (await ListAsync(manager, dossier)).ShouldNotContain(o => o.UserId == second);
    }

    [Fact]
    public async Task Ho_so_ngoai_pham_vi_tra_404_chuyen_vien_khong_co_quyen_giao_tra_403()
    {
        var dossier = await HtDossierAsync();
        (await (await api.LoginAsync("demo_head_kt")).GetAsync($"/api/v1/dossiers/{dossier}/assignees", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await (await api.LoginAsync("demo_cv_ht")).GetAsync($"/api/v1/dossiers/{dossier}/assignees", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await (await api.LoginAsync("demo_head_ht")).GetAsync($"/api/v1/dossiers/{Guid.NewGuid()}/assignees", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }
}
