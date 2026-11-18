using System.Diagnostics;
using System.Net;
using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-111: tiêu chí "20.000 hồ sơ &lt; 200 ms" cho danh sách có bộ lọc, sắp xếp theo cột và trang sâu; xuất CSV chặn khi quá 10.000 dòng.</summary>
public sealed class DossierListPerformanceTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record Item(Guid Id, string Code);
    private sealed record Page(List<Item> Items, string? NextCursor);

    private const int Total = 20_000;

    private async Task SeedAsync()
    {
        if (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.dossiers WHERE code LIKE 'PERF-%'") >= Total) return;
        var cv = await api.UserIdAsync("demo_cv_ht");
        var cv2 = await api.UserIdAsync("demo_cv_ht_02");
        await api.ExecuteAsync("""
            INSERT INTO hoso.dossiers(code, origin, title, year, organization_code, department_code, work_group_code, assignee_id, status, internal_due_on, created_by, updated_at)
            SELECT 'PERF-' || lpad(n::text, 6, '0'), 'internal',
                   (ARRAY['Đất đai','Đường giao thông','Ngân sách','Tiếp công dân','Môi trường'])[1 + n % 5] || ' số ' || n,
                   2020 + n % 7, 'tl-ubnd', 'ht', 'U15',
                   CASE WHEN n % 3 = 0 THEN $1 WHEN n % 3 = 1 THEN $2 END,
                   (ARRAY['draft','returned','department_review','ready_archive'])[1 + n % 4],
                   CASE WHEN n % 8 = 0 THEN NULL ELSE current_date + ((n % 60) - 30) END,
                   $1, now() - (n * interval '17 seconds')
            FROM generate_series(1, $3) n
            """, cv, cv2, Total);
        await api.ExecuteAsync("ANALYZE hoso.dossiers");
    }

    private static async Task<(HttpStatusCode Status, double Ms)> TimeAsync(HttpClient http, string url)
    {
        var started = Stopwatch.GetTimestamp();
        var response = await http.GetAsync(url, TestContext.Current.CancellationToken);
        await response.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        return (response.StatusCode, Stopwatch.GetElapsedTime(started).TotalMilliseconds);
    }

    [Fact]
    public async Task Danh_sach_20000_ho_so_duoi_200ms_voi_loc_sap_xep_va_trang_sau()
    {
        await SeedAsync();
        var manager = await api.LoginAsync("demo_head_ht");
        var cv2 = await api.UserIdAsync("demo_cv_ht_02");
        var deepCursor = (await (await manager.GetAsync("/api/v1/dossiers?sort=code&limit=100", TestContext.Current.CancellationToken)).ReadAsync<Page>()).NextCursor!;
        for (var i = 0; i < 150; i++)      // đi sâu ~15.000 dòng
            deepCursor = (await (await manager.GetAsync($"/api/v1/dossiers?sort=code&limit=100&cursor={deepCursor}", TestContext.Current.CancellationToken)).ReadAsync<Page>()).NextCursor ?? deepCursor;

        var cases = new (string Name, string Url)[]
        {
            ("mặc định (mới cập nhật)", "/api/v1/dossiers?limit=25"),
            ("sắp xếp theo mã", "/api/v1/dossiers?sort=code&limit=25"),
            ("sắp xếp theo tên", "/api/v1/dossiers?sort=title&limit=25"),
            ("sắp xếp theo hạn giảm dần", "/api/v1/dossiers?sort=due&dir=desc&limit=25"),
            ("lọc năm", "/api/v1/dossiers?year=2024&limit=25"),
            ("lọc người chủ trì", $"/api/v1/dossiers?assignee={cv2}&limit=25"),
            ("lọc quá hạn", "/api/v1/dossiers?overdue=true&sort=due&limit=25"),
            ("kết hợp năm + người + quá hạn", $"/api/v1/dossiers?year=2024&assignee={cv2}&overdue=true&limit=25"),
            ("tìm theo từ khóa", "/api/v1/dossiers?q=duong%20giao&limit=25"),
            ("trang sâu (khoảng dòng 15.000) theo mã", $"/api/v1/dossiers?sort=code&limit=25&cursor={deepCursor}"),
        };

        await TimeAsync(manager, cases[0].Url);          // làm nóng: biên dịch truy vấn, mở kết nối
        var report = new List<string>();
        var slow = new List<string>();
        foreach (var (name, url) in cases)
        {
            var runs = new List<double>();
            for (var i = 0; i < 5; i++)
            {
                var (status, ms) = await TimeAsync(manager, url);
                status.ShouldBe(HttpStatusCode.OK, name);
                runs.Add(ms);
            }
            runs.Sort();
            var median = runs[2];
            report.Add($"{name}: {median:F0} ms (nhỏ nhất {runs[0]:F0}, lớn nhất {runs[^1]:F0})");
            if (median >= 200) slow.Add($"{name}: {median:F0} ms");
        }
        TestContext.Current.SendDiagnosticMessage("BE-111 · 20.000 hồ sơ · trung vị 5 lần:\n  " + string.Join("\n  ", report));
        // Đặt HOSO_PERF_REPORT=<tệp> để giữ số đo (khi test qua thì xunit không in gì).
        if (Environment.GetEnvironmentVariable("HOSO_PERF_REPORT") is { Length: > 0 } path) await File.AppendAllTextAsync(path, "BE-111 · 20.000 hồ sơ · trung vị 5 lần\n  " + string.Join("\n  ", report) + "\n", TestContext.Current.CancellationToken);
        slow.ShouldBeEmpty("tiêu chí BE-111: < 200 ms\n" + string.Join("\n", report));
    }

    [Fact]
    public async Task Nguoi_chi_thay_vai_ho_so_trong_20000_van_nhanh_ca_khi_sap_theo_ten_va_han()
    {
        await SeedAsync();
        // Trưởng phòng Kinh tế: gần như mọi hồ sơ nằm ngoài phạm vi. Trước đây PostgreSQL gọi hàm scope_matches cho từng dòng đi qua chỉ mục
        // (~350 ms một mình, ~1,1 giây khi chạy song song). Từ 18/11/2026 ScopeFilter loại trước theo cơ quan/phòng/vai trò của phân công
        // (điều kiện cần, vẫn AND với scope_matches) nên trường hợp này cũng phải đạt tiêu chí < 200 ms.
        var other = await api.LoginAsync("demo_head_kt");
        var report = new List<string>();
        foreach (var (name, url) in new[]
        {
            ("phòng khác · mặc định", "/api/v1/dossiers?limit=25"),
            ("phòng khác · theo tên", "/api/v1/dossiers?sort=title&limit=25"),
            ("phòng khác · theo hạn giảm dần", "/api/v1/dossiers?sort=due&dir=desc&limit=25"),
        })
        {
            await TimeAsync(other, url);
            var runs = new List<double>();
            for (var i = 0; i < 3; i++)
            {
                var (status, ms) = await TimeAsync(other, url);
                status.ShouldBe(HttpStatusCode.OK, name);
                runs.Add(ms);
            }
            runs.Sort();
            report.Add($"{name}: {runs[1]:F0} ms");
            runs[1].ShouldBeLessThan(200, $"{name}: tiêu chí BE-111 < 200 ms cả khi người dùng gần như không thấy hồ sơ nào");
        }
        if (Environment.GetEnvironmentVariable("HOSO_PERF_REPORT") is { Length: > 0 } path) await File.AppendAllTextAsync(path, "BE-111 · người gần như không thấy hồ sơ nào trong 20.000\n  " + string.Join("\n  ", report) + "\n", TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Xuat_CSV_tren_10000_dong_bi_tu_choi_422_khong_cat_bot_am_tham()
    {
        await SeedAsync();
        var manager = await api.LoginAsync("demo_head_ht");
        var tooMany = await manager.GetAsync("/api/v1/dossiers/export.csv", TestContext.Current.CancellationToken);
        tooMany.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await tooMany.ProblemCodeAsync()).ShouldBe("export_too_large");

        // Thu hẹp bộ lọc thì xuất được; 10.000 dòng là giới hạn, đo thời gian của chính lần xuất đó.
        var started = Stopwatch.GetTimestamp();
        var narrowed = await manager.GetAsync("/api/v1/dossiers/export.csv?year=2024&status=draft", TestContext.Current.CancellationToken);
        narrowed.StatusCode.ShouldBe(HttpStatusCode.OK);
        var rows = (await narrowed.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).Split("\r\n", StringSplitOptions.RemoveEmptyEntries).Length - 1;
        rows.ShouldBeInRange(1, 10_000);
        TestContext.Current.SendDiagnosticMessage($"BE-111 · xuất CSV {rows} dòng: {Stopwatch.GetElapsedTime(started).TotalMilliseconds:F0} ms");
    }
}
