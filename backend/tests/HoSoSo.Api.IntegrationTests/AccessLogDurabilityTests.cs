using System.Net;
using System.Net.Http.Headers;
using System.Text;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Infrastructure.Auditing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>
/// BE-94: nhật ký truy cập không mất dòng âm thầm. Thao tác đưa nội dung ra ngoài ghi đồng bộ (không ghi được thì không trả nội dung);
/// dòng không nhạy cảm đi qua hàng đợi có thử lại, đếm đúng dòng mất, báo Degraded và thông báo cho quản trị kỹ thuật; mỗi dòng ghi phân công đã dùng.
/// CSDL "hỏng" được mô phỏng bằng trigger từ chối mọi INSERT vào access_events.
/// </summary>
public sealed class AccessLogDurabilityTests(AccessLogDurabilityTests.RetryFactory api) : IClassFixture<AccessLogDurabilityTests.RetryFactory>
{
    public sealed class RetryFactory : DbApiFactory
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseSetting("AccessLog:RetryDelaysMs:0", "150");
            builder.UseSetting("AccessLog:RetryDelaysMs:1", "150");
            builder.UseSetting("AccessLog:RetryDelaysMs:2", "150");
        }
    }

    private async Task BlockLogAsync()
    {
        await api.ExecuteAsync("CREATE OR REPLACE FUNCTION hoso.zz_block_access_log() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Nhật ký tạm hỏng (thử nghiệm)'; END $$");
        await api.ExecuteAsync("CREATE TRIGGER zz_block_access_log BEFORE INSERT ON hoso.access_events FOR EACH ROW EXECUTE FUNCTION hoso.zz_block_access_log()");
    }

    private async Task UnblockLogAsync()
    {
        await api.ExecuteAsync("DROP TRIGGER IF EXISTS zz_block_access_log ON hoso.access_events");
        await api.ExecuteAsync("DROP FUNCTION IF EXISTS hoso.zz_block_access_log()");
    }

    private async Task<UploadDto> UploadAsync(HttpClient http)
    {
        var form = new MultipartFormDataContent
        {
            { new ByteArrayContent(Encoding.ASCII.GetBytes($"%PDF-1.4\n% {Guid.NewGuid():N}\n%%EOF\n")) { Headers = { ContentType = new MediaTypeHeaderValue("application/pdf") } }, "file", "nhat-ky.pdf" },
        };
        return await (await http.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();
    }

    [Fact]
    public async Task Hang_doi_day_dem_dung_so_dong_bi_bo_va_tinh_thoi_diem_mat()
    {
        var queue = new AccessEventQueue();       // không có ai đọc: mọi dòng vượt sức chứa là bị đẩy ra
        for (var i = 0; i < AccessEventQueue.Capacity + 50; i++)
            queue.Enqueue(new AccessEventRecord(Guid.NewGuid(), "view", "file", Guid.NewGuid(), null, "c", DateTimeOffset.UtcNow));
        queue.Dropped.ShouldBe(50, "trước đây bộ đếm này luôn bằng 0 dù có dòng bị bỏ");
        queue.Pending.ShouldBe(AccessEventQueue.Capacity, "dòng đã bị bỏ không còn được tính là đang chờ ghi");
        queue.LastLossAt.ShouldNotBeNull();
        queue.Failed.ShouldBe(0);
    }

    [Fact]
    public async Task Tai_tep_ghi_nhat_ky_dong_bo_va_ghi_ca_phan_cong_da_dung()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var upload = await UploadAsync(http);
        var assignment = await api.AssignmentIdAsync("demo_cv_ht", "employee");

        (await http.GetAsync($"/api/v1/files/{upload.FileId}/content?download=true")).StatusCode.ShouldBe(HttpStatusCode.OK);
        // Không cần chờ hàng đợi nền: dòng của thao tác nhạy cảm đã nằm trong CSDL ngay khi phản hồi trả về.
        var row = await api.ScalarAsync<string>("SELECT assignment FROM hoso.access_events WHERE object_id = $1 AND action IN ('download','view') ORDER BY id DESC LIMIT 1", upload.FileId);
        row.ShouldBe(assignment);
        (await api.ScalarAsync<Guid>("SELECT user_role_id FROM hoso.access_events WHERE object_id = $1 ORDER BY id DESC LIMIT 1", upload.FileId)).ToString().ShouldBe(assignment);
    }

    [Fact]
    public async Task Khong_ghi_duoc_nhat_ky_thi_khong_tra_noi_dung_tep_va_khong_tra_goi_xuat_nhung_van_tim_kiem_duoc()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var upload = await UploadAsync(http);
        await BlockLogAsync();
        try
        {
            var denied = await http.GetAsync($"/api/v1/files/{upload.FileId}/content");
            denied.StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable);
            (await denied.ProblemCodeAsync()).ShouldBe("audit_unavailable");
            (await denied.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken)).Length.ShouldBeLessThan(2000, "phản hồi lỗi, không phải nội dung tệp");
            (await http.PostJsonAsync("/api/v1/exports", new { dossierIds = new[] { Guid.NewGuid() } })).StatusCode.ShouldNotBe(HttpStatusCode.OK);

            // Thao tác không nhạy cảm (tìm kiếm) vẫn chạy bình thường: dòng của nó nằm trong hàng đợi để thử lại.
            (await http.GetAsync("/api/v1/search?q=ngan%20sach")).StatusCode.ShouldBe(HttpStatusCode.OK);
        }
        finally { await UnblockLogAsync(); }

        (await http.GetAsync($"/api/v1/files/{upload.FileId}/content")).StatusCode.ShouldBe(HttpStatusCode.OK);
        await api.Services.GetRequiredService<AccessEventQueue>().DrainAsync(TimeSpan.FromSeconds(20));
    }

    [Fact]
    public async Task CSDL_hong_ngan_thi_dong_nen_duoc_thu_lai_va_ghi_du_khong_mat_dong_nao()
    {
        var queue = api.Services.GetRequiredService<AccessEventQueue>();
        var failedBefore = queue.Failed;
        var http = await api.LoginAsync("demo_cv_vp");
        await BlockLogAsync();
        try
        {
            (await http.GetAsync("/api/v1/search?q=phuc%20hoi%20sau%20thu%20lai")).StatusCode.ShouldBe(HttpStatusCode.OK);
            await Task.Delay(500, TestContext.Current.CancellationToken);        // vừa đủ để lần ghi đầu bị từ chối và đang chờ thử lại
        }
        finally { await UnblockLogAsync(); }                                     // CSDL "hồi phục" trong lúc còn lượt thử lại

        await queue.DrainAsync(TimeSpan.FromSeconds(20));
        queue.Failed.ShouldBe(failedBefore, "đã thử lại thành công nên không mất dòng nào");
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.access_events e JOIN hoso.users u ON u.id = e.user_id WHERE u.username = 'demo_cv_vp' AND e.action = 'search'")).ShouldBe(1);
    }

    [Fact]
    public async Task Het_luot_thu_lai_thi_dem_la_mat_bao_Degraded_va_thong_bao_quan_tri_ky_thuat()
    {
        var queue = api.Services.GetRequiredService<AccessEventQueue>();
        var failedBefore = queue.Failed;
        var http = await api.LoginAsync("demo_cv_vx");
        await BlockLogAsync();
        try
        {
            (await http.GetAsync("/api/v1/search?q=het%20luot%20thu%20lai")).StatusCode.ShouldBe(HttpStatusCode.OK);
            await queue.DrainAsync(TimeSpan.FromSeconds(20));                    // 3 lượt thử lại × 150 ms rồi bỏ cuộc
        }
        finally { await UnblockLogAsync(); }

        queue.Failed.ShouldBeGreaterThan(failedBefore);
        queue.LastLossAt.ShouldNotBeNull();
        var ready = await api.CreateClient().GetAsync("/health/ready");
        ready.StatusCode.ShouldBe(HttpStatusCode.OK, "Degraded vẫn trả 200: hệ thống dùng được, chỉ báo có khoảng trống nhật ký");
        (await ready.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBe("Degraded");

        var notified = await Eventually.ForAsync(
            () => api.ScalarAsync<long>("SELECT count(*) FROM hoso.notifications n JOIN hoso.users u ON u.id = n.user_id WHERE n.kind = 'accesslog.loss' AND u.username = 'demo_admin'"),
            n => n >= 1, TimeSpan.FromSeconds(10));
        notified.ShouldBe(1, "quản trị kỹ thuật nhận đúng một thông báo");
        (await api.ScalarAsync<string>("SELECT link FROM hoso.notifications WHERE kind = 'accesslog.loss' LIMIT 1")).ShouldBe("/quan-tri/van-hanh");
    }
}
