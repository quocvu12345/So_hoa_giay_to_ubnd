using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Infrastructure.Messaging;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-20, BE-22, BE-23, BE-46, BE-70, BE-18: outbox → thông báo, SSE theo người dùng, thu hồi job treo, health.</summary>
public sealed class EventsTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record NotificationDto(Guid Id, string Kind, string Title, string Body, string? Link, Guid? DossierId, bool Read);
    private sealed record NotificationList(List<NotificationDto> Items, int Unread);

    private static byte[] Pdf(string marker) => System.Text.Encoding.ASCII.GetBytes($"%PDF-1.4\n% {marker}\ntrailer<<>>\n%%EOF\n");

    private static async Task<UploadDto> UploadAsync(HttpClient http, string marker)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(Pdf(marker));
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", $"{marker}.pdf");
        return await (await http.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();
    }

    /// <summary>NOTIFY lặp lại tới khi nhận được: kết nối LISTEN của máy chủ có thể chưa sẵn sàng lúc test vừa bắt đầu.</summary>
    private async Task<SseEvent> NotifyUntilAsync(SseClient client, string sql, string expectedType, Func<SseEvent, bool>? where = null)
    {
        using var stop = new CancellationTokenSource();
        var pump = Task.Run(async () =>
        {
            while (!stop.IsCancellationRequested)
            {
                await api.ExecuteAsync(sql);
                await Task.Delay(300);
            }
        });
        try { return await client.WaitForAsync(expectedType, TimeSpan.FromSeconds(15), where); }
        finally { await stop.CancelAsync(); await pump; }
    }

    [Fact]
    public async Task Tien_do_doc_PDF_chi_den_dung_nguoi_da_tai_len()
    {
        var a = await api.LoginAsync("demo_cv_ht");
        var b = await api.LoginAsync("demo_cv_kt");
        await using var streamA = await SseClient.ConnectAsync(a);
        await using var streamB = await SseClient.ConnectAsync(b);
        var up = await UploadAsync(a, "su-kien-tien-do");

        var progress = await NotifyUntilAsync(streamA,
            $"SELECT pg_notify('job_progress', '{{\"jobId\":\"{up.JobId}\",\"documentId\":\"{up.DocumentId}\",\"stage\":\"ocr\",\"processed\":1,\"pageCount\":2}}')", "job.progress");
        using (var doc = JsonDocument.Parse(progress.Data))
        {
            doc.RootElement.GetProperty("processed").GetInt32().ShouldBe(1);
            doc.RootElement.GetProperty("pageCount").GetInt32().ShouldBe(2);
            doc.RootElement.GetProperty("stage").GetString().ShouldBe("ocr");
        }
        await NotifyUntilAsync(streamA,
            $"SELECT pg_notify('job_progress', '{{\"jobId\":\"{up.JobId}\",\"documentId\":\"{up.DocumentId}\",\"status\":\"completed\"}}')", "job.completed");

        (await streamB.StaysQuietAsync("job.", TimeSpan.FromSeconds(1))).ShouldBeTrue("người khác không nhận tiến độ của tôi");
        // Thông báo hỏng không làm sập luồng nghe: gửi rác rồi vẫn nhận được sự kiện sau đó.
        await api.ExecuteAsync("SELECT pg_notify('job_progress', 'khong-phai-json')");
        await NotifyUntilAsync(streamA,
            $"SELECT pg_notify('job_progress', '{{\"jobId\":\"{up.JobId}\",\"status\":\"failed\"}}')", "job.failed");
    }

    [Fact]
    public async Task Trinh_ho_so_tao_thong_bao_cho_truong_phong_va_bao_dung_nguoi_co_ho_so_trong_pham_vi()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var manager = await api.LoginAsync("demo_head_ht");
        var outsider = await api.LoginAsync("demo_head_kt");
        await using var managerStream = await SseClient.ConnectAsync(manager);
        await using var outsiderStream = await SseClient.ConnectAsync(outsider);

        var d = await (await cv.PostJsonAsync("/api/v1/dossiers", new { title = "Hồ sơ thử thông báo", workGroupCode = "U15" })).ReadAsync<DossierDetailDto>();
        var doc = await api.ScalarAsync<Guid>("SELECT id FROM hoso.documents WHERE external_key = 'public-002'");
        await cv.PostJsonAsync($"/api/v1/dossiers/{d.Id}/documents", new { documentId = doc });
        await api.ExecuteAsync("UPDATE hoso.documents SET data_review_status = 'verified', reviewed_by = $1, reviewed_at = now() WHERE id = $2", await api.UserIdAsync("demo_cv_ht"), doc);
        (await cv.PostJsonAsync($"/api/v1/dossiers/{d.Id}/transitions", new { action = "submit" })).StatusCode.ShouldBe(HttpStatusCode.OK);

        var changed = await managerStream.WaitForAsync("dossier.changed", where: e => e.Data.Contains(d.Id.ToString()));
        changed.Data.ShouldContain("department_review");
        var created = await managerStream.WaitForAsync("notification.created");
        created.Data.ShouldContain("dossier.awaiting_review");

        var list = await (await manager.GetAsync("/api/v1/notifications?unread=true")).ReadAsync<NotificationList>();
        var notification = list.Items.Single(n => n.DossierId == d.Id);
        notification.Title.ShouldBe("Hồ sơ chờ bạn kiểm tra");
        notification.Link.ShouldBe($"/ho-so/{d.Id}");
        notification.Body.ShouldContain("Hồ sơ thử thông báo");
        list.Unread.ShouldBeGreaterThanOrEqualTo(1);

        // Người gửi không nhận thông báo của chính mình; người ngoài đơn vị không biết hồ sơ đã đổi.
        (await (await cv.GetAsync("/api/v1/notifications")).ReadAsync<NotificationList>()).Items.ShouldNotContain(n => n.DossierId == d.Id);
        (await outsiderStream.StaysQuietAsync("dossier.changed", TimeSpan.FromSeconds(1))).ShouldBeTrue();
        (await (await outsider.GetAsync("/api/v1/notifications")).ReadAsync<NotificationList>()).Items.ShouldNotContain(n => n.DossierId == d.Id);

        // Đánh dấu đã đọc: chỉ chủ thông báo.
        (await outsider.PostJsonAsync($"/api/v1/notifications/{notification.Id}/read")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await manager.PostJsonAsync($"/api/v1/notifications/{notification.Id}/read")).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await (await manager.GetAsync("/api/v1/notifications?unread=true")).ReadAsync<NotificationList>()).Items.ShouldNotContain(n => n.Id == notification.Id);
        (await manager.PostJsonAsync("/api/v1/notifications/read-all")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await (await manager.GetAsync("/api/v1/notifications")).ReadAsync<NotificationList>()).Unread.ShouldBe(0);

        // Trưởng phòng trả lại → người soạn nhận thông báo kèm ý kiến.
        (await manager.PostJsonAsync($"/api/v1/dossiers/{d.Id}/transitions", new { action = "return", note = "Thiếu ảnh hiện trạng, bổ sung rồi trình lại." })).StatusCode.ShouldBe(HttpStatusCode.OK);
        var returned = await Eventually.ForAsync(async () => (await (await cv.GetAsync("/api/v1/notifications")).ReadAsync<NotificationList>()).Items,
            items => items.Any(n => n.DossierId == d.Id && n.Kind == "dossier.returned"));
        returned.Single(n => n.DossierId == d.Id && n.Kind == "dossier.returned").Body.ShouldContain("Thiếu ảnh hiện trạng");
    }

    [Fact]
    public async Task Ket_noi_lai_voi_Last_Event_ID_nhan_bu_su_kien_da_lo()
    {
        var http = await api.LoginAsync("demo_cv_vp");
        var userId = await api.UserIdAsync("demo_cv_vp");
        var bus = api.Services.GetRequiredService<HoSoSo.Application.Common.IEventBus>();

        await using (var first = await SseClient.ConnectAsync(http))
        {
            bus.Publish(userId, "notification.created", new { n = 1 });
            var one = await first.WaitForAsync("notification.created");
            // Mất kết nối; trong lúc đó có thêm hai sự kiện.
            await first.DisposeAsync();
            bus.Publish(userId, "notification.created", new { n = 2 });
            bus.Publish(userId, "dossier.changed", new { n = 3 });

            await using var second = await SseClient.ConnectAsync(http, lastEventId: one.Id);
            var replayed = await second.WaitForAsync("dossier.changed");
            second.Seen.Select(e => e.Type).ShouldBe(["notification.created", "dossier.changed"]);
            replayed.Id.ShouldBeGreaterThan(one.Id);
            second.Seen.ShouldAllBe(e => e.Id > one.Id, "chỉ nhận bù phần sau Last-Event-ID");
        }
    }

    [Fact]
    public async Task Outbox_loi_thi_thu_lai_co_gian_cach_va_ghi_ly_do()
    {
        // Thông điệp thiếu trường bắt buộc: không được làm kẹt hàng đợi, và không bị mất.
        var bad = await api.ScalarAsync<long>("INSERT INTO hoso.outbox_messages(type, payload) VALUES ('dossier.transitioned', '{}') RETURNING id");
        var unknown = await api.ScalarAsync<long>("INSERT INTO hoso.outbox_messages(type, payload) VALUES ('loai.la', '{}') RETURNING id");

        var row = await Eventually.ForAsync(
            async () => (await api.ScalarAsync<short>("SELECT attempts FROM hoso.outbox_messages WHERE id = $1", bad), await api.ScalarAsync<DateTime?>("SELECT processed_at FROM hoso.outbox_messages WHERE id = $1", bad)),
            r => r.Item1 >= 1);
        row.Item1.ShouldBe((short)1);
        row.Item2.ShouldBeNull("chưa xử lý được thì giữ lại để thử tiếp");
        (await api.ScalarAsync<string>("SELECT last_error FROM hoso.outbox_messages WHERE id = $1", bad)).ShouldNotBeNullOrEmpty();
        ((double)await api.ScalarAsync<decimal>("SELECT extract(epoch FROM next_attempt_at - now()) FROM hoso.outbox_messages WHERE id = $1", bad)).ShouldBeInRange(2, 6);

        // Loại lạ được đánh dấu xong (và ghi cảnh báo), không chặn các thông điệp sau nó.
        (await Eventually.ForAsync(async () => await api.ScalarAsync<DateTime?>("SELECT processed_at FROM hoso.outbox_messages WHERE id = $1", unknown), v => v is not null)).ShouldNotBeNull();
    }

    [Fact]
    public async Task Thu_hoi_job_treo_va_health_bao_hang_doi_ket()
    {
        api.RequireDatabase();
        var http = await api.LoginAsync("demo_cv_ht");
        var up = await UploadAsync(http, "job-treo");
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status = 'running', locked_by = 'da-chet', attempt = 1, started_at = now() - interval '20 minutes', heartbeat_at = now() - interval '20 minutes', created_at = now() - interval '30 minutes' WHERE id = $1", up.JobId);

        var reaper = api.Services.GetServices<IHostedService>().OfType<StaleJobReaper>().Single();
        (await reaper.RunOnceAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
        (await api.ScalarAsync<string>("SELECT status FROM hoso.ocr_jobs WHERE id = $1", up.JobId)).ShouldBe("queued");
        (await api.ScalarAsync<bool>("SELECT locked_by IS NULL FROM hoso.ocr_jobs WHERE id = $1", up.JobId)).ShouldBeTrue();

        // Việc chờ 30 phút mà không có worker nào chạy: ready vẫn 200 nhưng báo Degraded.
        var ready = await api.CreateClient().GetAsync("/health/ready", TestContext.Current.CancellationToken);
        ready.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await ready.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBe("Degraded");
        (await api.CreateClient().GetAsync("/health/live", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }
}
