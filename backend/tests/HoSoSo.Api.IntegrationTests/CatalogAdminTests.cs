using System.Net;
using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-32, BE-35: sửa danh mục, ngừng dùng thay cho xóa, thời hạn bảo quản có căn cứ.</summary>
public sealed class CatalogAdminTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record Group(string Code, string Title, bool Active, int DocumentTypeCount);
    private sealed record Field(string Code, string Label, int Position, bool IsKeyField);
    private sealed record DocType(string Code, string Name, bool Active, List<Field> Fields);
    private sealed record Rule(Guid Id, string WorkGroupCode, string Status, string? LegalReference);

    private static object NewGroup(string code) => new { code, organizationCode = "tl-ubnd", departmentCode = "ht", title = $"Nhóm thử {code}", responsibility = "Phòng Hạ tầng", filingRule = "Theo vụ việc", businessFields = "Thử nghiệm" };

    [Fact]
    public async Task Them_nhom_loai_giay_to_va_truong_ma_tu_cap_va_chan_du_lieu_sai()
    {
        var admin = await api.LoginAsync("demo_admin");
        var created = await (await admin.PostJsonAsync("/api/v1/admin/catalog/work-groups", NewGroup("U90"))).ReadAsync<Group>();
        (created.Code, created.Active, created.DocumentTypeCount).ShouldBe(("U90", true, 0));
        var duplicate = await admin.PostJsonAsync("/api/v1/admin/catalog/work-groups", NewGroup("U90"));
        duplicate.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await duplicate.ProblemCodeAsync()).ShouldBe("duplicate_value");
        (await admin.PostJsonAsync("/api/v1/admin/catalog/work-groups", NewGroup("ma-sai!"))).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var wrong = await admin.PostJsonAsync("/api/v1/admin/catalog/work-groups", new { code = "U91", organizationCode = "tl-hdnd", departmentCode = "ht", title = "Sai cặp cơ quan-đơn vị", responsibility = "", filingRule = "", businessFields = "" });
        wrong.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);   // Phòng Hạ tầng không thuộc HĐND

        var first = await (await admin.PostJsonAsync("/api/v1/admin/catalog/document-types", new { workGroupCode = "U90", name = "Quyết định thử nghiệm", documentForm = "Quyết định", requiredInDossier = true, minCount = 1 })).ReadAsync<DocType>();
        var second = await (await admin.PostJsonAsync("/api/v1/admin/catalog/document-types", new { workGroupCode = "U90", name = "Biên bản thử nghiệm" })).ReadAsync<DocType>();
        (first.Code, second.Code).ShouldBe(("U90-D01", "U90-D02"));

        var f1 = await (await admin.PostJsonAsync("/api/v1/admin/catalog/field-definitions", new { documentTypeCode = first.Code, label = "Số/ký hiệu", isKeyField = true, validationPattern = @"^\d+/[A-Z\-]+$" })).ReadAsync<Field>();
        var f2 = await (await admin.PostJsonAsync("/api/v1/admin/catalog/field-definitions", new { documentTypeCode = first.Code, label = "Ngày ban hành", valueType = "date" })).ReadAsync<Field>();
        (f1.Code, f1.Position, f2.Code, f2.Position).ShouldBe(("U90-D01-F01", 1, "U90-D01-F02", 2));
        (await admin.PostJsonAsync("/api/v1/admin/catalog/field-definitions", new { documentTypeCode = first.Code, label = "Hỏng", validationPattern = "([" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await admin.PostJsonAsync("/api/v1/admin/catalog/field-definitions", new { documentTypeCode = first.Code, label = "Sai kiểu", valueType = "uuid" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await admin.PostJsonAsync("/api/v1/admin/catalog/field-definitions", new { documentTypeCode = "KHONG-CO", label = "x" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var patched = await (await admin.PatchJsonAsync($"/api/v1/admin/catalog/field-definitions/{f1.Code}", new { label = "Số, ký hiệu văn bản", isKeyField = false })).ReadAsync<Field>();
        (patched.Label, patched.IsKeyField).ShouldBe(("Số, ký hiệu văn bản", false));
        (await admin.PatchJsonAsync("/api/v1/admin/catalog/work-groups/U90", new { verificationStatus = "confirmed", title = "Nhóm thử đã xác nhận" })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.PatchJsonAsync("/api/v1/admin/catalog/work-groups/U90", new { verificationStatus = "da-duyet" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.audit_events WHERE table_name IN ('work_groups','document_types','field_definitions') AND actor_subject = $1", (await api.UserIdAsync("demo_admin")).ToString())).ShouldBeGreaterThanOrEqualTo(8);

        // Người không có quyền quản lý danh mục.
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        (await clerk.PostJsonAsync("/api/v1/admin/catalog/work-groups", NewGroup("U92"))).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await clerk.DeleteAsync("/api/v1/admin/catalog/work-groups/U90", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Muc_dang_dung_khong_xoa_duoc_va_ngung_dung_thi_an_khoi_lua_chon_nhung_giu_du_lieu()
    {
        var admin = await api.LoginAsync("demo_admin");
        var inUse = await admin.DeleteAsync("/api/v1/admin/catalog/work-groups/U15", TestContext.Current.CancellationToken);
        inUse.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await inUse.ProblemCodeAsync()).ShouldBe("in_use");
        (await inUse.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("ngừng dùng");

        // Loại giấy tờ đã có giấy tờ phân loại.
        var cv = await api.LoginAsync("demo_cv_ht");
        var form = new MultipartFormDataContent();
        var content = new ByteArrayContent("%PDF-1.4\n% danh-muc\n%%EOF\n"u8.ToArray());
        content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/pdf");
        form.Add(content, "file", "dm.pdf");
        var up = await (await cv.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();
        (await cv.PutJsonAsync($"/api/v1/documents/{up.DocumentId}/classification", new { workGroupCode = "U15", documentTypeCode = "U15-D07" })).StatusCode.ShouldBe(HttpStatusCode.OK);
        var typeInUse = await admin.DeleteAsync("/api/v1/admin/catalog/document-types/U15-D07", TestContext.Current.CancellationToken);
        typeInUse.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await admin.DeleteAsync("/api/v1/admin/catalog/field-definitions/U15-D07-F01", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NoContent, "trường chưa có giá trị nào thì xóa được");

        // Ngừng dùng: người dùng thường không còn thấy, quản lý danh mục vẫn thấy; không phân loại thêm vào loại đã ngừng dùng.
        (await admin.PatchJsonAsync("/api/v1/admin/catalog/document-types/U15-D07", new { active = false })).StatusCode.ShouldBe(HttpStatusCode.OK);
        var normal = await (await cv.GetAsync("/api/v1/catalog/work-groups/U15/document-types")).ReadAsync<List<DocType>>();
        normal.ShouldNotContain(t => t.Code == "U15-D07");
        (await (await admin.GetAsync("/api/v1/catalog/work-groups/U15/document-types")).ReadAsync<List<DocType>>()).ShouldContain(t => t.Code == "U15-D07" && !t.Active);
        var second = await UploadAsync(cv, "dm2");
        (await cv.PutJsonAsync($"/api/v1/documents/{second.DocumentId}/classification", new { workGroupCode = "U15", documentTypeCode = "U15-D07" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        // Giấy tờ đã phân loại trước đó vẫn giữ nguyên.
        (await api.ScalarAsync<string>("SELECT document_type_code FROM hoso.document_classifications WHERE document_id = $1", up.DocumentId)).ShouldBe("U15-D07");

        // Nhóm ngừng dùng ẩn khỏi danh sách của người thường.
        await admin.PostJsonAsync("/api/v1/admin/catalog/work-groups", NewGroup("U93"));
        await admin.PatchJsonAsync("/api/v1/admin/catalog/work-groups/U93", new { active = false });
        (await (await cv.GetAsync("/api/v1/catalog/work-groups")).ReadAsync<List<Group>>()).ShouldNotContain(g => g.Code == "U93");
        (await (await admin.GetAsync("/api/v1/catalog/work-groups")).ReadAsync<List<Group>>()).ShouldContain(g => g.Code == "U93" && !g.Active);
        (await admin.DeleteAsync("/api/v1/admin/catalog/work-groups/U93", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    private static async Task<UploadDto> UploadAsync(HttpClient http, string marker)
    {
        var form = new MultipartFormDataContent();
        var content = new ByteArrayContent(System.Text.Encoding.ASCII.GetBytes($"%PDF-1.4\n% {marker}\n%%EOF\n"));
        content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/pdf");
        form.Add(content, "file", $"{marker}.pdf");
        return await (await http.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();
    }

    [Fact]
    public async Task Thoi_han_bao_quan_chi_co_hieu_luc_khi_xac_nhan_kem_can_cu_phap_ly()
    {
        var admin = await api.LoginAsync("demo_admin");
        var proposal = await (await admin.PostJsonAsync("/api/v1/admin/catalog/retention-rules", new { workGroupCode = "U15", retentionLabel = "Vĩnh viễn", retentionYears = (int?)null })).ReadAsync<Rule>();
        proposal.Status.ShouldBe("proposed");
        (await admin.PostJsonAsync("/api/v1/admin/catalog/retention-rules", new { workGroupCode = "U15", documentTypeCode = "U11-D01", retentionLabel = "10 năm" })).StatusCode.ShouldBeOneOf([HttpStatusCode.UnprocessableEntity, HttpStatusCode.BadRequest]);   // loại không thuộc nhóm
        (await admin.PostJsonAsync("/api/v1/admin/catalog/retention-rules", new { workGroupCode = "U15", retentionLabel = "" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var noBasis = await admin.PostJsonAsync($"/api/v1/admin/catalog/retention-rules/{proposal.Id}/confirm", new { legalReference = "" });
        noBasis.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await noBasis.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("căn cứ pháp lý");
        (await admin.PostJsonAsync($"/api/v1/admin/catalog/retention-rules/{proposal.Id}/confirm", new { legalReference = "x" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await api.ScalarAsync<string>("SELECT status FROM hoso.retention_rules WHERE id = $1", proposal.Id)).ShouldBe("proposed");

        var confirmed = await (await admin.PostJsonAsync($"/api/v1/admin/catalog/retention-rules/{proposal.Id}/confirm", new { legalReference = "Điều 15 Luật Lưu trữ 2024; Thông tư 12/2024/TT-BNV" })).ReadAsync<Rule>();
        (confirmed.Status, confirmed.LegalReference).ShouldBe(("confirmed", "Điều 15 Luật Lưu trữ 2024; Thông tư 12/2024/TT-BNV"));
        (await admin.PostJsonAsync($"/api/v1/admin/catalog/retention-rules/{proposal.Id}/confirm", new { legalReference = "Căn cứ khác" })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await admin.DeleteAsync($"/api/v1/admin/catalog/retention-rules/{proposal.Id}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Conflict);

        var other = await (await admin.PostJsonAsync("/api/v1/admin/catalog/retention-rules", new { workGroupCode = "U15", retentionLabel = "5 năm" })).ReadAsync<Rule>();
        (await admin.DeleteAsync($"/api/v1/admin/catalog/retention-rules/{other.Id}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await (await admin.GetAsync("/api/v1/admin/catalog/retention-rules?workGroup=U15")).ReadAsync<List<Rule>>()).Single().Id.ShouldBe(proposal.Id);

        // Bảng chặn việc xác nhận thiếu căn cứ ngay cả khi bỏ qua API.
        var direct = await Should.ThrowAsync<Npgsql.PostgresException>(async () => await api.ExecuteAsync(
            "UPDATE hoso.retention_rules SET status='confirmed', confirmed_by=$2, confirmed_at=now() WHERE id=$1", other.Id == proposal.Id ? Guid.NewGuid() : (await api.ScalarAsync<Guid>("INSERT INTO hoso.retention_rules(work_group_code, retention_label) VALUES ('U15','x') RETURNING id")), await api.UserIdAsync("demo_admin")));
        direct.SqlState.ShouldBe("23514");
        var cv = await api.LoginAsync("demo_cv_ht");
        (await cv.GetAsync("/api/v1/admin/catalog/retention-rules")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }
}
