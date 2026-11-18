using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>DB-14, AI-10: <c>v_ai_accuracy</c> so giá trị AI gợi ý với giá trị cán bộ đã chốt (accepted, edited, cleared, missed).</summary>
public sealed class AiAccuracyViewTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record Row(long Suggested, long Accepted, long Edited, long Cleared, long Missed);

    private async Task<Row> ReadAsync(string field)
    {
        var text = await api.ScalarAsync<string>(
            "SELECT suggested || '|' || accepted || '|' || edited || '|' || cleared || '|' || missed FROM hoso.v_ai_accuracy " +
            "WHERE model_key = 'fake' AND document_type_code = 'U15-D07' AND field_definition_code = $1", field);
        if (text is null) return new Row(0, 0, 0, 0, 0);
        var n = text.Split('|').Select(long.Parse).ToArray();
        return new Row(n[0], n[1], n[2], n[3], n[4]);
    }

    [Fact]
    public async Task Chia_dung_bon_nhom_va_bo_qua_truong_khong_ai_xac_nhan_hay_ca_hai_de_trong()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var upload = await AiExtractTests.UploadAsync(cv, "ai-accuracy");
        var reviewer = await api.UserIdAsync("demo_cv_ht");
        var before = new Dictionary<string, Row>();
        foreach (var f in new[] { "F01", "F02", "F03", "F04", "F05", "F06" }) before[f] = await ReadAsync($"U15-D07-{f}");

        var suggestionId = await api.ScalarAsync<long>(
            "INSERT INTO hoso.ai_suggestions(job_id, document_id, work_group_code, document_type_code, document_form, title, model_key) VALUES ($1,$2,'U15','U15-D07','Biên bản','x','fake') RETURNING id",
            upload.JobId, upload.DocumentId);
        // Giấy tờ phải đã được gán loại thì mới có giá trị trường (trigger guard_field_definition).
        await api.ExecuteAsync("INSERT INTO hoso.document_classifications(document_id, work_group_code, document_type_code, classification_status, basis) VALUES ($1, 'U15', 'U15-D07', 'confirmed', 'test')", upload.DocumentId);
        // AI gợi ý: F01 đúng, F02 sai chữ, F03 bịa, F04 để trống (bỏ sót), F05 để trống (người cũng để trống), F06 đúng nhưng chưa ai xác nhận.
        await api.ExecuteAsync(
            "INSERT INTO hoso.ai_field_suggestions(suggestion_id, field_definition_code, value, quote, source_pages, quote_verified) VALUES " +
            "($1,'U15-D07-F01','12/BB-UBND','x','{1}',true), ($1,'U15-D07-F02','Nguyễn Văn An','x','{1}',true), ($1,'U15-D07-F03','Giá trị bịa','x','{1}',true)," +
            "($1,'U15-D07-F04','','',  '{}', false), ($1,'U15-D07-F05','','','{}',false), ($1,'U15-D07-F06','Giá trị chưa xác nhận','x','{1}',true)", suggestionId);
        await api.ExecuteAsync(
            "INSERT INTO hoso.document_field_values(document_id, field_definition_code, value_text, value_origin, needs_review, verified_by, verified_at, ai_field_suggestion_id) " +
            "SELECT $1, f.field_definition_code, v.final, 'ocr', NOT v.verified, CASE WHEN v.verified THEN $3::uuid END, CASE WHEN v.verified THEN now() END, f.id " +
            "FROM hoso.ai_field_suggestions f JOIN (VALUES " +
            "('U15-D07-F01', '12/BB-UBND', true), ('U15-D07-F02', 'Nguyễn Văn Ân', true), ('U15-D07-F03', NULL, true), ('U15-D07-F04', 'Điền thêm', true), ('U15-D07-F05', NULL, true), ('U15-D07-F06', 'Giá trị chưa xác nhận', false)" +
            ") AS v(code, final, verified) ON v.code = f.field_definition_code WHERE f.suggestion_id = $2",
            upload.DocumentId, suggestionId, reviewer);

        async Task<Row> Delta(string f)
        {
            var now = await ReadAsync($"U15-D07-{f}");
            var was = before[f];
            return new Row(now.Suggested - was.Suggested, now.Accepted - was.Accepted, now.Edited - was.Edited, now.Cleared - was.Cleared, now.Missed - was.Missed);
        }
        (await Delta("F01")).ShouldBe(new Row(1, 1, 0, 0, 0));
        (await Delta("F02")).ShouldBe(new Row(1, 0, 1, 0, 0), "AI có giá trị, người sửa chữ");
        (await Delta("F03")).ShouldBe(new Row(1, 0, 0, 1, 0), "AI có giá trị, người xóa trống");
        (await Delta("F04")).ShouldBe(new Row(0, 0, 0, 0, 1), "AI bỏ sót, người điền");
        (await Delta("F05")).ShouldBe(new Row(0, 0, 0, 0, 0), "cả hai để trống: không tính");
        (await Delta("F06")).ShouldBe(new Row(0, 0, 0, 0, 0), "chưa ai xác nhận: không tính");

        // Khoảng trắng thừa không làm giá trị khác đi.
        await api.ExecuteAsync("UPDATE hoso.document_field_values SET value_text = '  12/BB-UBND  ' WHERE document_id = $1 AND field_definition_code = 'U15-D07-F01'", upload.DocumentId);
        (await Delta("F01")).Accepted.ShouldBe(1);
    }

    [Fact]
    public async Task Ty_le_chap_nhan_tinh_ca_truong_bi_bo_sot_va_nguoi_dung_co_quyen_doc_view()
    {
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.v_ai_accuracy WHERE accepted_rate < 0 OR accepted_rate > 1")).ShouldBe(0, "tỉ lệ nằm trong 0..1");
        (await api.ScalarAsync<bool>("SELECT has_table_privilege('hoso_api', 'hoso.v_ai_accuracy', 'SELECT')")).ShouldBeTrue();
        (await api.ScalarAsync<bool>("SELECT has_table_privilege('hoso_readonly', 'hoso.v_ai_accuracy', 'SELECT')")).ShouldBeTrue();
    }
}
