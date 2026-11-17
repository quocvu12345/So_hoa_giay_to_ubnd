using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-99: thời gian chờ ước tính lấy từ số đo thật của 24 giờ qua; việc nền đang chạy chỉ chắn một trang khi có việc ưu tiên.</summary>
public sealed class AiQueueEtaTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private static async Task<int?> EtaAsync(HttpClient http, Guid jobId) => (await (await http.GetAsync($"/api/v1/jobs/{jobId}")).ReadAsync<JobDto>()).EtaSeconds;

    [Fact]
    public async Task Uoc_tinh_cong_so_trang_phia_truoc_nhan_giay_moi_trang_va_viec_nen_dang_chay_chi_chan_mot_trang()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var sample = await AiExtractTests.UploadAsync(http, "mau-do");
        var b = await AiExtractTests.UploadAsync(http, "b");
        var c = await AiExtractTests.UploadAsync(http, "c");
        var d = await AiExtractTests.UploadAsync(http, "d");
        var own = await AiExtractTests.UploadAsync(http, "own");
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='cancelled', started_at=now(), finished_at=now() WHERE id = $1", sample.JobId);   // chỉ để lấy tệp

        // Chưa có số đo nào: không đoán.
        (await EtaAsync(http, own.JobId)).ShouldBeNull();

        // Số đo 24 giờ: 3 trang OCR mỗi trang 12 giây; việc mất 42 giây, tức 6 giây ngoài OCR (gợi ý, chuẩn bị).
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='completed', started_at=now() - interval '1 minute', finished_at=now() - interval '1 minute' + interval '42 seconds', stage='done' WHERE id = $1", sample.JobId);
        for (var page = 1; page <= 3; page++)
            await api.ExecuteAsync("INSERT INTO hoso.ocr_pages(job_id, page_no, method, text, status, elapsed_seconds) VALUES ($1, $2, 'ocr', 'chữ', 'completed', 12)", sample.JobId, page);
        // Ba việc đứng trước với 2, 3, 1 trang chưa đọc; việc của mình 1 trang.
        foreach (var (job, pages) in new[] { (b, 2), (c, 3), (d, 1), (own, 1) })
            await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET page_count = $2 WHERE id = $1", job.JobId, pages);
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET created_at = now() - interval '5 minutes' WHERE id = $1", b.JobId);
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET created_at = now() - interval '4 minutes' WHERE id = $1", c.JobId);
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET created_at = now() - interval '3 minutes' WHERE id = $1", d.JobId);

        // (2 + 3 + 1 + 1 trang) × 12 giây + 4 việc × 6 giây = 108 giây.
        (await EtaAsync(http, own.JobId)).ShouldBe(108);
        (await EtaAsync(http, b.JobId)).ShouldBe(2 * 12 + 1 * 6, "việc đứng đầu chỉ tính trang của chính nó");

        // Được nâng lên mức 1: không còn việc nào đứng trước (ba việc kia ở khay nền): 1 trang × 12 + 6 = 18 giây.
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET priority = 1, prioritized_at = now() WHERE id = $1", own.JobId);
        (await EtaAsync(http, own.JobId)).ShouldBe(18);

        // Việc nền b đang chạy (còn 2 trang): việc ưu tiên chỉ chờ nó xong trang hiện tại, không chờ cả tệp: (1 + 1) × 12 + 6 = 30 giây.
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='running', locked_by='w1', attempt=1, started_at=now(), heartbeat_at=now(), stage='ocr', processed_pages=0 WHERE id = $1", b.JobId);
        (await EtaAsync(http, own.JobId)).ShouldBe(30);
        // Còn việc chạy chính nó: 2 trang × 12 + 6 = 30 giây.
        (await EtaAsync(http, b.JobId)).ShouldBe(30);
        // Việc nền c phải chờ cả việc ưu tiên (1 trang) lẫn b chạy trọn vẹn (2 trang), rồi tới mình (3 trang): (1 + 2 + 3) × 12 + 3 × 6 = 90.
        (await EtaAsync(http, c.JobId)).ShouldBe(90);

        // Hộp tiếp nhận và trang vận hành dùng cùng số liệu.
        var inbox = (await (await http.GetAsync("/api/v1/intake/inbox")).ReadAsync<PageDto<InboxDto>>()).Items;
        inbox.Single(i => i.DocumentId == own.DocumentId).QueueKind.ShouldBe("priority");
    }
}

/// <summary>BE-99: tỉ lệ trang phải OCR (CSDL riêng để không lẫn số đo với lớp trên).</summary>
public sealed class AiQueueEtaShareTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    [Fact]
    public async Task Trang_co_lop_chu_khong_can_OCR_nen_keo_giam_giay_moi_trang()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var sample = await AiExtractTests.UploadAsync(http, "mau-lop-chu");
        var waiting = await AiExtractTests.UploadAsync(http, "dang-cho");
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='completed', started_at=now() - interval '1 minute', finished_at=now() - interval '1 minute' + interval '36 seconds', stage='done' WHERE id = $1", sample.JobId);
        // 3 trang OCR (12 giây) và 3 trang có lớp chữ (0 giây): một nửa số trang phải OCR.
        for (var page = 1; page <= 6; page++)
            await api.ExecuteAsync("INSERT INTO hoso.ocr_pages(job_id, page_no, method, text, status, elapsed_seconds) VALUES ($1, $2, $3, 'chữ', 'completed', $4)",
                sample.JobId, page, page <= 3 ? "ocr" : "pdf_text", page <= 3 ? 12m : 0m);
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET page_count = 4 WHERE id = $1", waiting.JobId);

        // Giây/trang = 12 × 0,5 = 6; 4 trang → 24 giây; ngoài OCR: 36 - 36 = 0.
        (await EtaAsync(http, waiting.JobId)).ShouldBe(24);
    }

    private static async Task<int?> EtaAsync(HttpClient http, Guid jobId) => (await (await http.GetAsync($"/api/v1/jobs/{jobId}")).ReadAsync<JobDto>()).EtaSeconds;
}
