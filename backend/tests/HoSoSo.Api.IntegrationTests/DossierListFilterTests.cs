using System.Net;
using System.Text;
using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-111: bộ lọc năm, người chủ trì, quá hạn, vị trí kho; sắp xếp theo cột với phân trang keyset; xuất CSV cùng bộ lọc.</summary>
public sealed class DossierListFilterTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record Item(Guid Id, string Code, string Title, string? AssigneeName, DateOnly? DueOn, DateTimeOffset UpdatedAt);
    private sealed record Page(List<Item> Items, string? NextCursor);

    private static readonly string[] Sorts = ["updated", "code", "title", "due"];

    /// <summary>40 hồ sơ phòng Hạ tầng (cùng 2 hồ sơ mẫu) với năm, hạn, người chủ trì và tiêu đề đa dạng; nhiều hồ sơ trùng hạn để thử phân định bằng Id.</summary>
    private async Task<(Guid Cv, Guid Cv2)> SeedAsync()
    {
        var cv = await api.UserIdAsync("demo_cv_ht");
        var cv2 = await api.UserIdAsync("demo_cv_ht_02");
        await api.ExecuteAsync("DELETE FROM hoso.dossiers WHERE code LIKE 'LST-%'");      // các test trong lớp dùng chung một CSDL: mỗi test nạp lại từ đầu
        await api.ExecuteAsync("""
            INSERT INTO hoso.dossiers(code, origin, title, year, organization_code, department_code, work_group_code, assignee_id, status, internal_due_on, created_by, updated_at, storage_location_id)
            SELECT 'LST-' || lpad(n::text, 3, '0'), 'internal',
                   CASE n % 4 WHEN 0 THEN 'Đất đai thôn ' WHEN 1 THEN 'Đường liên xã ' WHEN 2 THEN 'Ân hạn khoản vay ' ELSE 'Bàn giao tài sản ' END || n,
                   CASE WHEN n % 5 = 0 THEN 2025 ELSE 2026 END, 'tl-ubnd', 'ht', 'U15',
                   CASE WHEN n % 3 = 0 THEN $1 WHEN n % 3 = 1 THEN $2 ELSE NULL END,
                   CASE WHEN n % 7 = 0 THEN 'returned' ELSE 'draft' END,
                   CASE WHEN n % 6 = 0 THEN NULL ELSE (current_date + ((n % 5) - 2) * 3) END,   -- nhiều hồ sơ trùng hạn; một số chưa có hạn; một số quá hạn
                   $1, now() - (n % 9) * interval '1 minute', NULL
            FROM generate_series(1, 40) n
            """, cv, cv2);
        return (cv, cv2);
    }

    private async Task<Page> GetAsync(HttpClient http, string query) =>
        await (await http.GetAsync($"/api/v1/dossiers?{query}", TestContext.Current.CancellationToken)).ReadAsync<Page>();

    private async Task<List<Item>> AllPagesAsync(HttpClient http, string query, int pageSize)
    {
        var all = new List<Item>();
        string? cursor = null;
        for (var guard = 0; guard < 50; guard++)
        {
            var page = await GetAsync(http, $"{query}&limit={pageSize}" + (cursor is null ? "" : $"&cursor={cursor}"));
            all.AddRange(page.Items);
            if (page.NextCursor is null) return all;
            cursor = page.NextCursor;
        }
        throw new InvalidOperationException("Phân trang không dừng.");
    }

    [Fact]
    public async Task Moi_cach_sap_xep_phan_trang_keyset_ra_dung_thu_tu_khong_lap_khong_sot()
    {
        await SeedAsync();
        var http = await api.LoginAsync("demo_head_ht");
        foreach (var sort in Sorts)
        foreach (var dir in new[] { "asc", "desc" })
        {
            var query = $"sort={sort}&dir={dir}";
            var whole = (await GetAsync(http, query + "&limit=100")).Items;
            whole.Count.ShouldBeGreaterThanOrEqualTo(42);
            var paged = await AllPagesAsync(http, query, 7);
            paged.Select(i => i.Id).ShouldBe(whole.Select(i => i.Id), $"sort={sort} dir={dir}: phân trang phải trùng danh sách một lần");
            paged.Select(i => i.Id).Distinct().Count().ShouldBe(paged.Count, $"sort={sort} dir={dir}: không lặp");

            switch (sort)
            {
                case "code":
                    whole.Select(i => i.Code).ShouldBe(dir == "asc" ? whole.Select(i => i.Code).OrderBy(c => c, StringComparer.Ordinal).ToList() : whole.Select(i => i.Code).OrderByDescending(c => c, StringComparer.Ordinal).ToList(), $"code {dir}");
                    break;
                case "due":
                    var firstEmpty = whole.FindIndex(i => i.DueOn is null);
                    firstEmpty.ShouldBeGreaterThan(0, "có hồ sơ chưa có hạn");
                    whole.Skip(firstEmpty).ShouldAllBe(i => i.DueOn == null, $"due {dir}: hồ sơ chưa có hạn luôn xếp cuối");
                    var dates = whole.Take(firstEmpty).Select(i => i.DueOn!.Value).ToList();
                    dates.ShouldBe(dir == "asc" ? dates.OrderBy(d => d).ToList() : dates.OrderByDescending(d => d).ToList());
                    break;
                case "updated":
                    whole.Select(i => i.UpdatedAt).ShouldBe(dir == "asc" ? whole.Select(i => i.UpdatedAt).OrderBy(d => d).ToList() : whole.Select(i => i.UpdatedAt).OrderByDescending(d => d).ToList());
                    break;
            }
        }
    }

    [Fact]
    public async Task Mac_dinh_van_la_moi_cap_nhat_truoc_va_con_tro_sai_hoac_doi_cach_sap_xep_bi_tu_choi_400()
    {
        await SeedAsync();
        var http = await api.LoginAsync("demo_head_ht");
        var byDefault = (await GetAsync(http, "limit=100")).Items;
        byDefault.Select(i => i.UpdatedAt).ShouldBe(byDefault.Select(i => i.UpdatedAt).OrderByDescending(d => d).ToList());

        var cursor = (await GetAsync(http, "sort=code&limit=5")).NextCursor.ShouldNotBeNull();
        foreach (var bad in new[] { $"sort=title&cursor={cursor}", $"sort=code&dir=desc&cursor={cursor}", "cursor=khong-phai-con-tro", "sort=code&cursor=e30", "sort=gia-tri-la", "dir=ngang" })
            (await http.GetAsync($"/api/v1/dossiers?{bad}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.BadRequest, bad);
    }

    [Fact]
    public async Task Loc_theo_nam_nguoi_chu_tri_va_qua_han_va_ket_hop_voi_cac_bo_loc_cu()
    {
        var (cv, cv2) = await SeedAsync();
        var http = await api.LoginAsync("demo_head_ht");

        var y2025 = await AllPagesAsync(http, "year=2025", 10);
        y2025.Count.ShouldBe(8, "n chia hết cho 5 trong 1..40");
        (await AllPagesAsync(http, "year=2026", 10)).Count.ShouldBe(34, "32 hồ sơ mới + 2 hồ sơ mẫu");

        var byCv2 = await AllPagesAsync(http, $"assignee={cv2}", 10);
        byCv2.Count.ShouldBe(14, "n % 3 = 1 trong 1..40");
        byCv2.ShouldAllBe(i => i.AssigneeName != null);

        var overdue = await AllPagesAsync(http, "overdue=true", 10);
        overdue.ShouldNotBeEmpty();
        var vietnamToday = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        overdue.ShouldAllBe(i => i.DueOn != null && i.DueOn < vietnamToday, "chỉ hồ sơ có hạn trước hôm nay");
        (await AllPagesAsync(http, "sort=updated", 100)).Count(i => i.DueOn != null && i.DueOn < vietnamToday).ShouldBe(overdue.Count, "không sót hồ sơ quá hạn");

        // Kết hợp: năm + người chủ trì + trạng thái + quá hạn đều AND.
        var combined = await AllPagesAsync(http, $"year=2026&assignee={cv}&status=returned&overdue=true", 10);
        combined.ShouldAllBe(i => i.DueOn < vietnamToday);
        var expected = await api.ScalarAsync<long>("SELECT count(*) FROM hoso.dossiers WHERE department_code = 'ht' AND year = 2026 AND assignee_id = $1 AND status = 'returned' AND internal_due_on < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AND status <> 'archived'", cv);
        combined.Count.ShouldBe((int)expected);

        // Hồ sơ đã lưu trữ không bao giờ "quá hạn".
        await api.ExecuteAsync("UPDATE hoso.dossiers SET status = 'archived', archived_at = now() WHERE code = 'LST-001'");
        await api.ExecuteAsync("UPDATE hoso.dossiers SET internal_due_on = current_date - 30 WHERE code IN ('LST-001','LST-002')");
        (await AllPagesAsync(http, "overdue=true", 50)).Select(i => i.Code).ShouldNotContain("LST-001");
        (await AllPagesAsync(http, "overdue=true", 50)).Select(i => i.Code).ShouldContain("LST-002");

        // Phạm vi vẫn áp: trưởng phòng Kinh tế không thấy hồ sơ phòng Hạ tầng dù lọc đúng người chủ trì.
        var other = await api.LoginAsync("demo_head_kt");
        (await GetAsync(other, $"assignee={cv}")).Items.ShouldBeEmpty();
    }

    [Fact]
    public async Task Trang_thai_va_nhom_nhan_nhieu_gia_tri_cach_nhau_dau_phay_va_chan_danh_sach_qua_dai()
    {
        await SeedAsync();
        await api.ExecuteAsync("UPDATE hoso.dossiers SET work_group_code = 'U16' WHERE code IN ('LST-001','LST-002','LST-003')");
        var http = await api.LoginAsync("demo_head_ht");
        async Task<int> CountAsync(string query) => (await AllPagesAsync(http, query, 20)).Count;

        var draft = await CountAsync("status=draft");
        var returned = await CountAsync("status=returned");
        draft.ShouldBeGreaterThan(0);
        returned.ShouldBeGreaterThan(0);
        (await CountAsync("status=draft,returned")).ShouldBe(draft + returned, "hai trạng thái = cộng hai");
        (await CountAsync("status=%20draft%20,%20returned%20,draft")).ShouldBe(draft + returned, "bỏ khoảng trắng và giá trị lặp");
        (await CountAsync("status=submitted-khong-co")).ShouldBe(0);

        var u15 = await CountAsync("workGroup=U15");
        var u16 = await CountAsync("workGroup=U16");
        u16.ShouldBe(3);
        (await CountAsync("workGroup=U15,U16")).ShouldBe(u15 + u16);
        (await CountAsync("workGroup=U16,U19&status=draft,returned")).ShouldBeLessThanOrEqualTo(u16 + await CountAsync("workGroup=U19"));

        (await http.GetAsync($"/api/v1/dossiers?status={string.Join(',', Enumerable.Range(0, 13).Select(i => "s" + i))}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await http.GetAsync($"/api/v1/dossiers?workGroup={new string('x', 41)}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Loc_theo_vi_tri_kho_gom_ca_vi_tri_con_va_khong_nham_vi_tri_anh_em()
    {
        await SeedAsync();
        var warehouse = await api.ScalarAsync<Guid>("INSERT INTO hoso.storage_locations(kind, code, name, organization_code, qr_payload) VALUES ('warehouse','KHO-LST','Kho lưu trữ','tl-ubnd','qr-kho-lst') RETURNING id");
        var room = await api.ScalarAsync<Guid>("INSERT INTO hoso.storage_locations(parent_id, kind, code, name, organization_code, qr_payload) VALUES ($1,'room','PH-LST','Phòng 1','tl-ubnd','qr-ph-lst') RETURNING id", warehouse);
        var cabinet = await api.ScalarAsync<Guid>("INSERT INTO hoso.storage_locations(parent_id, kind, code, name, organization_code, qr_payload) VALUES ($1,'cabinet','TU-LST','Tủ A','tl-ubnd','qr-tu-lst') RETURNING id", room);
        var sibling = await api.ScalarAsync<Guid>("INSERT INTO hoso.storage_locations(parent_id, kind, code, name, organization_code, qr_payload) VALUES ($1,'room','PH-LST2','Phòng 2','tl-ubnd','qr-ph-lst2') RETURNING id", warehouse);
        await api.ExecuteAsync("UPDATE hoso.dossiers SET storage_location_id = $1 WHERE code IN ('LST-010','LST-011')", cabinet);
        await api.ExecuteAsync("UPDATE hoso.dossiers SET storage_location_id = $1 WHERE code = 'LST-012'", room);
        await api.ExecuteAsync("UPDATE hoso.dossiers SET storage_location_id = $1 WHERE code = 'LST-013'", sibling);

        var http = await api.LoginAsync("demo_head_ht");
        async Task<List<string>> CodesAsync(Guid location) => (await AllPagesAsync(http, $"locationId={location}&sort=code", 2)).Select(i => i.Code).ToList();

        (await CodesAsync(cabinet)).ShouldBe(["LST-010", "LST-011"]);
        (await CodesAsync(room)).ShouldBe(["LST-010", "LST-011", "LST-012"], "phòng gồm cả tủ con");
        (await CodesAsync(warehouse)).ShouldBe(["LST-010", "LST-011", "LST-012", "LST-013"], "kho gồm cả phòng và tủ con");
        (await CodesAsync(sibling)).ShouldBe(["LST-013"], "phòng anh em không lẫn");
        (await CodesAsync(Guid.NewGuid())).ShouldBeEmpty("vị trí không có thì rỗng, không lỗi");
    }

    [Fact]
    public async Task Xuat_CSV_theo_cung_bo_loc_chong_cong_thuc_ghi_nhat_ky_va_chi_nguoi_co_quyen_xuat()
    {
        await SeedAsync();
        await api.ExecuteAsync("UPDATE hoso.dossiers SET title = '=HYPERLINK(\"http://x\",\"mo\")' WHERE code = 'LST-005'");
        await api.ExecuteAsync("UPDATE hoso.dossiers SET title = 'Hồ sơ, có \"dấu phẩy\" và nháy' WHERE code = 'LST-010'");
        var manager = await api.LoginAsync("demo_head_ht");

        var response = await manager.GetAsync("/api/v1/dossiers/export.csv?year=2025&sort=code", TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.ShouldBe("text/csv");
        response.Content.Headers.ContentDisposition!.FileName.ShouldNotBeNull().ShouldStartWith("danh-sach-ho-so-");
        var bytes = await response.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        bytes.Take(3).ShouldBe([(byte)0xEF, (byte)0xBB, (byte)0xBF], "BOM UTF-8 để Excel đọc đúng tiếng Việt");
        var csv = Encoding.UTF8.GetString(bytes[3..]);
        var lines = csv.Split("\r\n", StringSplitOptions.RemoveEmptyEntries);
        lines[0].ShouldBe("Mã hồ sơ,Tên hồ sơ,Nhóm hồ sơ,Phòng/Ban,Trạng thái,Người chủ trì,Hạn nội bộ,Cập nhật lần cuối,Số giấy tờ,Vị trí lưu");
        lines.Length.ShouldBe(1 + 8, "chỉ 8 hồ sơ năm 2025, đúng bộ lọc");
        lines.Skip(1).Select(l => l[..7]).ShouldBe(["LST-005", "LST-010", "LST-015", "LST-020", "LST-025", "LST-030", "LST-035", "LST-040"], "đúng thứ tự sort=code");
        csv.ShouldContain("'=HYPERLINK(", Case.Sensitive, "ô bắt đầu bằng = bị vô hiệu hóa công thức");
        csv.ShouldNotContain(",=HYPERLINK", Case.Sensitive);
        csv.ShouldContain("\"Hồ sơ, có \"\"dấu phẩy\"\" và nháy\"", Case.Sensitive, "dấu phẩy và nháy kép được thoát đúng RFC 4180");

        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.access_events e JOIN hoso.users u ON u.id = e.user_id WHERE e.action = 'export' AND e.object_type = 'dossier_list' AND u.username = 'demo_head_ht'")).ShouldBe(1, "ghi nhật ký đồng bộ trước khi trả");

        // Phạm vi: trưởng phòng Kinh tế chỉ xuất hồ sơ của phòng mình; chuyên viên không có quyền xuất.
        var other = await (await api.LoginAsync("demo_head_kt")).GetAsync("/api/v1/dossiers/export.csv", TestContext.Current.CancellationToken);
        Encoding.UTF8.GetString(await other.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken)).ShouldNotContain("LST-");
        (await (await api.LoginAsync("demo_cv_ht")).GetAsync("/api/v1/dossiers/export.csv", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await api.CreateClient().GetAsync("/api/v1/dossiers/export.csv", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public void Cell_chong_cong_thuc_va_thoat_ky_tu_dac_biet()
    {
        foreach (var dangerous in new[] { "=1+1", "+cmd", "-2", "@SUM(A1)", "\tx", "\rx" })
            HoSoSo.Application.Dossiers.DossierCsv.Cell(dangerous).Replace("\"", "").StartsWith('\'').ShouldBeTrue(dangerous);
        HoSoSo.Application.Dossiers.DossierCsv.Cell("bình thường").ShouldBe("bình thường");
        HoSoSo.Application.Dossiers.DossierCsv.Cell("a,b").ShouldBe("\"a,b\"");
        HoSoSo.Application.Dossiers.DossierCsv.Cell("dòng 1\ndòng 2").ShouldBe("\"dòng 1\ndòng 2\"");
        HoSoSo.Application.Dossiers.DossierCsv.Cell("").ShouldBe("");
    }
}
