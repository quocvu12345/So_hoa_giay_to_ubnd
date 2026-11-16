using System.Net;
using System.Net.Http.Headers;
using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-40, BE-53: lô quét và lỗi chất lượng ảnh; lô chỉ đóng được khi hết lỗi đang mở.</summary>
public sealed class QualityTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record Batch(Guid Id, string Code, string Status, int OpenIssues, int FileCount);
    private sealed record Issue(Guid Id, string IssueType, string Status, int? PageNo, string Description);
    private sealed record Suspect(Guid FileId, int PageNo, List<string> Flags, string Status);
    private sealed record Overview(List<Issue> Issues, List<Suspect> SuspectPages);

    private async Task<(HttpClient Clerk, Batch Batch, UploadDto File)> NewBatchWithFileAsync(string marker)
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var batch = await (await clerk.PostJsonAsync("/api/v1/intake/batches", new { handedOverBy = "Phòng Nội vụ", boxLabel = "Hộp 07", expectedSheetCount = 12 })).ReadAsync<Batch>();
        var form = new MultipartFormDataContent();
        var content = new ByteArrayContent(System.Text.Encoding.ASCII.GetBytes($"%PDF-1.4\n% {marker}\n%%EOF\n"));
        content.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(content, "file", $"{marker}.pdf");
        form.Add(new StringContent(batch.Id.ToString()), "batchId");
        var file = await (await clerk.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();
        return (clerk, batch, file);
    }

    [Fact]
    public async Task Lo_quet_chi_dong_duoc_khi_het_loi_anh_dang_mo()
    {
        var (clerk, batch, file) = await NewBatchWithFileAsync("lo-dong");
        batch.Code.ShouldMatch(@"^LQ-\d{4}-\d{4}$");
        (await (await clerk.GetAsync($"/api/v1/intake/batches/{batch.Id}")).ReadAsync<BatchDetail>()).Batch.Status.ShouldBe("scanning");

        var issue = await (await clerk.PostJsonAsync("/api/v1/quality-issues", new { batchId = batch.Id, fileId = file.FileId, pageNo = 3, issueType = "blurry", description = "Trang 3 bị mờ mép phải" })).ReadAsync<Issue>();
        var blocked = await clerk.PostJsonAsync($"/api/v1/intake/batches/{batch.Id}/close");
        blocked.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await blocked.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("1 lỗi ảnh");

        // Bỏ qua lỗi phải có lý do; sửa xong thì đóng được.
        (await clerk.PostJsonAsync($"/api/v1/quality-issues/{issue.Id}/resolve", new { status = "wont_fix" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await clerk.PostJsonAsync($"/api/v1/quality-issues/{issue.Id}/resolve", new { status = "fixed", note = "Đã quét lại trang 3" })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await clerk.PostJsonAsync($"/api/v1/quality-issues/{issue.Id}/resolve", new { status = "fixed" })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var closed = await (await clerk.PostJsonAsync($"/api/v1/intake/batches/{batch.Id}/close")).ReadAsync<Batch>();
        closed.Status.ShouldBe("closed");
        (await clerk.PostJsonAsync($"/api/v1/intake/batches/{batch.Id}/close")).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        // Lô đã đóng thì không nhận thêm tệp.
        var late = new MultipartFormDataContent { { new ByteArrayContent("%PDF-1.4\n%x\n"u8.ToArray()), "file", "muon.pdf" }, { new StringContent(batch.Id.ToString()), "batchId" } };
        (await clerk.PostAsync("/api/v1/intake/files", late, TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Trang_AI_gan_co_dang_ngo_hien_trong_danh_sach_va_danh_dau_quet_lai_mo_loi()
    {
        var (clerk, batch, file) = await NewBatchWithFileAsync("trang-mo");
        // Worker AI gắn cờ trang 2 (cùng SQL như ai-worker save_quality).
        await api.ExecuteAsync("INSERT INTO hoso.page_images(file_id, page_no, quality_flags, quality_status) VALUES ($1, 2, ARRAY['blurry'], 'suspect')", file.FileId);
        var overview = await (await clerk.GetAsync($"/api/v1/quality-issues?batchId={batch.Id}")).ReadAsync<Overview>();
        overview.SuspectPages.Single().Flags.ShouldBe(["blurry"]);
        overview.Issues.ShouldBeEmpty();

        var marked = await clerk.PutJsonAsync($"/api/v1/files/{file.FileId}/pages/2/quality", new { status = "rescan_required", note = "Quét lại ở 300 dpi" });
        marked.StatusCode.ShouldBe(HttpStatusCode.OK);
        var open = (await (await clerk.GetAsync($"/api/v1/quality-issues?batchId={batch.Id}&status=open")).ReadAsync<Overview>()).Issues.Single();
        (open.IssueType, open.PageNo).ShouldBe(("blurry", 2));
        (await clerk.PutJsonAsync($"/api/v1/files/{file.FileId}/pages/2/quality", new { status = "rescan_required" })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await (await clerk.GetAsync($"/api/v1/quality-issues?batchId={batch.Id}&status=open")).ReadAsync<Overview>()).Issues.Count.ShouldBe(1, "đánh dấu lại không tạo lỗi trùng");
        (await clerk.PostJsonAsync($"/api/v1/intake/batches/{batch.Id}/close")).StatusCode.ShouldBe(HttpStatusCode.Conflict);

        // Quét lại xong: lỗi tự đóng, lô đóng được.
        (await clerk.PutJsonAsync($"/api/v1/files/{file.FileId}/pages/2/quality", new { status = "rescanned" })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await (await clerk.GetAsync($"/api/v1/quality-issues?batchId={batch.Id}&status=open")).ReadAsync<Overview>()).Issues.ShouldBeEmpty();
        (await clerk.PostJsonAsync($"/api/v1/intake/batches/{batch.Id}/close")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await clerk.PutJsonAsync($"/api/v1/files/{file.FileId}/pages/2/quality", new { status = "hu-hong" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Chi_van_thu_cung_co_quan_moi_thay_va_xu_ly_duoc_loi_cua_lo()
    {
        var (clerk, batch, file) = await NewBatchWithFileAsync("pham-vi-lo");
        var issue = await (await clerk.PostJsonAsync("/api/v1/quality-issues", new { batchId = batch.Id, issueType = "missing_page", description = "Thiếu trang 5" })).ReadAsync<Issue>();

        var hdnd = await api.LoginAsync("demo_clerk_hdnd");
        (await hdnd.PostJsonAsync("/api/v1/quality-issues", new { batchId = batch.Id, issueType = "other" })).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await hdnd.PostJsonAsync($"/api/v1/quality-issues/{issue.Id}/resolve", new { status = "fixed" })).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await (await hdnd.GetAsync($"/api/v1/quality-issues?batchId={batch.Id}")).ReadAsync<Overview>()).Issues.ShouldBeEmpty();
        (await hdnd.GetAsync($"/api/v1/intake/batches/{batch.Id}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await hdnd.PutJsonAsync($"/api/v1/files/{file.FileId}/pages/1/quality", new { status = "ok" })).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        var employee = await api.LoginAsync("demo_cv_ht");   // không có quyền kiểm tra chất lượng
        (await employee.GetAsync("/api/v1/quality-issues")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await clerk.PostJsonAsync("/api/v1/quality-issues", new { batchId = batch.Id, issueType = "khong-co" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await clerk.PostJsonAsync("/api/v1/quality-issues", new { issueType = "blank" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    private sealed record BatchDetail(Batch Batch);
}
