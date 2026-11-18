using System.Net;
using System.Net.Http.Headers;
using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>
/// BE-120 (FE-44). Quản trị kỹ thuật không có phạm vi giấy tờ (không mở được /jobs/{id}) nhưng vẫn phải gỡ được hàng đợi AI:
/// xem việc, hủy việc đang chờ/chạy, chạy lại việc lỗi/đã hủy bằng một việc mới.
/// </summary>
public sealed class AdminJobsTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record Row(Guid Id, Guid FileId, string FileName, string JobType, string Status, int Attempts, string PriorityKind, string? Error,
        string? RequestedByName, Guid? RetryOf, bool CanCancel, bool CanRetry, string? RetryBlockedReason);
    private sealed record RowPage(List<Row> Items, string? NextCursor);

    private static async Task<UploadDto> UploadAsync(HttpClient http, string marker)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(System.Text.Encoding.ASCII.GetBytes($"%PDF-1.4\n% {marker}\n%%EOF\n"));
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", $"{marker}.pdf");
        return await (await http.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();
    }

    [Fact]
    public async Task Quan_tri_huy_viec_dang_cho_va_chay_lai_viec_loi_bang_viec_moi()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var waiting = await UploadAsync(cv, "admin-cho");
        var failed = await UploadAsync(cv, "admin-loi");
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='failed', attempt=3, started_at=now(), finished_at=now(), error_message='Worker ngừng phản hồi' WHERE id=$1", failed.JobId);

        var admin = await api.LoginAsync("demo_admin");
        // Ngoài phạm vi giấy tờ: API của người dùng trả 404, API quản trị vẫn thấy.
        (await admin.GetAsync($"/api/v1/jobs/{waiting.JobId}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var active = await (await admin.GetAsync("/api/v1/admin/ai/jobs?status=active")).ReadAsync<RowPage>();
        var row = active.Items.Single(r => r.Id == waiting.JobId);
        (row.FileName, row.Status, row.PriorityKind, row.CanCancel, row.CanRetry).ShouldBe(("admin-cho.pdf", "queued", "background", true, false));
        active.Items.ShouldNotContain(r => r.Id == failed.JobId);

        // Hủy việc đang chờ; hủy lần nữa: 409; mã không có: 404.
        var cancelled = await (await admin.PostJsonAsync($"/api/v1/admin/ai/jobs/{waiting.JobId}/cancel")).ReadAsync<Row>();
        (cancelled.Status, cancelled.CanCancel, cancelled.CanRetry).ShouldBe(("cancelled", false, true));
        (await admin.PostJsonAsync($"/api/v1/admin/ai/jobs/{waiting.JobId}/cancel")).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await admin.PostJsonAsync($"/api/v1/admin/ai/jobs/{Guid.NewGuid()}/cancel")).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        // Việc lỗi: 3 lần thử, chạy lại được.
        var failedRow = (await (await admin.GetAsync("/api/v1/admin/ai/jobs?status=failed")).ReadAsync<RowPage>()).Items.Single(r => r.Id == failed.JobId);
        (failedRow.Attempts, failedRow.Error, failedRow.CanRetry).ShouldBe((3, "Worker ngừng phản hồi", true));
        var retried = await (await admin.PostJsonAsync($"/api/v1/admin/ai/jobs/{failed.JobId}/retry")).ReadAsync<Row>();
        retried.Id.ShouldNotBe(failed.JobId);
        (retried.FileId, retried.JobType, retried.Status, retried.PriorityKind, retried.RetryOf, retried.Attempts).ShouldBe(
            (failed.FileId, "read_classify", "queued", "interactive", (Guid?)failed.JobId, 0));
        retried.RequestedByName.ShouldNotBeNullOrEmpty();
        (await api.ScalarAsync<bool>("SELECT (options->>'classify')::boolean FROM hoso.ocr_jobs WHERE id=$1", retried.Id)).ShouldBeTrue("giữ tùy chọn của việc gốc");
        (await api.ScalarAsync<string>("SELECT status FROM hoso.ocr_jobs WHERE id=$1", failed.JobId)).ShouldBe("failed", "việc lỗi giữ nguyên làm lịch sử");

        // Tệp đang có việc chờ: không chạy lại việc cũ lần nữa (tránh hai việc cùng tệp).
        var busy = await admin.PostJsonAsync($"/api/v1/admin/ai/jobs/{failed.JobId}/retry");
        busy.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await busy.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("đang có việc đọc khác");
        // Hủy việc mới rồi chạy lại việc lỗi cũ: đã có lần đọc mới hơn nên chặn, có lý do để giao diện khóa nút.
        await admin.PostJsonAsync($"/api/v1/admin/ai/jobs/{retried.Id}/cancel");
        var stale = (await (await admin.GetAsync("/api/v1/admin/ai/jobs?status=failed")).ReadAsync<RowPage>()).Items.Single(r => r.Id == failed.JobId);
        (stale.CanRetry, stale.RetryBlockedReason).ShouldBe((false, "Tệp này đã có lần đọc mới hơn; chạy lại việc cũ sẽ ghi đè kết quả mới."));
        (await admin.PostJsonAsync($"/api/v1/admin/ai/jobs/{failed.JobId}/retry")).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        // Việc đã hoàn tất hoặc đang chờ thì không "chạy lại".
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='completed', finished_at=now() WHERE id=$1", retried.Id);
        (await admin.PostJsonAsync($"/api/v1/admin/ai/jobs/{retried.Id}/retry")).StatusCode.ShouldBe(HttpStatusCode.Conflict);

        // Chỉ người có processing.manage.
        (await cv.GetAsync("/api/v1/admin/ai/jobs")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await cv.PostJsonAsync($"/api/v1/admin/ai/jobs/{waiting.JobId}/retry")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Danh_sach_viec_AI_phan_trang_moi_nhat_truoc_va_tu_choi_bo_loc_la()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var uploaded = new List<UploadDto>();
        for (var i = 0; i < 3; i++) uploaded.Add(await UploadAsync(cv, $"trang-{i}"));
        var admin = await api.LoginAsync("demo_admin");

        var seen = new List<Guid>();
        string? cursor = null;
        do
        {
            var page = await (await admin.GetAsync($"/api/v1/admin/ai/jobs?limit=2{(cursor is null ? "" : $"&cursor={cursor}")}")).ReadAsync<RowPage>();
            page.Items.Count.ShouldBeLessThanOrEqualTo(2);
            seen.AddRange(page.Items.Select(r => r.Id));
            cursor = page.NextCursor;
        } while (cursor is not null);
        seen.ShouldBeUnique();
        var mine = seen.Where(id => uploaded.Any(u => u.JobId == id)).ToList();
        mine.ShouldBe(uploaded.Select(u => u.JobId).Reverse().ToList(), "mới nhất trước, không sót không trùng qua các trang");

        (await admin.GetAsync("/api/v1/admin/ai/jobs?status=hong")).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await admin.GetAsync("/api/v1/admin/ai/jobs?cursor=khong-hop-le")).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }
}
