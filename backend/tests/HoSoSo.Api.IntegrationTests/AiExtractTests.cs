using System.Net;
using System.Net.Http.Headers;
using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-98: "Trích xuất ngay" cho hồ sơ và giấy tờ chỉ định.</summary>
public sealed class AiExtractTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record ItemDto(Guid DocumentId, Guid? FileId, Guid? JobId, string Outcome, string? QueueKind, int? QueuePosition, int? EtaSeconds, string? Message);
    private sealed record ResultDto(List<ItemDto> Items, int Raised, int Running, int AlreadyDone, int Created, int Skipped);

    internal static byte[] UniquePdf(string marker) => System.Text.Encoding.ASCII.GetBytes(
        $"%PDF-1.4\n% {marker}\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

    internal static async Task<UploadDto> UploadAsync(HttpClient http, string marker)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(UniquePdf(marker + "-" + Guid.NewGuid().ToString("N")));
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", marker + ".pdf");
        var response = await http.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        return await response.ReadAsync<UploadDto>();
    }

    private async Task<(Guid DossierId, List<UploadDto> Documents)> DossierWithDocumentsAsync(HttpClient http, int count)
    {
        var dossier = await (await http.PostJsonAsync("/api/v1/dossiers", new { title = "Hồ sơ thử trích xuất " + Guid.NewGuid().ToString("N")[..6], workGroupCode = "U15" })).ReadAsync<DossierDetailDto>();
        var documents = new List<UploadDto>();
        for (var i = 0; i < count; i++)
        {
            var up = await UploadAsync(http, $"tx-{i}");
            (await http.PostJsonAsync($"/api/v1/dossiers/{dossier.Id}/documents", new { documentId = up.DocumentId, direction = "internal" })).StatusCode.ShouldBe(HttpStatusCode.OK);
            documents.Add(up);
        }
        return (dossier.Id, documents);
    }

    private static async Task<ResultDto> ExtractAsync(HttpClient http, string url, object? body = null)
    {
        var response = await http.PostJsonAsync(url, body);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return await response.ReadAsync<ResultDto>();
    }

    /// <summary>Các test trong lớp dùng chung CSDL: hủy việc còn chờ của test khác để vị trí trong hàng đợi chỉ tính việc của test này.</summary>
    private Task ResetQueueAsync() => api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status = 'cancelled', started_at = coalesce(started_at, now()), finished_at = now() WHERE status IN ('queued', 'running')");

    private Task<long> JobCountAsync(Guid fileId) => api.ScalarAsync<long>("SELECT count(*) FROM hoso.ocr_jobs WHERE file_id = $1", fileId);

    [Fact]
    public async Task Ho_so_4_giay_to_o_4_trang_thai_cho_dung_4_ket_qua_va_goi_lai_khong_tao_viec_trung()
    {
        await ResetQueueAsync();
        var cv = await api.LoginAsync("demo_cv_ht");
        var me = await api.UserIdAsync("demo_cv_ht");
        var (dossierId, docs) = await DossierWithDocumentsAsync(cv, 4);
        var (queued, running, done, failed) = (docs[0], docs[1], docs[2], docs[3]);
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='running', locked_by='w1', attempt=1, started_at=now(), heartbeat_at=now(), stage='ocr', page_count=4, processed_pages=1 WHERE id=$1", running.JobId);
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='completed', started_at=now(), finished_at=now(), stage='done', processed_pages=1 WHERE id=$1", done.JobId);
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='failed', attempt=3, started_at=now(), finished_at=now(), error_message='lỗi thử' WHERE id=$1", failed.JobId);

        var result = await ExtractAsync(cv, $"/api/v1/dossiers/{dossierId}/ai/extract");
        ItemDto Item(UploadDto d) => result.Items.Single(i => i.DocumentId == d.DocumentId);
        (Item(queued).Outcome, Item(running).Outcome, Item(done).Outcome, Item(failed).Outcome).ShouldBe(("raised", "running", "alreadyDone", "created"));
        (result.Raised, result.Running, result.AlreadyDone, result.Created, result.Skipped).ShouldBe((1, 1, 1, 1, 0));

        // Đang chờ: lên mức 1, ghi người nâng.
        (await api.ScalarAsync<short>("SELECT priority FROM hoso.ocr_jobs WHERE id = $1", queued.JobId)).ShouldBe((short)1);
        (await api.ScalarAsync<Guid>("SELECT prioritized_by FROM hoso.ocr_jobs WHERE id = $1", queued.JobId)).ShouldBe(me);
        // Đang chạy: nâng mức để không bị nhường chỗ nữa.
        (await api.ScalarAsync<short>("SELECT priority FROM hoso.ocr_jobs WHERE id = $1", running.JobId)).ShouldBe((short)1);
        // Đã xong: giữ nguyên, không thêm việc.
        (await JobCountAsync(done.FileId), Item(done).JobId).ShouldBe((1L, done.JobId));
        // Lỗi: tạo việc mới mức 1.
        (await JobCountAsync(failed.FileId)).ShouldBe(2);
        var created = Item(failed).JobId.ShouldNotBeNull();
        created.ShouldNotBe(failed.JobId);
        (await api.ScalarAsync<string>("SELECT job_type || ':' || priority || ':' || status FROM hoso.ocr_jobs WHERE id = $1", created)).ShouldBe("read_classify:1:queued");
        // Vị trí: việc nâng trước đứng trước; việc đang chạy không có vị trí.
        (Item(queued).QueueKind, Item(queued).QueuePosition, Item(failed).QueuePosition, Item(running).QueuePosition).ShouldBe(("priority", 1, 2, null));

        // Gọi lại: không tạo việc trùng, không đẩy việc đã nâng ra sau.
        var raisedAt = await api.ScalarAsync<DateTime>("SELECT prioritized_at FROM hoso.ocr_jobs WHERE id = $1", queued.JobId);
        var again = await ExtractAsync(cv, $"/api/v1/dossiers/{dossierId}/ai/extract");
        ItemDto Again(UploadDto d) => again.Items.Single(i => i.DocumentId == d.DocumentId);
        (Again(queued).Outcome, Again(running).Outcome, Again(done).Outcome, Again(failed).Outcome).ShouldBe(("raised", "running", "alreadyDone", "raised"));
        (await JobCountAsync(failed.FileId)).ShouldBe(2);
        Again(failed).JobId.ShouldBe(created);
        (await api.ScalarAsync<DateTime>("SELECT prioritized_at FROM hoso.ocr_jobs WHERE id = $1", queued.JobId)).ShouldBe(raisedAt, "bấm lại không làm mất chỗ đã giành");

        // force: giấy tờ đã xong được gợi ý lại từ trang đã đọc (không OCR lại); gọi lần nữa thì dùng lại việc đó.
        var forced = await ExtractAsync(cv, $"/api/v1/dossiers/{dossierId}/ai/extract", new { force = true });
        forced.Items.Single(i => i.DocumentId == done.DocumentId).Outcome.ShouldBe("created");
        (await JobCountAsync(done.FileId)).ShouldBe(2);
        (await api.ScalarAsync<string>("SELECT job_type || ':' || priority || ':' || (options->>'target_job_id') FROM hoso.ocr_jobs WHERE file_id = $1 AND job_type = 'reclassify'", done.FileId))
            .ShouldBe($"reclassify:1:{done.JobId}");
        var forcedAgain = await ExtractAsync(cv, $"/api/v1/dossiers/{dossierId}/ai/extract", new { force = true });
        forcedAgain.Items.Single(i => i.DocumentId == done.DocumentId).Outcome.ShouldBe("raised");
        (await JobCountAsync(done.FileId)).ShouldBe(2);
    }

    [Fact]
    public async Task Chon_mot_phan_giay_to_cua_ho_so_va_giay_to_ngoai_ho_so_bi_tu_choi()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var (dossierId, docs) = await DossierWithDocumentsAsync(cv, 3);
        var result = await ExtractAsync(cv, $"/api/v1/dossiers/{dossierId}/ai/extract", new { documentIds = new[] { docs[1].DocumentId } });
        result.Items.Select(i => i.DocumentId).ShouldBe([docs[1].DocumentId]);
        (await api.ScalarAsync<short>("SELECT priority FROM hoso.ocr_jobs WHERE id = $1", docs[0].JobId)).ShouldBe((short)7, "giấy tờ không chọn vẫn ở khay nền");

        var stranger = await ExtractAsync(cv, $"/api/v1/documents/{docs[0].DocumentId}/ai/extract");       // giấy tờ khác, tự nó hợp lệ
        stranger.Raised.ShouldBe(1);
        var outside = await UploadAsync(cv, "ngoai-ho-so");
        var response = await cv.PostJsonAsync($"/api/v1/dossiers/{dossierId}/ai/extract", new { documentIds = new[] { outside.DocumentId } });
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.ProblemCodeAsync()).ShouldBe("validation_failed");
    }

    [Fact]
    public async Task Ngoai_pham_vi_va_thieu_quyen_bi_chan_khong_tao_viec()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var (dossierId, docs) = await DossierWithDocumentsAsync(cv, 1);
        var inbox = await UploadAsync(cv, "hop-tiep-nhan");

        var other = await api.LoginAsync("demo_cv_kt");
        (await other.PostJsonAsync($"/api/v1/dossiers/{dossierId}/ai/extract")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await other.PostJsonAsync($"/api/v1/documents/{docs[0].DocumentId}/ai/extract")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await other.PostJsonAsync($"/api/v1/documents/{inbox.DocumentId}/ai/extract")).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        var manager = await api.LoginAsync("demo_head_ht");           // trưởng phòng: xem được hồ sơ nhưng không có quyền chuẩn bị/tải lên
        (await manager.PostJsonAsync($"/api/v1/dossiers/{dossierId}/ai/extract")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await manager.PostJsonAsync($"/api/v1/documents/{docs[0].DocumentId}/ai/extract")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        (await api.ScalarAsync<short>("SELECT priority FROM hoso.ocr_jobs WHERE id = $1", docs[0].JobId)).ShouldBe((short)7, "bị chặn thì không đổi gì");
        (await api.ScalarAsync<short>("SELECT priority FROM hoso.ocr_jobs WHERE id = $1", inbox.JobId)).ShouldBe((short)7);
    }

    [Fact]
    public async Task Giay_to_o_hop_tiep_nhan_nang_len_dau_hang_va_giay_to_da_bo_hoac_khong_co_tep_duoc_bao_dung()
    {
        await ResetQueueAsync();
        var cv = await api.LoginAsync("demo_cv_ht");
        var up = await UploadAsync(cv, "don-le");
        var first = await ExtractAsync(cv, $"/api/v1/documents/{up.DocumentId}/ai/extract");
        var item = first.Items.Single();
        (item.Outcome, item.QueueKind, item.QueuePosition, item.JobId).ShouldBe(("raised", "priority", 1, up.JobId));

        // Giấy tờ công khai không có tệp quét để đọc.
        var publicDocument = await api.ScalarAsync<Guid>("SELECT id FROM hoso.documents WHERE origin = 'public_source' LIMIT 1");
        var skipped = await ExtractAsync(cv, $"/api/v1/documents/{publicDocument}/ai/extract");
        (skipped.Skipped, skipped.Items.Single().Outcome).ShouldBe((1, "skipped"));
        skipped.Items.Single().Message.ShouldNotBeNull().ShouldContain("tệp quét");

        // Đã bỏ khỏi hộp tiếp nhận thì không trích xuất.
        var gone = await UploadAsync(cv, "da-bo");
        (await cv.PostJsonAsync($"/api/v1/intake/documents/{gone.DocumentId}/discard")).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var response = await cv.PostJsonAsync($"/api/v1/documents/{gone.DocumentId}/ai/extract");
        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Nhieu_nguoi_bam_cung_luc_chi_tao_mot_viec()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var up = await UploadAsync(cv, "dong-thoi");
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='failed', attempt=3, started_at=now(), finished_at=now(), error_message='lỗi thử' WHERE id=$1", up.JobId);

        var responses = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => cv.PostJsonAsync($"/api/v1/documents/{up.DocumentId}/ai/extract")));
        responses.ShouldAllBe(r => r.StatusCode == HttpStatusCode.OK);
        var results = await Task.WhenAll(responses.Select(r => r.ReadAsync<ResultDto>()));
        (await JobCountAsync(up.FileId)).ShouldBe(2, "việc lỗi cũ và đúng một việc mới");
        results.Select(r => r.Items.Single().JobId).Distinct().Count().ShouldBe(1);
        results.Count(r => r.Created == 1).ShouldBe(1);
    }
}

