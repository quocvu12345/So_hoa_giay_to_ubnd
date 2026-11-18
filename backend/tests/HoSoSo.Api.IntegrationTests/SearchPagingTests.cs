using System.Net;
using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-112: tra cứu phân trang bằng cursor (không lặp, không sót, tổng không đổi) và lọc cơ quan ban hành.</summary>
public sealed class SearchPagingTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record Hit(string Kind, Guid Id, string Title);
    private sealed record Result(List<Hit> Hits, int TotalDocuments, int TotalDossiers, string? NextCursor);

    private const string Keyword = "phan trang thu nghiem";

    /// <summary>
    /// 45 văn bản công khai khớp từ khóa: tiêu đề dài ngắn khác nhau (độ khớp khác nhau) và từng nhóm trùng tiêu đề (độ khớp trùng, phân định bằng Id);
    /// 12 hồ sơ phòng Hạ tầng; cơ quan ban hành: 20 văn bản của "Sở Tài chính", 10 của UBND (có mã cơ quan), còn lại không ghi.
    /// </summary>
    private async Task SeedAsync()
    {
        await api.ExecuteAsync("DELETE FROM hoso.dossiers WHERE code LIKE 'SRCH-%'");
        await api.ExecuteAsync("DELETE FROM hoso.documents WHERE title LIKE '%phân trang thử nghiệm%'");
        await api.ExecuteAsync("""
            INSERT INTO hoso.documents(origin, title, document_form, document_number, issued_on, source_id, issuer_name, issuer_organization_code)
            SELECT 'public_source',
                   'Quyết định phân trang thử nghiệm ' || repeat('bổ sung ', (n % 6)) || CASE WHEN n % 3 = 0 THEN 'nhóm trùng' ELSE 'số ' || n END,
                   'Quyết định', 'PT-' || n || '/QĐ', date '2026-01-01' + n,
                   (SELECT source_id FROM hoso.documents WHERE external_key = 'public-001'),
                   CASE WHEN n <= 20 THEN 'Sở Tài chính' WHEN n <= 30 THEN 'Ủy ban nhân dân phường Từ Liêm' END,
                   CASE WHEN n BETWEEN 21 AND 30 THEN 'tl-ubnd' END
            FROM generate_series(1, 45) n
            """);
        var cv = await api.UserIdAsync("demo_cv_ht");
        await api.ExecuteAsync("""
            INSERT INTO hoso.dossiers(code, origin, title, year, organization_code, department_code, work_group_code, assignee_id, status, created_by, updated_at)
            SELECT 'SRCH-' || lpad(n::text, 2, '0'), 'internal', 'Hồ sơ phân trang thử nghiệm ' || n, 2026, 'tl-ubnd', 'ht', 'U15', $1, 'draft', $1,
                   now() - (CASE WHEN n % 4 = 0 THEN 0 ELSE n END) * interval '1 minute'      -- một số hồ sơ trùng thời điểm cập nhật
            FROM generate_series(1, 12) n
            """, cv);
    }

    private async Task<Result> SearchAsync(HttpClient http, string query) =>
        await (await http.GetAsync($"/api/v1/search?q={Uri.EscapeDataString(Keyword)}&{query}", TestContext.Current.CancellationToken)).ReadAsync<Result>();

    private async Task<(List<Hit> Hits, List<Result> Pages)> WalkAsync(HttpClient http, string query, int limit)
    {
        var hits = new List<Hit>();
        var pages = new List<Result>();
        string? cursor = null;
        for (var guard = 0; guard < 40; guard++)
        {
            var page = await SearchAsync(http, $"{query}&limit={limit}" + (cursor is null ? "" : $"&cursor={cursor}"));
            pages.Add(page);
            hits.AddRange(page.Hits);
            if (page.NextCursor is null) return (hits, pages);
            cursor = page.NextCursor;
        }
        throw new InvalidOperationException("Phân trang tra cứu không dừng.");
    }

    [Fact]
    public async Task Giay_to_phan_trang_khong_lap_khong_sot_dung_thu_tu_va_tong_khong_doi()
    {
        await SeedAsync();
        var http = await api.LoginAsync("demo_cv_ht");
        var whole = await SearchAsync(http, "kind=documents&limit=50");
        whole.Hits.Count.ShouldBe(45);
        whole.NextCursor.ShouldBeNull("45 ≤ 50: một trang là hết");

        var (paged, pages) = await WalkAsync(http, "kind=documents", 8);
        paged.Select(h => h.Id).ShouldBe(whole.Hits.Select(h => h.Id), "phân trang phải ra đúng thứ tự của danh sách một lần");
        paged.Select(h => h.Id).Distinct().Count().ShouldBe(45, "không lặp");
        pages.Count.ShouldBe(6, "45 kết quả, 8 mỗi trang");
        pages.ShouldAllBe(p => p.TotalDocuments == 45, "tổng không đổi giữa các trang");
        pages.Take(5).ShouldAllBe(p => p.NextCursor != null);
        pages[^1].NextCursor.ShouldBeNull();
        pages[^1].Hits.Count.ShouldBe(5);
    }

    [Fact]
    public async Task Tim_ca_giay_to_va_ho_so_moi_dong_di_theo_con_tro_rieng_trong_cung_mot_con_tro()
    {
        await SeedAsync();
        var http = await api.LoginAsync("demo_cv_ht");
        var manager = await api.LoginAsync("demo_head_ht");        // chuyên viên chỉ thấy hồ sơ mình chủ trì; cả hai đều thấy 12 hồ sơ này
        foreach (var client in new[] { http, manager })
        {
            var (hits, pages) = await WalkAsync(client, "kind=all", 10);
            hits.Where(h => h.Kind == "document").Select(h => h.Id).Distinct().Count().ShouldBe(45);
            hits.Where(h => h.Kind == "dossier").Select(h => h.Id).Distinct().Count().ShouldBe(12);
            hits.Count.ShouldBe(45 + 12, "không lặp giữa các trang");
            pages.ShouldAllBe(p => p.TotalDocuments == 45 && p.TotalDossiers == 12);
            // Hồ sơ hết ở trang 2 (10 + 2): trang 3 trở đi chỉ còn giấy tờ, không "hỏi lại" hồ sơ từ đầu.
            pages[0].Hits.Count(h => h.Kind == "dossier").ShouldBe(10);
            pages[1].Hits.Count(h => h.Kind == "dossier").ShouldBe(2);
            pages.Skip(2).SelectMany(p => p.Hits).ShouldAllBe(h => h.Kind == "document");
            pages[^1].NextCursor.ShouldBeNull();
        }
        // Thứ tự hồ sơ: mới cập nhật trước, trùng thời điểm thì theo Id, không sót hồ sơ nào trùng ở ranh giới trang.
        var dossiers = (await WalkAsync(http, "kind=dossiers", 5)).Hits;
        dossiers.Count.ShouldBe(12);
        dossiers.Select(h => h.Id).Distinct().Count().ShouldBe(12);
        (await SearchAsync(http, "kind=dossiers&limit=50")).Hits.Select(h => h.Id).ShouldBe(dossiers.Select(h => h.Id));
    }

    [Fact]
    public async Task Loc_co_quan_ban_hanh_theo_ten_khong_dau_hoac_dung_ma_co_phan_trang_va_bo_phan_ho_so()
    {
        await SeedAsync();
        var http = await api.LoginAsync("demo_cv_ht");

        var finance = await SearchAsync(http, "kind=all&issuer=so%20tai%20chinh&limit=50");
        finance.TotalDocuments.ShouldBe(20, "gõ không dấu, không phân biệt hoa thường");
        finance.Hits.ShouldAllBe(h => h.Kind == "document", "lọc cơ quan ban hành chỉ có nghĩa với giấy tờ nên bỏ phần hồ sơ");
        finance.TotalDossiers.ShouldBe(0);

        var byCode = await SearchAsync(http, "kind=documents&issuer=tl-ubnd&limit=50");
        byCode.TotalDocuments.ShouldBe(10, "khớp đúng mã cơ quan");
        (await SearchAsync(http, "kind=documents&issuer=ỦY%20BAN%20NHÂN%20DÂN&limit=50")).TotalDocuments.ShouldBe(10, "khớp một phần tên, có dấu hoặc không");
        (await SearchAsync(http, "kind=documents&issuer=khong-co-co-quan-nay&limit=50")).Hits.ShouldBeEmpty();

        var (paged, pages) = await WalkAsync(http, "kind=documents&issuer=so%20tai%20chinh", 6);
        paged.Count.ShouldBe(20);
        paged.Select(h => h.Id).Distinct().Count().ShouldBe(20);
        pages.ShouldAllBe(p => p.TotalDocuments == 20);

        (await http.GetAsync($"/api/v1/search?q={Keyword.Replace(" ", "%20")}&issuer={new string('x', 201)}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Con_tro_sai_bi_tu_choi_400_va_tong_so_chi_tinh_trong_pham_vi_khi_phan_trang()
    {
        await SeedAsync();
        var http = await api.LoginAsync("demo_cv_ht");
        foreach (var bad in new[] { "khong-phai-con-tro", "eyJEIjoiYWJjIn0", Convert.ToBase64String("{\"D\":\"1|2|3\"}"u8.ToArray()) })
            (await http.GetAsync($"/api/v1/search?q={Uri.EscapeDataString(Keyword)}&cursor={bad}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.BadRequest, bad);

        // "{}" là con trỏ rỗng hợp lệ: chưa bắt đầu dòng nào, như không có con trỏ.
        (await SearchAsync(http, "kind=documents&limit=50&cursor=e30")).TotalDocuments.ShouldBe(45);

        // Giấy tờ của người khác còn trong hộp tiếp nhận, trùng từ khóa: không lọt vào trang nào và không vào tổng, kể cả khi đi qua nhiều trang.
        var other = await api.LoginAsync("demo_cv_kt");
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(System.Text.Encoding.ASCII.GetBytes("%PDF-1.4\n% phan-trang-ngoai-pham-vi\n%%EOF\n"));
        file.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", "ngoai-pham-vi.pdf");
        var up = await (await other.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='completed', started_at=now(), finished_at=now(), page_count=1, processed_pages=1 WHERE id=$1", up.JobId);
        await api.ExecuteAsync("INSERT INTO hoso.ocr_pages(job_id, page_no, method, text, status) VALUES ($1, 1, 'ocr', 'phân trang thử nghiệm của người khác', 'completed')", up.JobId);

        (await SearchAsync(http, "kind=documents&limit=50")).TotalDocuments.ShouldBe(45);
        var (paged, pages) = await WalkAsync(http, "kind=documents", 9);
        paged.Select(h => h.Id).ShouldNotContain(up.DocumentId);
        pages.ShouldAllBe(p => p.TotalDocuments == 45);
        var theirs = await SearchAsync(await api.LoginAsync("demo_cv_kt"), "kind=documents&limit=50");
        theirs.Hits.ShouldContain(h => h.Id == up.DocumentId, "chính chủ vẫn thấy giấy tờ của mình");
    }
}
