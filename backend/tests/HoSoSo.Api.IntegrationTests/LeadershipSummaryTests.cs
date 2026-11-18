using System.Net;
using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-115: số liệu tổng hợp cho Chủ tịch UBND (theo phòng) và lãnh đạo HĐND (theo hoạt động), chỉ đếm hồ sơ trong phạm vi phân công đang dùng.</summary>
public sealed class LeadershipSummaryTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record Counts(int Preparing, int AwaitingCheck, int AwaitingOpinion, int AwaitingArchive, int Overdue, int Open);
    private sealed record Department(string DepartmentCode, string DepartmentName, Counts Counts);
    private sealed record ActivityRow(string Activity, string Label, List<string> WorkGroupCodes, Counts Counts);
    private sealed record Summary(string Role, string? OrganizationCode, DateOnly AsOf, Counts Totals, List<Department> Departments, List<ActivityRow> Activities);

    /// <summary>Các test trong lớp dùng chung một CSDL: đưa 8 hồ sơ mẫu về đúng trạng thái ban đầu và xóa hồ sơ thêm vào, để thứ tự chạy không ảnh hưởng kết quả.</summary>
    private async Task ResetAsync()
    {
        await api.ExecuteAsync("DELETE FROM hoso.dossiers WHERE code LIKE 'LDR-%'");
        await api.ExecuteAsync("UPDATE hoso.dossiers SET internal_due_on = '2026-11-25', access_level = 'internal' WHERE code LIKE 'DEMO-2026-%'");
    }

    private async Task<Summary> GetAsync(string username) =>
        await (await (await api.LoginAsync(username)).GetAsync("/api/v1/workspace/leadership", TestContext.Current.CancellationToken)).ReadAsync<Summary>();

    private static Counts Of(int preparing = 0, int check = 0, int opinion = 0, int archive = 0, int overdue = 0, int open = 0) => new(preparing, check, opinion, archive, overdue, open);

    // Dữ liệu mẫu (004_seed_demo): UBND 0001 ht draft · 0002 kt chờ kiểm tra · 0003 kt chờ ý kiến · 0004 vp chờ nộp lưu · 0008 ht yêu cầu bổ sung;
    // HĐND 0005 bkt/H03 chờ kiểm tra · 0006 tt/H05 chờ ý kiến · 0007 tt/H01 đã lưu trữ.

    [Fact]
    public async Task Chu_tich_UBND_thay_bang_theo_phong_chi_gom_khoi_UBND_ke_ca_phong_chua_co_ho_so()
    {
        await ResetAsync();
        var summary = await GetAsync("demo_chair");
        summary.Role.ShouldBe("chair");
        summary.OrganizationCode.ShouldBe("tl-ubnd");
        summary.Activities.ShouldBeEmpty("Chủ tịch xem theo phòng, không theo hoạt động HĐND");
        summary.AsOf.ShouldBe(DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)));

        summary.Totals.ShouldBe(Of(preparing: 2, check: 1, opinion: 1, archive: 1, overdue: 0, open: 5), "không có hồ sơ khối HĐND");
        var byDepartment = summary.Departments.ToDictionary(d => d.DepartmentCode);
        byDepartment["ht"].Counts.ShouldBe(Of(preparing: 2, open: 2));
        byDepartment["kt"].Counts.ShouldBe(Of(check: 1, opinion: 1, open: 2));
        byDepartment["vp"].Counts.ShouldBe(Of(archive: 1, open: 1));
        byDepartment["nv"].Counts.ShouldBe(Of(), "phòng chưa có hồ sơ vẫn có dòng, số 0");
        byDepartment.Keys.ShouldNotContain("bkt", "ban của HĐND không thuộc khối UBND");
        byDepartment.Keys.ShouldNotContain("tt");
        byDepartment["ht"].DepartmentName.ShouldBe("Phòng Hạ tầng - Nông nghiệp và Môi trường");

        // Các dòng cộng lại bằng tổng.
        summary.Departments.Sum(d => d.Counts.Open).ShouldBe(summary.Totals.Open);
        summary.Departments.Sum(d => d.Counts.Preparing).ShouldBe(summary.Totals.Preparing);
    }

    [Fact]
    public async Task Qua_han_tinh_theo_gio_Viet_Nam_khong_tinh_ho_so_da_luu_tru_va_nam_trong_so_dang_xu_ly()
    {
        await ResetAsync();
        var yesterday = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)).AddDays(-1);
        var today = yesterday.AddDays(1);
        await api.ExecuteAsync("UPDATE hoso.dossiers SET internal_due_on = $1 WHERE code = 'DEMO-2026-0001'", yesterday);       // quá hạn
        await api.ExecuteAsync("UPDATE hoso.dossiers SET internal_due_on = $1 WHERE code = 'DEMO-2026-0008'", today);            // đúng hôm nay: chưa quá hạn
        await api.ExecuteAsync("UPDATE hoso.dossiers SET internal_due_on = $1 WHERE code = 'DEMO-2026-0003'", yesterday);       // quá hạn, đang chờ ý kiến
        await api.ExecuteAsync("UPDATE hoso.dossiers SET internal_due_on = $1 WHERE code = 'DEMO-2026-0007'", yesterday.AddDays(-30));   // HĐND, đã lưu trữ

        var chair = await GetAsync("demo_chair");
        chair.Departments.Single(d => d.DepartmentCode == "ht").Counts.ShouldBe(Of(preparing: 2, overdue: 1, open: 2), "0001 quá hạn, 0008 hạn hôm nay thì chưa");
        chair.Departments.Single(d => d.DepartmentCode == "kt").Counts.Overdue.ShouldBe(1);
        chair.Totals.Overdue.ShouldBe(2);
        chair.Totals.Open.ShouldBe(5, "quá hạn nằm TRONG số đang xử lý, không cộng thêm");

        (await GetAsync("demo_council")).Totals.Overdue.ShouldBe(0, "hồ sơ đã lưu trữ không bao giờ quá hạn");
    }

    [Fact]
    public async Task Lanh_dao_HDND_thay_ba_loi_vao_va_hoat_dong_khac_tu_khoi_HDND_khong_lan_khoi_UBND()
    {
        await ResetAsync();
        var summary = await GetAsync("demo_council");
        summary.Role.ShouldBe("council");
        summary.OrganizationCode.ShouldBe("tl-hdnd");
        summary.Departments.ShouldBeEmpty();
        summary.Activities.Select(a => a.Activity).ShouldBe(["session", "review", "oversight", "other"]);
        summary.Activities.Select(a => a.Label).ShouldBe(["Kỳ họp và nghị quyết", "Thẩm tra của các Ban", "Giám sát và kiến nghị", "Hoạt động khác (đại biểu, chương trình công tác)"]);

        var byActivity = summary.Activities.ToDictionary(a => a.Activity);
        byActivity["session"].Counts.ShouldBe(Of(), "0007 kỳ họp đã lưu trữ nên không còn đang xử lý");
        byActivity["session"].WorkGroupCodes.ShouldBe(["H01", "H02"]);
        byActivity["review"].Counts.ShouldBe(Of(check: 1, open: 1), "0005 thẩm tra của Ban Kinh tế");
        byActivity["oversight"].Counts.ShouldBe(Of(opinion: 1, open: 1), "0006 giám sát");
        byActivity["other"].Counts.ShouldBe(Of());
        summary.Totals.ShouldBe(Of(check: 1, opinion: 1, open: 2), "không có hồ sơ khối UBND");

        // Nhóm hồ sơ ngoài ba lối vào (H09 đại biểu) và nhóm mới chưa có trong bảng đều rơi vào "other", không mất khỏi tổng.
        var cv = await api.UserIdAsync("demo_cv_ht");
        await api.ExecuteAsync("""
            INSERT INTO hoso.dossiers(code, origin, title, year, organization_code, department_code, work_group_code, status, created_by)
            VALUES ('LDR-H09', 'internal', 'Đại biểu thử', 2026, 'tl-hdnd', 'db', 'H09', 'draft', $1),
                   ('LDR-H02', 'internal', 'Nghị quyết thử', 2026, 'tl-hdnd', 'tt', 'H02', 'draft', $1),
                   ('LDR-H08', 'internal', 'Đơn thư thử', 2026, 'tl-hdnd', 'tt', 'H08', 'returned', $1)
            """, cv);
        var after = await GetAsync("demo_council");
        after.Activities.Single(a => a.Activity == "other").Counts.ShouldBe(Of(preparing: 1, open: 1));
        after.Activities.Single(a => a.Activity == "other").WorkGroupCodes.ShouldBe(["H09"]);
        after.Activities.Single(a => a.Activity == "session").Counts.ShouldBe(Of(preparing: 1, open: 1), "H02 thuộc kỳ họp và nghị quyết");
        after.Activities.Single(a => a.Activity == "oversight").Counts.ShouldBe(Of(preparing: 1, opinion: 1, open: 2), "H08 thuộc giám sát và kiến nghị");
        after.Activities.Sum(a => a.Counts.Open).ShouldBe(after.Totals.Open, "các hoạt động cộng lại bằng tổng");
    }

    [Fact]
    public async Task Ho_so_han_che_khong_cap_quyen_khong_nam_trong_so_va_chi_dung_phan_cong_lanh_dao()
    {
        await ResetAsync();
        await api.ExecuteAsync("UPDATE hoso.dossiers SET access_level = 'restricted' WHERE code = 'DEMO-2026-0003'");
        var chair = await GetAsync("demo_chair");
        chair.Totals.Open.ShouldBe(4, "hồ sơ hạn chế chưa được cấp quyền thì không đếm: số liệu không lộ sự tồn tại của nó");
        chair.Departments.Single(d => d.DepartmentCode == "kt").Counts.ShouldBe(Of(check: 1, open: 1));

        // Chỉ vai trò lãnh đạo (dossier.decide) mới gọi được.
        foreach (var other in new[] { "demo_head_ht", "demo_cv_ht", "demo_clerk_ubnd", "demo_admin" })
            (await (await api.LoginAsync(other)).GetAsync("/api/v1/workspace/leadership", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Forbidden, other);
        (await api.CreateClient().GetAsync("/api/v1/workspace/leadership", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}