/// <summary>BE-98: giới hạn số giấy tờ và tốc độ gọi.</summary>
public sealed class AiExtractLimitTests(AiExtractLimitTests.LowLimits api) : IClassFixture<AiExtractLimitTests.LowLimits>
{
    public sealed class LowLimits : DbApiFactory
    {
        protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseSetting("Ai:ExtractMaxDocuments", "2");
            builder.UseSetting("Limits:AiExtractPerMinute", "3");
        }
    }

    [Fact]
    public async Task Qua_so_giay_to_toi_da_moi_lan_bi_tu_choi_va_chon_bot_thi_duoc()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var dossier = await (await cv.PostJsonAsync("/api/v1/dossiers", new { title = "Hồ sơ quá giới hạn", workGroupCode = "U15" })).ReadAsync<DossierDetailDto>();
        var docs = new List<UploadDto>();
        for (var i = 0; i < 3; i++)
        {
            var up = await AiExtractTests.UploadAsync(cv, $"gh-{i}");
            (await cv.PostJsonAsync($"/api/v1/dossiers/{dossier.Id}/documents", new { documentId = up.DocumentId, direction = "internal" })).StatusCode.ShouldBe(HttpStatusCode.OK);
            docs.Add(up);
        }
        var tooMany = await cv.PostJsonAsync($"/api/v1/dossiers/{dossier.Id}/ai/extract");
        tooMany.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await tooMany.ProblemCodeAsync()).ShouldBe("validation_failed");
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.ocr_jobs WHERE priority = 1")).ShouldBe(0, "vượt giới hạn thì không nâng giấy tờ nào");

        var subset = await cv.PostJsonAsync($"/api/v1/dossiers/{dossier.Id}/ai/extract", new { documentIds = new[] { docs[0].DocumentId, docs[1].DocumentId } });
        subset.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Bam_lien_tuc_bi_gioi_han_toc_do_theo_nguoi()
    {
        var clerk = await api.LoginAsync("demo_clerk_hdnd");
        var up = await AiExtractTests.UploadAsync(clerk, "toc-do");
        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 10; i++) statuses.Add((await clerk.PostJsonAsync($"/api/v1/documents/{up.DocumentId}/ai/extract")).StatusCode);
        statuses.ShouldContain(HttpStatusCode.OK);
        statuses.ShouldContain(HttpStatusCode.TooManyRequests, "mỗi người tối đa 3 lần mỗi phút trong cấu hình thử");
    }
}
