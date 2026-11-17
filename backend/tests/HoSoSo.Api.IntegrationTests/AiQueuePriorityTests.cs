using System.Net;
using System.Net.Http.Headers;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Application.Intake;
using Npgsql;
using JobDto = HoSoSo.Api.IntegrationTests.Support.JobDto;     // trùng tên với DTO của API; test dùng bản rút gọn

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-97: PDF mới tải lên vào khay nền (mức 7); thứ tự hàng đợi theo mức rồi lúc nâng mức; báo cho worker khi đổi mức.</summary>
public sealed class AiQueuePriorityTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private static byte[] UniquePdf(string marker) => System.Text.Encoding.ASCII.GetBytes(
        $"%PDF-1.4\n% {marker}\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

    private async Task<UploadDto> UploadAsync(HttpClient http, string marker)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(UniquePdf(marker));
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", marker + ".pdf");
        var response = await http.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        return await response.ReadAsync<UploadDto>();
    }

    private static async Task<JobDto> JobAsync(HttpClient http, Guid id) => await (await http.GetAsync($"/api/v1/jobs/{id}")).ReadAsync<JobDto>();

    [Fact]
    public async Task Pdf_moi_tai_len_vao_khay_nen_muc_7_va_gan_nhan_khay()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var up = await UploadAsync(http, "khay-nen-" + Guid.NewGuid().ToString("N"));

        (await api.ScalarAsync<short>("SELECT priority FROM hoso.ocr_jobs WHERE id = $1", up.JobId)).ShouldBe((short)7);
        (await JobAsync(http, up.JobId)).QueueKind.ShouldBe("background");
        var inbox = (await (await http.GetAsync("/api/v1/intake/inbox")).ReadAsync<PageDto<InboxDto>>()).Items;
        inbox.Single(i => i.DocumentId == up.DocumentId).QueueKind.ShouldBe("background");
    }

    [Fact]
    public async Task Vi_tri_hang_doi_theo_muc_roi_theo_luc_nang_muc_khong_theo_luc_tai()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status = 'cancelled', started_at = coalesce(started_at, now()), finished_at = now() WHERE status = 'queued'");   // chỉ xét các việc của test này
        var a = await UploadAsync(http, "a-" + Guid.NewGuid().ToString("N"));
        var b = await UploadAsync(http, "b-" + Guid.NewGuid().ToString("N"));
        var c = await UploadAsync(http, "c-" + Guid.NewGuid().ToString("N"));
        async Task<int?> PositionAsync(UploadDto up) => (await JobAsync(http, up.JobId)).QueuePosition;

        (await PositionAsync(a), await PositionAsync(b), await PositionAsync(c)).ShouldBe((1, 2, 3), "cùng mức: ai tải trước chạy trước");

        // C được tách văn bản (mức 3, tương tác): chen lên trước hai việc nền.
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET priority = 3 WHERE id = $1", c.JobId);
        (await PositionAsync(c), await PositionAsync(a), await PositionAsync(b)).ShouldBe((1, 2, 3));
        (await JobAsync(http, c.JobId)).QueueKind.ShouldBe("interactive");

        // B được bấm "Trích xuất ngay" (mức 1): lên đầu dù tải sau A.
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET priority = 1, prioritized_at = now() WHERE id = $1", b.JobId);
        (await PositionAsync(b), await PositionAsync(c), await PositionAsync(a)).ShouldBe((1, 2, 3));
        (await JobAsync(http, b.JobId)).QueueKind.ShouldBe("priority");

        // A được nâng mức SAU B: cùng mức 1 nhưng xếp theo lúc nâng, nên A vẫn sau B dù A tải lên trước B.
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET priority = 1, prioritized_at = now() + interval '1 second' WHERE id = $1", a.JobId);
        (await PositionAsync(b), await PositionAsync(a), await PositionAsync(c)).ShouldBe((1, 2, 3));
    }

    [Fact]
    public async Task Doc_lai_trang_van_o_muc_tuong_tac()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var up = await UploadAsync(http, "doc-lai-" + Guid.NewGuid().ToString("N"));
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status = 'completed', started_at = now(), finished_at = now(), page_count = 1, processed_pages = 1 WHERE id = $1", up.JobId);

        var response = await http.PostJsonAsync($"/api/v1/jobs/{up.JobId}/pages/1/retry");
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var retry = await response.ReadAsync<JobDto>();
        retry.QueueKind.ShouldBe("interactive");
        (await api.ScalarAsync<short>("SELECT priority FROM hoso.ocr_jobs WHERE id = $1", retry.Id)).ShouldBe((short)3);
    }

    [Fact]
    public async Task Doi_muc_viec_dang_cho_bao_cho_worker_dang_nghe()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var up = await UploadAsync(http, "bao-" + Guid.NewGuid().ToString("N"));
        await using var listener = await api.Data.OpenConnectionAsync(TestContext.Current.CancellationToken);
        await using (var listen = new NpgsqlCommand("LISTEN job_queued", listener)) await listen.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
        var received = new List<string>();
        listener.Notification += (_, e) => { lock (received) received.Add(e.Payload); };

        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET priority = 1, prioritized_at = now() WHERE id = $1", up.JobId);
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(10));
        while (true)
        {
            lock (received) if (received.Contains(up.JobId.ToString())) break;
            await listener.WaitAsync(timeout.Token);
        }

        // Đổi thứ khác (không phải status, priority) thì không báo.
        lock (received) received.Clear();
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET processed_pages = 0 WHERE id = $1", up.JobId);
        using var quiet = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
        quiet.CancelAfter(TimeSpan.FromSeconds(1));
        try { await listener.WaitAsync(quiet.Token); } catch (OperationCanceledException) { /* mong đợi: không có thông báo */ }
        lock (received) received.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(7, true)]
    [InlineData(9, true)]
    [InlineData(6, false)]
    [InlineData(3, false)]
    [InlineData(10, false)]
    public void Cau_hinh_muc_khay_nen_chi_nhan_7_den_9(int priority, bool valid) =>
        new AiQueueOptionsValidator().Validate(null, new AiQueueOptions { BackgroundPriority = priority }).Succeeded.ShouldBe(valid);

    [Theory]
    [InlineData(1, "priority")]
    [InlineData(2, "priority")]
    [InlineData(3, "interactive")]
    [InlineData(6, "interactive")]
    [InlineData(7, "background")]
    [InlineData(9, "background")]
    public void Nhan_khay_theo_muc(int priority, string kind) => QueuePriority.KindOf((short)priority).ShouldBe(kind);
}
