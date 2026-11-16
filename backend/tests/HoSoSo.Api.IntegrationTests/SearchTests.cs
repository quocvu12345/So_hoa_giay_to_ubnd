using System.Net;
using System.Net.Http.Headers;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Infrastructure.Auditing;
using Microsoft.Extensions.DependencyInjection;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-80: tìm không dấu theo số ký hiệu, tiêu đề và toàn văn OCR; luôn trong phạm vi người dùng.</summary>
public sealed class SearchTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record DossierRef(Guid Id, string Code);
    private sealed record Hit(string Kind, Guid Id, string Title, string? Number, int? Page, string? Snippet, List<DossierRef> Dossiers);
    private sealed record Result(string Query, List<Hit> Hits, int TotalDocuments, int TotalDossiers);

    private static async Task<UploadDto> UploadAsync(HttpClient http, string marker)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(System.Text.Encoding.ASCII.GetBytes($"%PDF-1.4\n% {marker}\n%%EOF\n"));
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", $"{marker}.pdf");
        return await (await http.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();
    }

    private async Task<Result> SearchAsync(HttpClient http, string q, string kind = "all", string extra = "") =>
        await (await http.GetAsync($"/api/v1/search?q={Uri.EscapeDataString(q)}&kind={kind}{extra}")).ReadAsync<Result>();

    private async Task<Guid> InsertPublicAsync(string title, string number, string form = "Nghị quyết", string? issuedOn = null) =>
        await api.ScalarAsync<Guid>("""
            INSERT INTO hoso.documents(origin, title, document_form, document_number, issued_on, source_id)
            SELECT 'public_source', $1, $3, $2, $4::date, source_id FROM hoso.documents WHERE external_key = 'public-001'
            RETURNING id
            """, title, number, form, issuedOn is null ? DBNull.Value : issuedOn);

    private async Task OcrAsync(UploadDto up, string text)
    {
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='completed', started_at=now(), finished_at=now(), page_count=1, processed_pages=1 WHERE id=$1", up.JobId);
        await api.ExecuteAsync("INSERT INTO hoso.ocr_pages(job_id, page_no, method, text, status) VALUES ($1, 1, 'ocr', $2, 'completed')", up.JobId, text);
    }

    [Fact]
    public async Task Tim_van_ban_cong_khai_bang_chu_khong_dau_va_theo_tien_to()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var byTitle = await SearchAsync(http, "du toan ngan sach", "documents");
        byTitle.Hits.ShouldContain(h => h.Title.Contains("dự toán thu, chi ngân sách"));
        var prefix = await SearchAsync(http, "du toa ngan sac", "documents");     // gõ dở: khớp tiền tố
        prefix.Hits.ShouldContain(h => h.Title.Contains("dự toán thu, chi ngân sách"));

        var number = await api.ScalarAsync<string>("SELECT document_number FROM hoso.documents WHERE external_key = 'public-002'");
        (await SearchAsync(http, number!, "documents")).Hits.ShouldContain(h => h.Number == number);
        (await SearchAsync(http, "chuoi-khong-bao-gio-co-xyz", "documents")).Hits.ShouldBeEmpty();
    }

    [Fact]
    public async Task Tim_trong_toan_van_OCR_va_chi_thay_giay_to_trong_pham_vi()
    {
        var mine = await api.LoginAsync("demo_cv_ht");
        var up = await UploadAsync(mine, "tim-toan-van");
        await OcrAsync(up, "BIÊN BẢN kiểm tra hiện trạng đất tại thửa số 128, tờ bản đồ số 09, thôn Hạ. Người lập: Nguyễn Văn An.");

        var found = await SearchAsync(mine, "hien trang dat thua 128", "documents");
        var hit = found.Hits.Single(h => h.Id == up.DocumentId);
        hit.Page.ShouldBe(1);
        hit.Snippet.ShouldNotBeNull().ShouldContain("hiện trạng", Case.Insensitive);   // đoạn trích giữ nguyên dấu
        (await SearchAsync(mine, "Nguyen Van An", "documents")).Hits.ShouldContain(h => h.Id == up.DocumentId);

        // Người khác không thấy PDF còn trong hộp tiếp nhận của tôi, dù từ khóa khớp.
        var other = await api.LoginAsync("demo_cv_kt");
        (await SearchAsync(other, "hien trang dat thua 128", "documents")).Hits.ShouldNotContain(h => h.Id == up.DocumentId);

        // Xếp vào hồ sơ: trưởng phòng cùng đơn vị tìm thấy kèm hồ sơ chứa nó; trưởng phòng đơn vị khác thì không.
        var dossier = await (await mine.PostJsonAsync("/api/v1/dossiers", new { title = "Hồ sơ thử tra cứu", workGroupCode = "U15" })).ReadAsync<DossierDetailDto>();
        (await mine.PostJsonAsync($"/api/v1/dossiers/{dossier.Id}/documents", new { documentId = up.DocumentId })).StatusCode.ShouldBe(HttpStatusCode.OK);
        var manager = await api.LoginAsync("demo_head_ht");
        var viaDossier = (await SearchAsync(manager, "hien trang dat thua 128", "documents")).Hits.Single(h => h.Id == up.DocumentId);
        viaDossier.Dossiers.Single().Id.ShouldBe(dossier.Id);
        var outsider = await api.LoginAsync("demo_head_kt");
        (await SearchAsync(outsider, "hien trang dat thua 128", "documents")).Hits.ShouldNotContain(h => h.Id == up.DocumentId);

        // Bỏ PDF thì không còn xuất hiện trong kết quả.
        var second = await UploadAsync(mine, "da-bo");
        await OcrAsync(second, "tai lieu da bo khoi hop tiep nhan");
        (await mine.PostJsonAsync($"/api/v1/intake/documents/{second.DocumentId}/discard")).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await SearchAsync(mine, "da bo khoi hop", "documents")).Hits.ShouldNotContain(h => h.Id == second.DocumentId);
    }

    [Fact]
    public async Task Tim_ho_so_theo_ma_hoac_ten_trong_pham_vi_va_chan_tu_khoa_nguy_hiem()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        (await SearchAsync(clerk, "dat dai", "dossiers")).Hits.Select(h => h.Title).ShouldContain(t => t.Contains("Đất đai"));
        (await SearchAsync(clerk, "DEMO-2026-0003", "dossiers")).Hits.Single().Kind.ShouldBe("dossier");
        // HĐND không thấy hồ sơ UBND.
        var council = await api.LoginAsync("demo_council");
        (await SearchAsync(council, "dat dai", "dossiers")).Hits.ShouldBeEmpty();

        // Ký tự toán tử của tsquery và SQL chỉ được coi là chữ thường, không gây lỗi.
        foreach (var nasty in new[] { "a & !b | (c)", "'; DROP TABLE hoso.documents; --", "hien:* <-> trang", "%_\\" })
        {
            var response = await clerk.GetAsync($"/api/v1/search?q={Uri.EscapeDataString(nasty)}");
            response.StatusCode.ShouldBeOneOf([HttpStatusCode.OK, HttpStatusCode.BadRequest], nasty);
        }
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.documents")).ShouldBeGreaterThan(0);
        (await clerk.GetAsync("/api/v1/search?q=a")).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await clerk.GetAsync("/api/v1/search")).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Moi_lan_tim_duoc_ghi_vao_nhat_ky_truy_cap_va_quan_tri_khong_tim_duoc()
    {
        var http = await api.LoginAsync("demo_cv_vp");
        await SearchAsync(http, "ngan sach");
        await api.Services.GetRequiredService<AccessEventQueue>().DrainAsync(TimeSpan.FromSeconds(10));
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.access_events e JOIN hoso.users u ON u.id = e.user_id WHERE u.username = 'demo_cv_vp' AND e.action = 'search'")).ShouldBe(1);
        var admin = await api.LoginAsync("demo_admin");
        (await admin.GetAsync("/api/v1/search?q=ngan%20sach")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }
    [Fact]
    public async Task So_ky_hieu_xep_dung_truoc_chua_chuoi_truoc_gan_dung_theo_pg_trgm()
    {
        var exact = await InsertPublicAsync("Văn bản thử xếp hạng alpha", "17/NQ-HĐND");
        var contains = await InsertPublicAsync("Văn bản thử xếp hạng beta", "117/NQ-HĐND");
        var approximate = await InsertPublicAsync("Văn bản thử xếp hạng gamma", "71/NQ-HĐND");
        var unrelated = await InsertPublicAsync("Văn bản thử xếp hạng delta", "88/QĐ-UBND");
        var http = await api.LoginAsync("demo_cv_ht");

        var ranked = (await SearchAsync(http, "17/NQ-HDND", "documents")).Hits.Select(h => h.Id).ToList();
        ranked.ShouldContain(exact);
        ranked.IndexOf(exact).ShouldBeLessThan(ranked.IndexOf(contains), "khớp đúng đứng trước khớp chứa chuỗi");
        ranked.IndexOf(contains).ShouldBeLessThan(ranked.IndexOf(approximate), "khớp chứa chuỗi đứng trước khớp gần đúng");
        ranked.ShouldNotContain(unrelated);

        // Gõ rời bằng khoảng trắng: không chứa chuỗi, không trùng từ nào trong tiêu đề, chỉ pg_trgm bắt được.
        var spaced = (await SearchAsync(http, "17 NQ HDND", "documents")).Hits.Select(h => h.Id).ToList();
        spaced.ShouldContain(exact);
        spaced.ShouldNotContain(unrelated);
    }

    [Fact]
    public async Task Loc_theo_ngay_ban_hanh_hinh_thuc_loai_giay_to_nhom_va_don_vi()
    {
        var march = await InsertPublicAsync("Tài liệu locxyz tháng ba", "LOC-01", "Nghị quyết", "2025-03-10");
        var june = await InsertPublicAsync("Tài liệu locxyz tháng sáu", "LOC-02", "Quyết định", "2025-06-20");
        var undated = await InsertPublicAsync("Tài liệu locxyz không ngày", "LOC-03", "Quyết định");
        var type = await api.ScalarAsync<string>("SELECT code FROM hoso.document_types ORDER BY code LIMIT 1");
        var group = await api.ScalarAsync<string>("SELECT work_group_code FROM hoso.document_types WHERE code = $1 ORDER BY work_group_code LIMIT 1", type!);
        var department = await api.ScalarAsync<string>("SELECT department_code FROM hoso.work_groups WHERE code = $1", group!);
        await api.ExecuteAsync("INSERT INTO hoso.document_classifications(document_id, work_group_code, document_type_code, classification_status, basis) VALUES ($1, $2, $3, 'confirmed', 'test')", march, group!, type!);
        var http = await api.LoginAsync("demo_cv_ht");

        async Task<List<Guid>> Ids(string extra) => (await SearchAsync(http, "locxyz", "documents", extra)).Hits.Select(h => h.Id).ToList();

        (await Ids("")).ShouldBe([march, june, undated], ignoreOrder: true);
        (await Ids("&issuedFrom=2025-04-01")).ShouldBe([june], "giấy tờ không có ngày ban hành không lọt qua bộ lọc ngày");
        (await Ids("&issuedTo=2025-04-01")).ShouldBe([march]);
        (await Ids("&issuedFrom=2025-03-01&issuedTo=2025-12-31")).ShouldBe([march, june], ignoreOrder: true);
        (await Ids("&form=" + Uri.EscapeDataString("Quyết định"))).ShouldBe([june, undated], ignoreOrder: true);
        (await Ids($"&documentType={type}")).ShouldBe([march]);
        (await Ids($"&workGroup={group}")).ShouldBe([march]);
        (await Ids($"&department={department}")).ShouldBe([march]);
        (await Ids("&department=khong-co")).ShouldBeEmpty();

        var reversed = await http.GetAsync("/api/v1/search?q=locxyz&issuedFrom=2025-12-31&issuedTo=2025-01-01");
        reversed.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await reversed.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("issuedTo");
    }

    [Fact]
    public async Task Tong_so_va_danh_sach_chi_tinh_trong_pham_vi_khong_bi_giay_to_ngoai_pham_vi_day_ra()
    {
        // 30 giấy tờ nội bộ không thuộc hồ sơ nào (người dùng không thấy) có số ký hiệu KHỚP ĐÚNG, xếp trên giấy tờ công khai chỉ chứa chuỗi.
        await api.ExecuteAsync("""
            INSERT INTO hoso.documents(origin, title, document_form, document_number)
            SELECT 'internal', 'Giấy tờ nội bộ ngoài phạm vi ' || g, 'Công văn', 'OOS-77' FROM generate_series(1, 30) g
            """);
        var visible = await InsertPublicAsync("Văn bản công khai trong phạm vi", "OOS-77-A", "Công văn");
        var http = await api.LoginAsync("demo_cv_ht");

        var result = await SearchAsync(http, "OOS-77", "documents", "&limit=5");
        result.Hits.Select(h => h.Id).ShouldBe([visible], "giấy tờ trong phạm vi vẫn hiện dù 30 giấy tờ ngoài phạm vi xếp cao hơn");
        result.TotalDocuments.ShouldBe(1, "tổng số không cộng giấy tờ ngoài phạm vi");
    }
}
