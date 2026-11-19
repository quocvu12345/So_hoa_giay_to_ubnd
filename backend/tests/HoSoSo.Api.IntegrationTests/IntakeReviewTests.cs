using System.Net;
using System.Net.Http.Headers;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Infrastructure.Auditing;
using Microsoft.Extensions.DependencyInjection;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-41–44, BE-47–50: tải PDF → hàng đợi AI → gợi ý → đối chiếu → xếp vào hồ sơ → trình duyệt.</summary>
public sealed class IntakeReviewTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private static readonly string SamplePdf = Path.Combine(TestDatabase.MigrationsPath, "..", "..", "..", "database", "samples", "public-016.pdf");

    private static MultipartFormDataContent PdfForm(byte[] bytes, string name = "bien-ban-kiem-tra.pdf", string contentType = "application/pdf")
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        form.Add(file, "file", name);
        return form;
    }

    private static byte[] UniquePdf(string marker)
    {
        // PDF tối giản nhưng có đầu tệp hợp lệ; mỗi marker cho một mã băm khác nhau.
        var body = $"%PDF-1.4\n% {marker}\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n";
        return System.Text.Encoding.ASCII.GetBytes(body);
    }

    private async Task<UploadDto> UploadAsync(HttpClient http, string marker, Guid? batchId = null)
    {
        var form = PdfForm(UniquePdf(marker));
        if (batchId is not null) form.Add(new StringContent(batchId.ToString()!), "batchId");
        return await (await http.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();
    }

    /// <summary>Mô phỏng worker Python: cùng chuỗi lệnh SQL như ai-worker/src/hoso_ai/queue/postgres.py (docs/03 mục 8).</summary>
    private async Task WorkerRunAsync(Guid jobId, bool complete, string? typeCode = "U15-D07")
    {
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='running', locked_by='test-worker', attempt=attempt+1, started_at=now(), heartbeat_at=now(), stage='ocr', page_count=2 WHERE id=$1", jobId);
        if (!complete) return;
        await api.ExecuteAsync("INSERT INTO hoso.ocr_pages(job_id, page_no, method, text, status, elapsed_seconds) VALUES ($1,1,'ocr','Biên bản kiểm tra hiện trạng đất. Số 12/BB-UBND', 'completed', 11.5), ($1,2,'ocr','Người ký: Nguyễn Văn An', 'completed', 9.2)", jobId);
        var documentId = await api.ScalarAsync<Guid>("SELECT f.document_id FROM hoso.ocr_jobs j JOIN hoso.files f ON f.id = j.file_id WHERE j.id = $1", jobId);
        var suggestionId = await api.ScalarAsync<long>(
            "INSERT INTO hoso.ai_suggestions(job_id, document_id, work_group_code, document_type_code, document_form, title, reason, quote, evidence_verified, model_key) " +
            "VALUES ($1,$2,'U15',$3,'Biên bản','Biên bản kiểm tra hiện trạng đất','Tiêu đề nêu rõ biên bản kiểm tra hiện trạng đất','Biên bản kiểm tra hiện trạng đất', true, 'classifier') RETURNING id",
            jobId, documentId, typeCode ?? (object)DBNull.Value);
        await api.ExecuteAsync(
            "INSERT INTO hoso.ai_field_suggestions(suggestion_id, field_definition_code, value, quote, source_pages, quote_verified) VALUES " +
            "($1,'U15-D07-F01','12/BB-UBND','Số 12/BB-UBND','{1}',true), ($1,'U15-D07-F06','Nguyễn Văn An','Người ký: Nguyễn Văn An','{2}',true), ($1,'U15-D07-F03','','','{}',false)", suggestionId);
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='completed', finished_at=now(), locked_by=NULL, stage='done', processed_pages=2 WHERE id=$1", jobId);
    }

    [Fact]
    public async Task Tai_pdf_len_luu_theo_ma_bam_tao_giay_to_o_hop_tiep_nhan_va_xep_hang_doi_AI()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var bytes = await File.ReadAllBytesAsync(SamplePdf, TestContext.Current.CancellationToken);
        var response = await http.PostAsync("/api/v1/intake/files", PdfForm(bytes, "kiem-tra-hien-truong.pdf"), TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        var up = await response.ReadAsync<UploadDto>();

        var sha = Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(bytes));
        File.Exists(Path.Combine(api.StorageRoot, "blobs", sha[..2], sha[2..4], sha)).ShouldBeTrue("tệp lưu theo mã băm");
        (await api.ScalarAsync<string>("SELECT sha256 FROM hoso.files WHERE id = $1", up.FileId)).ShouldBe(sha);

        var job = await (await http.GetAsync($"/api/v1/jobs/{up.JobId}")).ReadAsync<JobDto>();
        job.Status.ShouldBe("queued");
        job.QueuePosition.ShouldNotBeNull().ShouldBeGreaterThanOrEqualTo(1);
        (await api.ScalarAsync<short>("SELECT priority FROM hoso.ocr_jobs WHERE id = $1", up.JobId)).ShouldBe((short)7, "PDF mới tải lên vào khay nền (BE-97)");
        (await api.ScalarAsync<string>("SELECT options->>'classify' FROM hoso.ocr_jobs WHERE id = $1", up.JobId)).ShouldBe("true");

        var inbox = (await (await http.GetAsync("/api/v1/intake/inbox")).ReadAsync<PageDto<InboxDto>>()).Items;
        var item = inbox.Single(i => i.DocumentId == up.DocumentId);
        (item.Stage, item.FileName).ShouldBe(("queued", "kiem-tra-hien-truong.pdf"));
        item.QueuePosition.ShouldBe(job.QueuePosition);

        // Tải lại đúng PDF đó: 409 kèm giấy tờ cũ, không tạo thêm gì.
        var again = await http.PostAsync("/api/v1/intake/files", PdfForm(bytes, "ban-sao-cua-file-tren.pdf"), TestContext.Current.CancellationToken);
        again.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await again.ProblemCodeAsync()).ShouldBe("duplicate_file");
        (await again.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain(up.DocumentId.ToString());
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.files WHERE sha256 = $1 AND file_role = 'scan'", sha)).ShouldBe(1);
    }

    [Fact]
    public async Task Tep_khong_phai_PDF_hoac_sai_duoi_bi_tu_choi_va_khong_luu()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var before = await api.ScalarAsync<long>("SELECT count(*) FROM hoso.files");
        var fake = await http.PostAsync("/api/v1/intake/files", PdfForm("MZ này là chương trình, không phải PDF"u8.ToArray(), "dang-ngo.pdf"), TestContext.Current.CancellationToken);
        fake.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await fake.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("không phải PDF");
        var wrongExt = await http.PostAsync("/api/v1/intake/files", PdfForm(UniquePdf("duoi-sai"), "tai-lieu.exe"), TestContext.Current.CancellationToken);
        wrongExt.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.files")).ShouldBe(before);

        var manager = await api.LoginAsync("demo_head_kt");   // trưởng phòng không có quyền tải lên
        (await manager.PostAsync("/api/v1/intake/files", PdfForm(UniquePdf("khong-quyen")), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Tep_vuot_gioi_han_kich_thuoc_tra_413()
    {
        api.RequireDatabase();
        await using var small = api.WithWebHostBuilder(b => b.UseSetting("Limits:UploadMaxBytes", "1000000"));
        var http = small.CreateClient(new() { AllowAutoRedirect = false, HandleCookies = true });
        await http.GetAsync("/api/v1/auth/dev-login?username=demo_cv_ht", TestContext.Current.CancellationToken);
        http.DefaultRequestHeaders.Add("X-CSRF", "1");
        var big = new byte[1_300_000];
        "%PDF-1.4"u8.CopyTo(big);
        var response = await http.PostAsync("/api/v1/intake/files", PdfForm(big, "qua-lon.pdf"), TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.RequestEntityTooLarge);
        // Các endpoint khác giới hạn 1 MB.
        var huge = await http.PostJsonAsync("/api/v1/dossiers", new { title = new string('a', 1_200_000), workGroupCode = "U15" });
        huge.StatusCode.ShouldBeOneOf(HttpStatusCode.RequestEntityTooLarge, HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Nguoi_khac_khong_thay_giay_to_viec_doc_hay_tep_cua_toi()
    {
        var mine = await api.LoginAsync("demo_cv_ht");
        var up = await UploadAsync(mine, "rieng-tu");
        var other = await api.LoginAsync("demo_cv_kt");
        (await other.GetAsync($"/api/v1/documents/{up.DocumentId}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await other.GetAsync($"/api/v1/documents/{up.DocumentId}/review")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await other.GetAsync($"/api/v1/jobs/{up.JobId}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await other.PostJsonAsync($"/api/v1/jobs/{up.JobId}/cancel")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await other.GetAsync($"/api/v1/files/{up.FileId}/content")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await other.PostJsonAsync($"/api/v1/intake/documents/{up.DocumentId}/discard")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await (await other.GetAsync("/api/v1/intake/inbox")).ReadAsync<PageDto<InboxDto>>()).Items.ShouldNotContain(i => i.DocumentId == up.DocumentId);
    }

    [Fact]
    public async Task Xem_tep_ho_tro_Range_va_ghi_nhat_ky_truy_cap()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var bytes = UniquePdf("xem-tep-range");
        var up = await (await http.PostAsync("/api/v1/intake/files", PdfForm(bytes), TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();

        var request = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/files/{up.FileId}/content");
        request.Headers.Range = new RangeHeaderValue(0, 7);
        var partial = await http.SendAsync(request, TestContext.Current.CancellationToken);
        partial.StatusCode.ShouldBe(HttpStatusCode.PartialContent);
        (await partial.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken)).ShouldBe(bytes[..8]);
        partial.Headers.CacheControl?.NoStore.ShouldBeTrue();

        var download = await http.GetAsync($"/api/v1/files/{up.FileId}/download");
        download.StatusCode.ShouldBe(HttpStatusCode.OK);
        download.Content.Headers.ContentDisposition?.FileName.ShouldBe("bien-ban-kiem-tra.pdf");

        await api.Services.GetRequiredService<AccessEventQueue>().DrainAsync(TimeSpan.FromSeconds(10));
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.access_events WHERE object_id = $1 AND action = 'view'", up.FileId)).ShouldBe(1);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.access_events WHERE object_id = $1 AND action = 'download'", up.FileId)).ShouldBe(1);
    }

    [Fact]
    public async Task Bo_pdf_hoan_tac_trong_30_ngay_qua_han_thi_khong()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var up = await UploadAsync(http, "bo-va-hoan-tac");
        (await http.PostJsonAsync($"/api/v1/intake/documents/{up.DocumentId}/discard")).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await (await http.GetAsync("/api/v1/intake/inbox?status=discarded")).ReadAsync<PageDto<InboxDto>>()).Items.ShouldContain(i => i.DocumentId == up.DocumentId);
        (await (await http.GetAsync("/api/v1/intake/inbox")).ReadAsync<PageDto<InboxDto>>()).Items.ShouldNotContain(i => i.DocumentId == up.DocumentId);
        // BE-134: bỏ khỏi hộp thì hủy việc đọc còn chờ (không phí máy AI); hoàn tác thì xếp đọc lại ở khay nền.
        (await (await http.GetAsync($"/api/v1/jobs/{up.JobId}")).ReadAsync<JobDto>()).Status.ShouldBe("cancelled");
        (await http.PostJsonAsync($"/api/v1/intake/documents/{up.DocumentId}/restore")).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.ocr_jobs WHERE file_id = $1 AND status = 'queued' AND job_type = 'read_classify'", up.FileId))
            .ShouldBe(1, "hoàn tác thì có lại đúng một việc đọc đang chờ");

        // Đã đọc xong thì bỏ/hoàn tác không đọc lại.
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status = 'completed', started_at = now(), finished_at = now() WHERE file_id = $1 AND status = 'queued'", up.FileId);
        (await http.PostJsonAsync($"/api/v1/intake/documents/{up.DocumentId}/discard")).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await http.PostJsonAsync($"/api/v1/intake/documents/{up.DocumentId}/restore")).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.ocr_jobs WHERE file_id = $1", up.FileId)).ShouldBe(2, "không tạo thêm việc đọc khi đã đọc xong");

        (await http.PostJsonAsync($"/api/v1/intake/documents/{up.DocumentId}/discard")).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await api.ExecuteAsync("UPDATE hoso.documents SET discarded_at = now() - interval '31 days' WHERE id = $1", up.DocumentId);
        var late = await http.PostJsonAsync($"/api/v1/intake/documents/{up.DocumentId}/restore");
        late.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await late.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("30 ngày");
    }

    [Fact]
    public async Task Huy_viec_dang_cho_va_doc_lai_mot_trang()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var queued = await UploadAsync(http, "huy-viec");
        var cancelled = await (await http.PostJsonAsync($"/api/v1/jobs/{queued.JobId}/cancel")).ReadAsync<JobDto>();
        cancelled.Status.ShouldBe("cancelled");
        (await http.PostJsonAsync($"/api/v1/jobs/{queued.JobId}/cancel")).StatusCode.ShouldBe(HttpStatusCode.Conflict);

        var done = await UploadAsync(http, "doc-lai-trang");
        // Job còn đang chờ thì chỉ hủy được, chưa đọc lại trang được.
        (await http.PostJsonAsync($"/api/v1/jobs/{done.JobId}/pages/1/retry")).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        await WorkerRunAsync(done.JobId, complete: true);
        var retry = await (await http.PostJsonAsync($"/api/v1/jobs/{done.JobId}/pages/2/retry")).ReadAsync<JobDto>();
        retry.Status.ShouldBe("queued");
        (await api.ScalarAsync<string>("SELECT options::text FROM hoso.ocr_jobs WHERE id = $1", retry.Id))!.ShouldContain(done.JobId.ToString());
        (await http.PostJsonAsync($"/api/v1/jobs/{done.JobId}/pages/9/retry")).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Tu_PDF_den_ho_so_da_trinh_duyet_goi_y_AI_chi_la_goi_y_cho_toi_khi_nguoi_dung_xac_nhan()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var up = await UploadAsync(cv, "luong-day-du");

        // Đang đọc → hộp tiếp nhận hiện tiến độ.
        await WorkerRunAsync(up.JobId, complete: false);
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET processed_pages = 1 WHERE id = $1", up.JobId);
        var reading = (await (await cv.GetAsync("/api/v1/intake/inbox")).ReadAsync<PageDto<InboxDto>>()).Items.Single(i => i.DocumentId == up.DocumentId);
        (reading.Stage, reading.Progress).ShouldBe(("reading", "Đang đọc trang 2/2"));

        // Xong → có gợi ý, còn trường cần chú ý (địa điểm trống).
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status = 'queued', locked_by = NULL WHERE id = $1", up.JobId);
        await WorkerRunAsync(up.JobId, complete: true);
        var ready = (await (await cv.GetAsync("/api/v1/intake/inbox")).ReadAsync<PageDto<InboxDto>>()).Items.Single(i => i.DocumentId == up.DocumentId);
        ready.Stage.ShouldBe("ready");
        ready.Suggestion.ShouldBe("Biên bản · U15 Đất đai và hồ sơ địa chính");
        ready.AttentionCount.ShouldBe(1);

        var review = await (await cv.GetAsync($"/api/v1/documents/{up.DocumentId}/review")).ReadAsync<ReviewDto>();
        review.Suggestion!.DocumentTypeCode.ShouldBe("U15-D07");
        review.Document.Classification.ShouldBeNull("chưa ai xác nhận loại giấy tờ");
        review.Fields.Count.ShouldBe(6);
        review.Fields.Single(f => f.FieldCode == "U15-D07-F01").SuggestedValue.ShouldBe("12/BB-UBND");
        review.Fields.Single(f => f.FieldCode == "U15-D07-F01").Verified.ShouldBeFalse();
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.document_field_values WHERE document_id = $1", up.DocumentId)).ShouldBe(0, "gợi ý AI chưa vào bảng dữ liệu chính");

        // Chọn loại sai nhóm bị từ chối.
        (await cv.PutJsonAsync($"/api/v1/documents/{up.DocumentId}/classification", new { workGroupCode = "U15", documentTypeCode = "U11-D01" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        // Chấp nhận gợi ý: sao giá trị sang bảng chính nhưng vẫn chờ đối chiếu.
        var accepted = await (await cv.PutJsonAsync($"/api/v1/documents/{up.DocumentId}/classification", new { workGroupCode = "U15", documentTypeCode = "U15-D07" })).ReadAsync<ReviewDto>();
        accepted.Document.Classification!.DocumentTypeCode.ShouldBe("U15-D07");
        accepted.Suggestion!.Decision.ShouldBe("accepted");
        accepted.Document.Title.ShouldBe("Biên bản kiểm tra hiện trạng đất");
        accepted.Fields.Single(f => f.FieldCode == "U15-D07-F06").Value.ShouldBe("Nguyễn Văn An");
        accepted.Fields.ShouldAllBe(f => !f.Verified);
        (await api.ScalarAsync<string>("SELECT value_origin FROM hoso.document_field_values WHERE document_id = $1 AND field_definition_code = 'U15-D07-F06'", up.DocumentId)).ShouldBe("ocr");

        // Chưa đối chiếu hết thì chưa xác nhận được giấy tờ.
        var early = await cv.PostJsonAsync($"/api/v1/documents/{up.DocumentId}/verify");
        early.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await early.ProblemCodeAsync()).ShouldBe("review_incomplete");

        // Người dùng sửa địa điểm (AI để trống), xác nhận từng trường; trường sai mã bị từ chối.
        (await cv.PatchJsonAsync($"/api/v1/documents/{up.DocumentId}/fields", new { fields = new[] { new { fieldCode = "U15-D06-F01", value = "x", verify = true } } }))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var edited = await (await cv.PatchJsonAsync($"/api/v1/documents/{up.DocumentId}/fields", new
        {
            fields = new[]
            {
                new { fieldCode = "U15-D07-F01", value = "12/BB-UBND", verify = true },
                new { fieldCode = "U15-D07-F02", value = "20/01/2026", verify = true },
                new { fieldCode = "U15-D07-F03", value = "Xóm 3, thôn Hạ", verify = true },
                new { fieldCode = "U15-D07-F04", value = "", verify = true },    // để trống có chủ ý: không suy đoán
                new { fieldCode = "U15-D07-F05", value = "Đúng hiện trạng", verify = true },
                new { fieldCode = "U15-D07-F06", value = "Nguyễn Văn An", verify = true },
            },
        })).ReadAsync<ReviewDto>();
        edited.Fields.ShouldAllBe(f => f.Verified);
        (await api.ScalarAsync<string>("SELECT value_origin FROM hoso.document_field_values WHERE document_id = $1 AND field_definition_code = 'U15-D07-F03'", up.DocumentId)).ShouldBe("manual");
        (await api.ScalarAsync<string>("SELECT value_normalized FROM hoso.document_field_values WHERE document_id = $1 AND field_definition_code = 'U15-D07-F02'", up.DocumentId)).ShouldBe("2026-01-20");
        (await api.ScalarAsync<string>("SELECT value_origin FROM hoso.document_field_values WHERE document_id = $1 AND field_definition_code = 'U15-D07-F06'", up.DocumentId)).ShouldBe("ocr", "giữ nguyên gợi ý của AI thì vẫn ghi nguồn là OCR");

        var verified = await (await cv.PostJsonAsync($"/api/v1/documents/{up.DocumentId}/verify")).ReadAsync<ReviewDto>();
        verified.Document.ReviewStatus.ShouldBe("verified");

        // Xếp vào hồ sơ, trình trưởng phòng, duyệt.
        var dossier = await (await cv.PostJsonAsync("/api/v1/dossiers", new { title = "Hồ sơ kiểm tra hiện trạng đất thôn Hạ", workGroupCode = "U15" })).ReadAsync<DossierDetailDto>();
        (await cv.PostJsonAsync($"/api/v1/dossiers/{dossier.Id}/documents", new { documentId = up.DocumentId, direction = "internal" })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await api.ScalarAsync<string>("SELECT intake_status FROM hoso.documents WHERE id = $1", up.DocumentId)).ShouldBe("filed");
        (await (await cv.GetAsync("/api/v1/intake/inbox")).ReadAsync<PageDto<InboxDto>>()).Items.ShouldNotContain(i => i.DocumentId == up.DocumentId);

        var submitted = await (await cv.PostJsonAsync($"/api/v1/dossiers/{dossier.Id}/transitions", new { action = "submit" })).ReadAsync<TransitionDto>();
        submitted.Status.ShouldBe("department_review");

        // Hồ sơ đã trình: không sửa trường được nữa, và có nói lý do.
        var locked = await (await cv.GetAsync($"/api/v1/documents/{up.DocumentId}/review")).ReadAsync<ReviewDto>();
        (locked.CanEdit, locked.LockedReason).ShouldSatisfyAllConditions(x => x.CanEdit.ShouldBeFalse(), x => x.LockedReason.ShouldNotBeNull().ShouldContain("chờ xử lý"));
        (await cv.PatchJsonAsync($"/api/v1/documents/{up.DocumentId}/fields", new { fields = new[] { new { fieldCode = "U15-D07-F03", value = "Sửa lén", verify = true } } }))
            .StatusCode.ShouldBe(HttpStatusCode.Conflict);

        // Trưởng phòng thấy giấy tờ qua hồ sơ nhưng không có quyền sửa.
        var manager = await api.LoginAsync("demo_head_ht");
        (await manager.GetAsync($"/api/v1/documents/{up.DocumentId}")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await manager.PatchJsonAsync($"/api/v1/documents/{up.DocumentId}/fields", new { fields = new[] { new { fieldCode = "U15-D07-F03", value = "x", verify = true } } }))
            .StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await (await manager.PostJsonAsync($"/api/v1/dossiers/{dossier.Id}/transitions", new { action = "accept" })).ReadAsync<TransitionDto>()).Status.ShouldBe("ready_archive");
    }
}
