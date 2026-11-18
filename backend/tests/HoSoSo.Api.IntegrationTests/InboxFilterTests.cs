using System.Net;
using System.Net.Http.Headers;
using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-129: hộp tiếp nhận lọc trên TOÀN BỘ hộp (tình trạng đọc, lô quét, nhóm, loại) và đếm theo tình trạng đọc.</summary>
public sealed class InboxFilterTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record Batch(Guid Id, string Code);
    private sealed record Summary(int Total, int Queued, int Reading, int Ready, int Failed, int Cancelled);

    private async Task<UploadDto> UploadAsync(HttpClient http, string marker, Guid? batchId = null)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(AiExtractTests.UniquePdf(marker + "-" + Guid.NewGuid().ToString("N")));
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", marker + ".pdf");
        if (batchId is not null) form.Add(new StringContent(batchId.ToString()!), "batchId");
        var response = await http.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return await response.ReadAsync<UploadDto>();
    }

    private Task SetJobAsync(Guid jobId, string status) => status switch
    {
        "reading" => api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='running', locked_by='w1', attempt=1, started_at=now(), heartbeat_at=now(), stage='ocr', page_count=4, processed_pages=1 WHERE id=$1", jobId),
        "ready" => api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='completed', started_at=now(), finished_at=now(), stage='done', processed_pages=1 WHERE id=$1", jobId),
        "failed" => api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='failed', attempt=3, started_at=now(), finished_at=now(), error_message='lỗi thử' WHERE id=$1", jobId),
        "cancelled" => api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='cancelled', started_at=coalesce(started_at, now()), finished_at=now() WHERE id=$1", jobId),
        _ => Task.CompletedTask,
    };

    private async Task<List<InboxDto>> InboxAsync(HttpClient http, string query)
    {
        var response = await http.GetAsync("/api/v1/intake/inbox?" + query, TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return (await response.ReadAsync<PageDto<InboxDto>>()).Items;
    }

    private async Task<Summary> SummaryAsync(HttpClient http, string query = "")
    {
        var response = await http.GetAsync("/api/v1/intake/inbox/summary" + (query.Length > 0 ? "?" + query : ""), TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return await response.ReadAsync<Summary>();
    }

    /// <summary>
    /// Năm giấy tờ, mỗi giấy tờ một tình trạng. Lô 1: A (đã đọc, gợi ý nhóm U15 loại U15-D07) và B (lỗi). Lô 2: C (đang đọc), D (chờ), E (đã hủy).
    /// Các ca trong lớp dùng chung CSDL nên mỗi ca chỉ xét dữ liệu của chính nó: qua lô riêng hoặc <see cref="Mine"/>.
    /// </summary>
    private sealed record Seed(HttpClient Http, Batch Batch1, Batch Batch2, UploadDto A, UploadDto B, UploadDto C, UploadDto D, UploadDto E)
    {
        public HashSet<Guid> All => [A.DocumentId, B.DocumentId, C.DocumentId, D.DocumentId, E.DocumentId];
        public List<Guid> Mine(IEnumerable<InboxDto> items) => items.Select(i => i.DocumentId).Where(All.Contains).Order().ToList();
    }

    private async Task<Seed> SeedAsync()
    {
        var http = await api.LoginAsync("demo_clerk_ubnd");
        var batch1 = await (await http.PostJsonAsync("/api/v1/intake/batches", new { handedOverBy = "Phòng Nội vụ", boxLabel = "Hộp lọc 1", expectedSheetCount = 2 })).ReadAsync<Batch>();
        var batch2 = await (await http.PostJsonAsync("/api/v1/intake/batches", new { handedOverBy = "Phòng Nội vụ", boxLabel = "Hộp lọc 2", expectedSheetCount = 3 })).ReadAsync<Batch>();
        var (a, b) = (await UploadAsync(http, "a", batch1.Id), await UploadAsync(http, "b", batch1.Id));
        var (c, d, e) = (await UploadAsync(http, "c", batch2.Id), await UploadAsync(http, "d", batch2.Id), await UploadAsync(http, "e", batch2.Id));
        await SetJobAsync(a.JobId, "ready");
        await SetJobAsync(b.JobId, "failed");
        await SetJobAsync(c.JobId, "reading");
        await SetJobAsync(e.JobId, "cancelled");
        await api.ExecuteAsync("INSERT INTO hoso.ai_suggestions(job_id, document_id, work_group_code, document_type_code, document_form, title, model_key) VALUES ($1,$2,'U15','U15-D07','Biên bản','x','classifier')", a.JobId, a.DocumentId);
        return new Seed(http, batch1, batch2, a, b, c, d, e);
    }

    private static List<Guid> Sorted(params Guid[] ids) => ids.Order().ToList();

    [Fact]
    public async Task Loc_theo_tinh_trang_doc_tren_toan_hop_khong_chi_phan_da_tai()
    {
        var t = await SeedAsync();
        t.Mine(await InboxAsync(t.Http, "read=ready")).ShouldBe(Sorted(t.A.DocumentId));
        t.Mine(await InboxAsync(t.Http, "read=reading")).ShouldBe(Sorted(t.C.DocumentId));
        t.Mine(await InboxAsync(t.Http, "read=queued")).ShouldBe(Sorted(t.D.DocumentId));
        t.Mine(await InboxAsync(t.Http, "read=failed,cancelled")).ShouldBe(Sorted(t.B.DocumentId, t.E.DocumentId));
        t.Mine(await InboxAsync(t.Http, "")).Count.ShouldBe(5, "không lọc: đủ năm");
        // Không phân biệt hoa thường và khoảng trắng quanh dấu phẩy.
        t.Mine(await InboxAsync(t.Http, "read=READY%2C%20Failed")).ShouldBe(Sorted(t.A.DocumentId, t.B.DocumentId));
        // Dòng trả về mang đúng tình trạng đã lọc.
        (await InboxAsync(t.Http, $"batch={t.Batch1.Id}&read=failed")).Single().Stage.ShouldBe("failed");
    }

    [Fact]
    public async Task Loc_theo_lo_nhom_va_loai_ket_hop_duoc_voi_tinh_trang_doc()
    {
        var t = await SeedAsync();
        (await InboxAsync(t.Http, $"batch={t.Batch1.Id}")).Select(i => i.DocumentId).Order().ShouldBe(Sorted(t.A.DocumentId, t.B.DocumentId));
        (await InboxAsync(t.Http, $"batch={t.Batch2.Id}")).Select(i => i.DocumentId).Order().ShouldBe(Sorted(t.C.DocumentId, t.D.DocumentId, t.E.DocumentId));
        (await InboxAsync(t.Http, $"batch={t.Batch1.Id}&read=failed")).Select(i => i.DocumentId).ShouldBe([t.B.DocumentId]);
        (await InboxAsync(t.Http, $"batch={t.Batch2.Id}&read=failed")).ShouldBeEmpty();
        t.Mine(await InboxAsync(t.Http, "group=U15")).ShouldBe(Sorted(t.A.DocumentId));
        t.Mine(await InboxAsync(t.Http, "type=U15-D07")).ShouldBe(Sorted(t.A.DocumentId));
        (await InboxAsync(t.Http, "group=U99")).ShouldBeEmpty();
        (await InboxAsync(t.Http, $"batch={t.Batch1.Id}&group=U15&read=failed")).ShouldBeEmpty();
        (await InboxAsync(t.Http, $"batch={Guid.NewGuid()}")).ShouldBeEmpty();
    }

    [Fact]
    public async Task Phan_trang_voi_bo_loc_khong_lap_va_khong_thieu()
    {
        var t = await SeedAsync();
        var seen = new List<Guid>();
        string? cursor = null;
        for (var page = 0; page < 6; page++)
        {
            var response = await t.Http.GetAsync($"/api/v1/intake/inbox?batch={t.Batch2.Id}&read=queued,reading,cancelled&limit=1" + (cursor is null ? "" : "&cursor=" + Uri.EscapeDataString(cursor)), TestContext.Current.CancellationToken);
            var body = await response.ReadAsync<PageDto<InboxDto>>();
            body.Items.Count.ShouldBeLessThanOrEqualTo(1);
            seen.AddRange(body.Items.Select(i => i.DocumentId));
            if ((cursor = body.NextCursor) is null) break;
        }
        seen.Order().ToList().ShouldBe(Sorted(t.C.DocumentId, t.D.DocumentId, t.E.DocumentId));
        seen.Distinct().Count().ShouldBe(seen.Count);
    }

    [Fact]
    public async Task Tinh_trang_doc_sai_tra_loi_theo_truong()
    {
        var t = await SeedAsync();
        var response = await t.Http.GetAsync("/api/v1/intake/inbox?read=bogus", TestContext.Current.CancellationToken);
        response.StatusCode.ShouldNotBe(HttpStatusCode.OK);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("read");
    }

    [Fact]
    public async Task Tong_hop_dem_theo_tinh_trang_doc_cung_lo_va_bo_qua_bo_loc_tinh_trang()
    {
        var t = await SeedAsync();
        (await SummaryAsync(t.Http, $"batch={t.Batch1.Id}")).ShouldBe(new Summary(2, 0, 0, 1, 1, 0));
        (await SummaryAsync(t.Http, $"batch={t.Batch2.Id}")).ShouldBe(new Summary(3, 1, 1, 0, 0, 1));
        // `read` không ảnh hưởng số đếm: các nút lọc luôn hiện đủ số của cùng lô/nhóm/loại.
        (await SummaryAsync(t.Http, $"batch={t.Batch1.Id}&read=failed")).ShouldBe(new Summary(2, 0, 0, 1, 1, 0));
        (await SummaryAsync(t.Http, $"batch={t.Batch1.Id}&group=U15")).ShouldBe(new Summary(1, 0, 0, 1, 0, 0));
        (await SummaryAsync(t.Http, $"batch={t.Batch2.Id}&type=U15-D07")).Total.ShouldBe(0);
        var all = await SummaryAsync(t.Http);
        all.Total.ShouldBe(all.Queued + all.Reading + all.Ready + all.Failed + all.Cancelled);
        all.Total.ShouldBeGreaterThanOrEqualTo(5);
    }

    [Fact]
    public async Task Hop_tiep_nhan_chi_cua_chinh_minh_va_can_quyen_tai_len()
    {
        await SeedAsync();
        var other = await api.LoginAsync("demo_cv_ht");
        (await SummaryAsync(other, "group=U15")).Total.ShouldBe(0, "người khác không thấy PDF của văn thư");
        var manager = await api.LoginAsync("demo_head_kt");     // trưởng phòng không có quyền tải lên
        (await manager.GetAsync("/api/v1/intake/inbox/summary", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }
}
