using System.Net;
using System.Net.Http.Headers;
using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>
/// BE-126: bản quét thay thế. Bản cũ giữ nguyên; bản mới là phiên bản kế tiếp, kèm lý do; việc đọc của bản cũ bị hủy, của bản mới được xếp;
/// cùng luật khóa với sửa dữ liệu giấy tờ; hộp tiếp nhận vẫn một dòng mỗi giấy tờ.
/// </summary>
public sealed class ScanReplacementTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record Replacement(Guid DocumentId, Guid FileId, Guid ReplacedFileId, int VersionNo, Guid JobId, string FileName, long ByteSize, int? PageCount,
        bool Classify, int IssuesClosed, bool ReviewReset);
    private sealed record FileVersion(Guid Id, int VersionNo, string Kind, bool IsCurrent, Guid? ReplacesFileId, string? ReplacementReason);
    private sealed record MainFile(Guid Id, string OriginalName);
    private sealed record Detail(Guid Id, MainFile? File, string ReviewStatus, List<FileVersion> Files);
    private sealed record Issue(Guid Id, string Status, string Description);
    private sealed record Overview(List<Issue> Issues);
    private sealed record Batch(Guid Id, int ScannedPageCount, int FileCount, string Status);
    private sealed record BatchFile(Guid DocumentId, Guid FileId, string FileName);
    private sealed record BatchDetail(Batch Batch, List<BatchFile> Files);

    private const string Pdf = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n";

    private static MultipartFormDataContent Form(string marker, string? reason, Guid? batchId = null)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(System.Text.Encoding.ASCII.GetBytes($"{Pdf}% {marker}\n"));
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", $"{marker}.pdf");
        if (reason is not null) form.Add(new StringContent(reason), "reason");
        if (batchId is { } b) form.Add(new StringContent(b.ToString()), "batchId");
        return form;
    }

    private static async Task<UploadDto> UploadAsync(HttpClient http, string marker, Guid? batchId = null) =>
        await (await http.PostAsync("/api/v1/intake/files", Form(marker, null, batchId), TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();

    private static Task<HttpResponseMessage> ReplaceAsync(HttpClient http, Guid documentId, string marker, string? reason) =>
        http.PostAsync($"/api/v1/documents/{documentId}/files", Form(marker, reason), TestContext.Current.CancellationToken);

    private static async Task<Detail> DetailAsync(HttpClient http, Guid id) =>
        await (await http.GetAsync($"/api/v1/documents/{id}", TestContext.Current.CancellationToken)).ReadAsync<Detail>();

    /// <summary>Đặt giấy tờ vào một hồ sơ mới ở trạng thái đã chọn, người chủ trì là chuyên viên Hạ tầng.</summary>
    private async Task<Guid> PutInDossierAsync(Guid documentId, string status)
    {
        var cv = await api.UserIdAsync("demo_cv_ht");
        var dossier = await api.ScalarAsync<Guid>("""
            INSERT INTO hoso.dossiers(code, origin, title, year, organization_code, department_code, work_group_code, assignee_id, status, created_by)
            VALUES ('TT-' || substr(md5(random()::text), 1, 10), 'internal', 'Hồ sơ thử thay bản quét', 2026, 'tl-ubnd', 'ht', 'U15', $1, $2, $1) RETURNING id
            """, cv, status);
        await api.ExecuteAsync("INSERT INTO hoso.dossier_documents(dossier_id, document_id, position) VALUES ($1, $2, 1)", dossier, documentId);
        return dossier;
    }

    [Fact]
    public async Task Thay_ban_quet_giu_ban_cu_tao_phien_ban_moi_xep_viec_doc_va_huy_viec_doc_cu()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var up = await UploadAsync(cv, "thay-ban-1");

        var result = await (await ReplaceAsync(cv, up.DocumentId, "thay-ban-2", "Quét lại vì trang 3 bị mờ")).ReadAsync<Replacement>();
        (result.DocumentId, result.ReplacedFileId, result.VersionNo, result.Classify).ShouldBe((up.DocumentId, up.FileId, 2, true), "còn ở hộp tiếp nhận nên AI phân loại lại");
        result.FileId.ShouldNotBe(up.FileId);

        var detail = await DetailAsync(cv, up.DocumentId);
        detail.File.ShouldNotBeNull().Id.ShouldBe(result.FileId, "tệp chính của giấy tờ là bản hiện hành");
        detail.Files.Select(f => (f.VersionNo, f.Kind, f.IsCurrent)).ShouldBe([(1, "original", false), (2, "replacement", true)]);
        var replacement = detail.Files.Single(f => f.VersionNo == 2);
        (replacement.ReplacesFileId, replacement.ReplacementReason).ShouldBe((up.FileId, "Quét lại vì trang 3 bị mờ"));
        (await api.ScalarAsync<string>("SELECT storage_key FROM hoso.files WHERE id = $1", up.FileId)).ShouldNotBeNull("bản cũ còn nội dung");

        // Việc đọc bản cũ (còn chờ) bị hủy; bản mới có việc mức tương tác, ghi bản bị thay.
        (await api.ScalarAsync<string>("SELECT status FROM hoso.ocr_jobs WHERE id = $1", up.JobId)).ShouldBe("cancelled");
        (await api.ScalarAsync<string>("SELECT status || '/' || priority::text FROM hoso.ocr_jobs WHERE id = $1", result.JobId)).ShouldBe("queued/3");
        (await api.ScalarAsync<string>("SELECT options->>'replaces_file_id' FROM hoso.ocr_jobs WHERE id = $1", result.JobId)).ShouldBe(up.FileId.ToString());

        // Bản cũ vẫn mở được; hộp tiếp nhận vẫn MỘT dòng cho giấy tờ này và trỏ bản mới.
        (await cv.GetAsync($"/api/v1/files/{up.FileId}/download")).StatusCode.ShouldBe(HttpStatusCode.OK);
        var inbox = (await (await cv.GetAsync("/api/v1/intake/inbox?limit=200")).ReadAsync<PageDto<InboxDto>>()).Items.Where(i => i.DocumentId == up.DocumentId).ToList();
        inbox.Count.ShouldBe(1);
        inbox[0].FileId.ShouldBe(result.FileId);

        // Thay tiếp: phiên bản 3, bản 2 là bản bị thay.
        var third = await (await ReplaceAsync(cv, up.DocumentId, "thay-ban-3", "Bản 2 vẫn thiếu trang cuối")).ReadAsync<Replacement>();
        (third.VersionNo, third.ReplacedFileId).ShouldBe((3, result.FileId));
        (await DetailAsync(cv, up.DocumentId)).Files.Single(f => f.IsCurrent).Id.ShouldBe(third.FileId);
    }

    [Fact]
    public async Task Thay_ban_quet_kiem_tra_dau_vao_quyen_trung_va_pham_vi()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var up = await UploadAsync(cv, "kiem-tra-1");

        // Lý do bắt buộc, 10–500 ký tự.
        (await ReplaceAsync(cv, up.DocumentId, "kiem-tra-2", null)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await ReplaceAsync(cv, up.DocumentId, "kiem-tra-2", "ngắn")).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await ReplaceAsync(cv, up.DocumentId, "kiem-tra-2", new string('x', 501))).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        // Không phải PDF.
        var notPdf = new MultipartFormDataContent { { new ByteArrayContent("không phải pdf"u8.ToArray()), "file", "gia.pdf" }, { new StringContent("Quét lại trang bị mờ"), "reason" } };
        (await cv.PostAsync($"/api/v1/documents/{up.DocumentId}/files", notPdf, TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.files WHERE document_id = $1", up.DocumentId)).ShouldBe(1, "lỗi đầu vào không để lại gì");

        // Trùng đúng bản đang có: không cần thay.
        var same = await ReplaceAsync(cv, up.DocumentId, "kiem-tra-1", "Tải lại cùng một tệp");
        same.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await same.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("không cần thay");
        // Trùng bản của giấy tờ khác mà mình thấy: báo giấy tờ kia.
        var other = await UploadAsync(cv, "kiem-tra-khac");
        var clash = await ReplaceAsync(cv, up.DocumentId, "kiem-tra-khac", "Thay bằng tệp của giấy tờ khác");
        clash.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await clash.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain(other.DocumentId.ToString());

        // Người ngoài phạm vi: 404 (không lộ có giấy tờ). Người không có quyền sửa giấy tờ (trưởng phòng): 403.
        (await ReplaceAsync(await api.LoginAsync("demo_cv_kt"), up.DocumentId, "kiem-tra-3", "Thử thay bản của người khác")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ReplaceAsync(await api.LoginAsync("demo_head_ht"), up.DocumentId, "kiem-tra-3", "Trưởng phòng không có quyền sửa")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await ReplaceAsync(await api.LoginAsync("demo_cv_ht"), Guid.NewGuid(), "kiem-tra-3", "Giấy tờ không tồn tại ở đây")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Giay_to_trong_ho_so_cho_xu_ly_hoac_da_huy_noi_dung_khong_thay_duoc_ban_quet()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var inReview = await UploadAsync(cv, "khoa-cho-xu-ly");
        var dossier = await PutInDossierAsync(inReview.DocumentId, "department_review");
        var locked = await ReplaceAsync(cv, inReview.DocumentId, "khoa-moi-1", "Quét lại trang bị mờ");
        locked.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await locked.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("chờ xử lý");

        // Hồ sơ bị trả lại (còn sửa được): thay được, và vì giấy tờ không còn ở hộp tiếp nhận nên AI KHÔNG phân loại lại.
        await api.ExecuteAsync("UPDATE hoso.dossiers SET status = 'returned' WHERE id = $1", dossier);
        await api.ExecuteAsync("UPDATE hoso.documents SET intake_status = 'filed' WHERE id = $1", inReview.DocumentId);
        var allowed = await (await ReplaceAsync(cv, inReview.DocumentId, "khoa-moi-2", "Quét lại theo yêu cầu bổ sung")).ReadAsync<Replacement>();
        allowed.Classify.ShouldBeFalse("đã vào hồ sơ: chỉ OCR để tìm kiếm, không đụng gợi ý đã đối chiếu");
        (await api.ScalarAsync<bool>("SELECT (options->>'classify')::boolean FROM hoso.ocr_jobs WHERE id = $1", allowed.JobId)).ShouldBeFalse();

        // Nội dung đã bị hủy theo đề nghị hủy: không còn gì để thay.
        var disposed = await UploadAsync(cv, "khoa-da-huy");
        await api.ExecuteAsync("UPDATE hoso.files SET disposed_at = now(), storage_key = NULL WHERE id = $1", disposed.FileId);
        (await ReplaceAsync(cv, disposed.DocumentId, "khoa-moi-3", "Quét lại bản đã hủy nội dung")).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        // Văn bản đã bị bỏ.
        var dropped = await UploadAsync(cv, "khoa-da-bo");
        await api.ExecuteAsync("UPDATE hoso.documents SET intake_status = 'discarded', discarded_at = now() WHERE id = $1", dropped.DocumentId);
        (await ReplaceAsync(cv, dropped.DocumentId, "khoa-moi-4", "Quét lại văn bản đã bỏ")).StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Thay_ban_quet_dong_loi_anh_cua_ban_cu_va_dua_giay_to_da_xac_nhan_ve_cho_xac_nhan_lai()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var batch = await (await clerk.PostJsonAsync("/api/v1/intake/batches", new { handedOverBy = "Phòng Nội vụ", boxLabel = "Hộp 11", expectedSheetCount = 4 })).ReadAsync<Batch>();
        var up = await UploadAsync(clerk, "loi-anh-1", batch.Id);
        await clerk.PostJsonAsync("/api/v1/quality-issues", new { batchId = batch.Id, fileId = up.FileId, pageNo = 1, issueType = "blurry", description = "Trang 1 mờ" });
        await api.ExecuteAsync("INSERT INTO hoso.page_images(file_id, page_no, quality_flags, quality_status) VALUES ($1, 1, ARRAY['blurry'], 'rescan_required')", up.FileId);
        await api.ExecuteAsync("UPDATE hoso.documents SET data_review_status = 'verified', reviewed_by = $2, reviewed_at = now() WHERE id = $1", up.DocumentId, await api.UserIdAsync("demo_clerk_ubnd"));

        var result = await (await ReplaceAsync(clerk, up.DocumentId, "loi-anh-2", "Đã quét lại trang 1 ở 300 dpi")).ReadAsync<Replacement>();
        (result.IssuesClosed, result.ReviewReset).ShouldBe((1, true));

        var issue = (await (await clerk.GetAsync($"/api/v1/quality-issues?batchId={batch.Id}")).ReadAsync<Overview>()).Issues.Single();
        issue.Status.ShouldBe("fixed");
        issue.Description.ShouldContain("Đã thay bằng bản quét phiên bản 2");
        (await api.ScalarAsync<string>("SELECT quality_status FROM hoso.page_images WHERE file_id = $1 AND page_no = 1", up.FileId)).ShouldBe("rescanned");
        (await DetailAsync(clerk, up.DocumentId)).ReviewStatus.ShouldBe("pending");
        // Lô hết lỗi mở nên đóng được.
        (await clerk.PostJsonAsync($"/api/v1/intake/batches/{batch.Id}/close")).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Ban_thay_the_thuoc_cung_lo_quet_lo_chi_dem_ban_hien_hanh_va_lo_da_dong_cap_nhat_so_trang()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var batch = await (await clerk.PostJsonAsync("/api/v1/intake/batches", new { handedOverBy = "Phòng Nội vụ", boxLabel = "Hộp 12", expectedSheetCount = 4 })).ReadAsync<Batch>();
        var up = await UploadAsync(clerk, "lo-1", batch.Id);
        await api.ExecuteAsync("UPDATE hoso.files SET page_count = 5 WHERE id = $1", up.FileId);
        var closed = await (await clerk.PostJsonAsync($"/api/v1/intake/batches/{batch.Id}/close")).ReadAsync<Batch>();
        (closed.Status, closed.ScannedPageCount, closed.FileCount).ShouldBe(("closed", 5, 1));

        var replaced = await (await ReplaceAsync(clerk, up.DocumentId, "lo-2", "Quét lại cả tập vì thiếu trang")).ReadAsync<Replacement>();
        var detail = await (await clerk.GetAsync($"/api/v1/intake/batches/{batch.Id}")).ReadAsync<BatchDetail>();
        detail.Batch.FileCount.ShouldBe(1, "bản bị thay không tính thành một tệp nữa");
        detail.Files.Single().FileId.ShouldBe(replaced.FileId);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.files WHERE scan_batch_id = $1", batch.Id)).ShouldBe(2, "bản cũ vẫn thuộc lô để truy vết");
        // Số trang của lô đã đóng theo bản hiện hành (tệp thử dựng tay không đếm được trang → 0), không còn 5 của bản cũ.
        detail.Batch.ScannedPageCount.ShouldBe(0);
    }

    [Fact]
    public async Task Tim_kiem_theo_trang_cua_ban_moi_khi_da_doc_xong_va_van_dung_ban_cu_khi_chua_doc_xong()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var up = await UploadAsync(cv, "tim-kiem-1");
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='completed', started_at=now(), finished_at=now(), page_count=1, processed_pages=1 WHERE id=$1", up.JobId);
        await api.ExecuteAsync("INSERT INTO hoso.ocr_pages(job_id, page_no, method, text, status) VALUES ($1, 1, 'ocr', 'Quyết định điều chuyển ngân sách ban hành bản cũ', 'completed')", up.JobId);
        var replaced = await (await ReplaceAsync(cv, up.DocumentId, "tim-kiem-2", "Quét lại theo bản gốc rõ hơn")).ReadAsync<Replacement>();

        // Bản mới chưa đọc xong: vẫn tìm thấy theo chữ của bản cũ.
        var before = await (await cv.GetAsync($"/api/v1/search?q={Uri.EscapeDataString("điều chuyển ngân sách")}&kind=document")).Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        before.ShouldContain(up.DocumentId.ToString());

        // Bản mới đọc xong với chữ khác: chữ của bản cũ không còn là căn cứ tìm kiếm.
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='completed', started_at=now(), finished_at=now(), page_count=1, processed_pages=1 WHERE id=$1", replaced.JobId);
        await api.ExecuteAsync("INSERT INTO hoso.ocr_pages(job_id, page_no, method, text, status) VALUES ($1, 1, 'ocr', 'Báo cáo tổng kết công tác nội vụ năm 2026', 'completed')", replaced.JobId);
        var old = await (await cv.GetAsync($"/api/v1/search?q={Uri.EscapeDataString("điều chuyển ngân sách")}&kind=document")).Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        old.ShouldNotContain(up.DocumentId.ToString());
        var fresh = await (await cv.GetAsync($"/api/v1/search?q={Uri.EscapeDataString("tổng kết công tác nội vụ")}&kind=document")).Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        fresh.ShouldContain(up.DocumentId.ToString());
    }
}
