using System.Net;
using System.Net.Http.Headers;
using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-114 (vùng nguồn), BE-116 (tên người xác nhận đầu văn bản), BE-119 (trường đã đối chiếu cho người chỉ xem).</summary>
public sealed class ReviewReadModelTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record Region(int Page, double X, double Y, double Width, double Height, bool Approximate);
    private sealed record FieldRow(string FieldCode, string Label, string? SuggestedValue, string? Value, bool Verified, Region? SourceRegion, decimal? Confidence);
    private sealed record DetailRow(Guid Id, uint Version, string? MetadataReviewedByName, Guid? MetadataReviewedBy, DateTimeOffset? MetadataReviewedAt);
    private sealed record ReviewRow(DetailRow Document, List<FieldRow> Fields);
    private sealed record ViewField(string FieldCode, string Label, string? Value, bool Verified, string Origin, bool EditedFromAi, string? VerifiedByName, int? SourcePage, Region? SourceRegion);
    private sealed record FieldsRow(Guid DocumentId, ClassificationDto? Classification, string ReviewStatus, List<ViewField> Fields);

    private static byte[] UniquePdf(string marker) => System.Text.Encoding.ASCII.GetBytes(
        $"%PDF-1.4\n% {marker}\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

    /// <summary>Tải PDF, rồi mô phỏng worker ghi gợi ý có vùng nguồn (cùng câu lệnh với ai-worker/src/hoso_ai/queue/postgres.py).</summary>
    private async Task<(HttpClient Cv, UploadDto Up)> UploadWithSuggestionAsync(string marker)
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(UniquePdf(marker));
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", "bien-ban.pdf");
        var up = await (await cv.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();

        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='running', locked_by='test-worker', attempt=attempt+1, started_at=now(), heartbeat_at=now(), stage='ocr', page_count=2 WHERE id=$1", up.JobId);
        await api.ExecuteAsync("INSERT INTO hoso.ocr_pages(job_id, page_no, method, text, status) VALUES ($1,1,'ocr','Biên bản kiểm tra hiện trạng đất. Số 12/BB-UBND','completed'), ($1,2,'ocr','Người ký: Nguyễn Văn An','completed')", up.JobId);
        var suggestionId = await api.ScalarAsync<long>(
            "INSERT INTO hoso.ai_suggestions(job_id, document_id, work_group_code, document_type_code, document_form, title, reason, quote, evidence_verified, model_key) " +
            "VALUES ($1,$2,'U15','U15-D07','Biên bản','Biên bản kiểm tra hiện trạng đất','Tiêu đề nêu rõ','Biên bản kiểm tra hiện trạng đất', true, 'classifier') RETURNING id", up.JobId, up.DocumentId);
        await api.ExecuteAsync(
            "INSERT INTO hoso.ai_field_suggestions(suggestion_id, field_definition_code, value, quote, source_pages, source_region, quote_verified, confidence) VALUES " +
            "($1,'U15-D07-F01','12/BB-UBND','Số 12/BB-UBND','{1}','{\"page\":1,\"x\":0.07,\"y\":0.12,\"width\":0.38,\"height\":0.025}',true,0.9600), " +
            "($1,'U15-D07-F06','Nguyễn Văn An','Người ký: Nguyễn Văn An','{2}','{\"page\":2,\"x\":0.58,\"y\":0.84,\"width\":0.6,\"height\":0.5,\"approximate\":true}',true,0.8200), " +   // vượt mép trang → cắt về mép
            "($1,'U15-D07-F02','20/01/2026','ngày 20 tháng 01 năm 2026','{1}','{\"page\":0,\"x\":0.1}',true,NULL), " +                                               // sai hình dạng → bỏ vùng, giữ trường
            "($1,'U15-D07-F03','','','{}',NULL,false,NULL)", suggestionId);
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='completed', finished_at=now(), locked_by=NULL, stage='done', processed_pages=2 WHERE id=$1", up.JobId);
        return (cv, up);
    }

    [Fact]
    public async Task BE114_review_tra_vung_nguon_va_do_tin_cay_va_vung_di_theo_gia_tri_khi_chap_nhan_goi_y()
    {
        var (cv, up) = await UploadWithSuggestionAsync("be114");

        var review = await (await cv.GetAsync($"/api/v1/documents/{up.DocumentId}/review", TestContext.Current.CancellationToken)).ReadAsync<ReviewRow>();
        var number = review.Fields.Single(f => f.FieldCode == "U15-D07-F01");
        number.SourceRegion.ShouldBe(new Region(1, 0.07, 0.12, 0.38, 0.025, false));
        number.Confidence.ShouldBe(0.96m);

        var signer = review.Fields.Single(f => f.FieldCode == "U15-D07-F06");
        signer.SourceRegion.ShouldBe(new Region(2, 0.58, 0.84, 0.42, 0.16, true), "khung vượt mép trang bị cắt về mép, giữ cờ ước");

        var broken = review.Fields.Single(f => f.FieldCode == "U15-D07-F02");
        broken.SuggestedValue.ShouldBe("20/01/2026", "vùng sai hình dạng không làm mất giá trị");
        broken.SourceRegion.ShouldBeNull();
        broken.Confidence.ShouldBeNull();
        review.Fields.Single(f => f.FieldCode == "U15-D07-F03").SourceRegion.ShouldBeNull("trường AI để trống thì không có vùng");

        // Chấp nhận gợi ý: vùng sao sang bảng chính và vẫn trả ra sau khi có giá trị lưu.
        var accepted = await (await cv.PutJsonAsync($"/api/v1/documents/{up.DocumentId}/classification", new { workGroupCode = "U15", documentTypeCode = "U15-D07" })).ReadAsync<ReviewRow>();
        (await api.ScalarAsync<string>("SELECT source_region->>'x' FROM hoso.document_field_values WHERE document_id = $1 AND field_definition_code = 'U15-D07-F01'", up.DocumentId)).ShouldBe("0.07");
        accepted.Fields.Single(f => f.FieldCode == "U15-D07-F01").SourceRegion.ShouldBe(number.SourceRegion);
    }

    [Fact]
    public async Task BE116_chi_tiet_giay_to_tra_ten_nguoi_xac_nhan_dau_van_ban()
    {
        var (cv, up) = await UploadWithSuggestionAsync("be116");
        var before = await (await cv.GetAsync($"/api/v1/documents/{up.DocumentId}", TestContext.Current.CancellationToken)).ReadAsync<DetailRow>();
        before.MetadataReviewedByName.ShouldBeNull("chưa ai xác nhận");

        (await cv.PutJsonAsync($"/api/v1/documents/{up.DocumentId}/metadata", new { version = before.Version, title = "Biên bản kiểm tra hiện trạng đất", documentForm = "Biên bản", documentNumber = "12/BB-UBND", issuedOn = "2026-01-20", note = "" }))
            .StatusCode.ShouldBe(HttpStatusCode.OK);

        var after = await (await cv.GetAsync($"/api/v1/documents/{up.DocumentId}", TestContext.Current.CancellationToken)).ReadAsync<DetailRow>();
        var expected = await api.ScalarAsync<string>("SELECT display_name FROM hoso.users WHERE username = 'demo_cv_ht'");
        after.MetadataReviewedByName.ShouldBe(expected);
        after.MetadataReviewedBy.ShouldBe(await api.UserIdAsync("demo_cv_ht"));
        after.MetadataReviewedAt.ShouldNotBeNull();

        var review = await (await cv.GetAsync($"/api/v1/documents/{up.DocumentId}/review", TestContext.Current.CancellationToken)).ReadAsync<ReviewRow>();
        review.Document.MetadataReviewedByName.ShouldBe(expected, "màn đối chiếu cũng nhận tên");
    }

    [Fact]
    public async Task BE119_nguoi_chi_xem_doc_duoc_truong_da_doi_chieu_kem_co_da_sua_so_voi_AI_va_khong_lo_goi_y()
    {
        var (cv, up) = await UploadWithSuggestionAsync("be119");
        (await cv.PutJsonAsync($"/api/v1/documents/{up.DocumentId}/classification", new { workGroupCode = "U15", documentTypeCode = "U15-D07" })).StatusCode.ShouldBe(HttpStatusCode.OK);

        // Chưa xếp vào hồ sơ nào: trưởng phòng chưa thấy giấy tờ → 404 (cùng quy tắc phạm vi với chi tiết giấy tờ).
        var manager = await api.LoginAsync("demo_head_ht");
        (await manager.GetAsync($"/api/v1/documents/{up.DocumentId}/fields", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        // Người nhập sửa tên người ký, giữ số ký hiệu của AI, tự thêm địa điểm, rồi xác nhận từng trường.
        (await cv.PatchJsonAsync($"/api/v1/documents/{up.DocumentId}/fields", new
        {
            fields = new[]
            {
                new { fieldCode = "U15-D07-F01", value = "12/BB-UBND", verify = true },
                new { fieldCode = "U15-D07-F06", value = "Nguyễn Văn Bình", verify = true },
                new { fieldCode = "U15-D07-F03", value = "Xóm 3, thôn Hạ", verify = false },
            },
        })).StatusCode.ShouldBe(HttpStatusCode.OK);

        var dossier = await (await cv.PostJsonAsync("/api/v1/dossiers", new { title = "Hồ sơ BE-119", workGroupCode = "U15" })).ReadAsync<DossierDetailDto>();
        (await cv.PostJsonAsync($"/api/v1/dossiers/{dossier.Id}/documents", new { documentId = up.DocumentId, direction = "internal" })).StatusCode.ShouldBe(HttpStatusCode.OK);

        var response = await manager.GetAsync($"/api/v1/documents/{up.DocumentId}/fields", TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, "trưởng phòng chỉ có document.view vẫn đọc được trường");
        var data = await response.ReadAsync<FieldsRow>();
        data.Classification!.DocumentTypeCode.ShouldBe("U15-D07");
        data.Fields.Count.ShouldBe(6, "đủ trường của loại đã xác nhận, kể cả trường chưa có giá trị");

        var number = data.Fields.Single(f => f.FieldCode == "U15-D07-F01");
        (number.Value, number.Verified, number.Origin, number.EditedFromAi).ShouldBe(("12/BB-UBND", true, "ocr", false));
        number.VerifiedByName.ShouldBe(await api.ScalarAsync<string>("SELECT display_name FROM hoso.users WHERE username = 'demo_cv_ht'"));
        number.SourceRegion.ShouldNotBeNull().Page.ShouldBe(1);

        var signer = data.Fields.Single(f => f.FieldCode == "U15-D07-F06");
        (signer.Value, signer.Origin, signer.EditedFromAi).ShouldBe(("Nguyễn Văn Bình", "manual", true));

        var place = data.Fields.Single(f => f.FieldCode == "U15-D07-F03");
        (place.Value, place.Verified, place.EditedFromAi).ShouldBe(("Xóm 3, thôn Hạ", false, false));

        data.Fields.Single(f => f.FieldCode == "U15-D07-F04").Origin.ShouldBe("none");

        // Không lộ giá trị AI gợi ý hay trích dẫn thô cho người chỉ xem.
        var raw = await (await manager.GetAsync($"/api/v1/documents/{up.DocumentId}/fields", TestContext.Current.CancellationToken)).Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.ShouldNotContain("suggestedValue");
        raw.ShouldNotContain("Nguyễn Văn An", Case.Sensitive);
        raw.ShouldNotContain("Người ký: ");

        // Phòng khác không thấy giấy tờ; quản trị kỹ thuật không có document.view.
        (await (await api.LoginAsync("demo_head_kt")).GetAsync($"/api/v1/documents/{up.DocumentId}/fields", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await (await api.LoginAsync("demo_admin")).GetAsync($"/api/v1/documents/{up.DocumentId}/fields", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        // Mỗi lần xem ghi một dòng nhật ký truy cập.
        var viewed = await Eventually.ForAsync(
            () => api.ScalarAsync<long>("SELECT count(*) FROM hoso.access_events e JOIN hoso.users u ON u.id = e.user_id WHERE e.object_id = $1 AND e.action = 'view' AND e.object_type = 'document' AND u.username = 'demo_head_ht'", up.DocumentId),
            n => n >= 2, TimeSpan.FromSeconds(10));
        viewed.ShouldBe(2, "hai lần trưởng phòng gọi /fields thành công (lần trước khi có hồ sơ bị 404 không tính)");
    }
}
