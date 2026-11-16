using System.Net;
using System.Net.Http.Headers;
using System.Text;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Infrastructure.Messaging;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-87: đề nghị hủy → phê duyệt kèm văn bản quyết định → thực hiện. Đường duy nhất xóa nội dung tệp.</summary>
public sealed class DisposalTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record Disposal(Guid Id, Guid DossierId, string DossierCode, string Status, string RetentionLabel, short? RetentionYears, string RequestedByName,
        string? DecidedByName, Guid? DecisionDocumentId, string DecisionNote, string? ExecutedByName, DateTimeOffset? ExecutedAt);
    private sealed record Result(Disposal Disposal, int FilesDisposed, int BlobsDeleted, int DocumentsKept);
    private sealed record Eligible(Guid DossierId, string Code, short RetentionYears);
    private sealed record Loan(Guid Id, string Status);
    private sealed record Notification(string Kind, Guid? DossierId);
    private sealed record Notifications(List<Notification> Items);
    private sealed record History(string Action, string Note);

    private static readonly string Tag = Guid.NewGuid().ToString("N")[..6];

    private async Task<(Guid DocumentId, Guid FileId, string Key)> UploadAsync(HttpClient http, string name)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(Encoding.ASCII.GetBytes($"%PDF-1.4\n% {name} {Guid.NewGuid():N}\ntrailer<<>>\n%%EOF\n"));
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", $"{name}.pdf");
        var up = await (await http.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();
        return (up.DocumentId, up.FileId, (await api.ScalarAsync<string>("SELECT storage_key FROM hoso.files WHERE id = $1", up.FileId))!);
    }

    /// <summary>Hồ sơ đã đi hết quy trình tới "đã lưu trữ", có hai giấy tờ nội bộ riêng, một giấy tờ dùng chung với hồ sơ khác và một giấy tờ công khai.</summary>
    private async Task<Setup> ArchivedAsync(string title, int archivedYearsAgo = 12)
    {
        const string group = "U15";
        var cv = await api.LoginAsync("demo_cv_ht");
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var dossier = await (await cv.PostJsonAsync("/api/v1/dossiers", new { title, workGroupCode = group })).ReadAsync<DossierDetailDto>();
        var a = await UploadAsync(cv, "don-de-nghi");
        var b = await UploadAsync(cv, "giay-phep");
        var shared = await UploadAsync(cv, "dung-chung");
        foreach (var doc in new[] { a.DocumentId, b.DocumentId, shared.DocumentId })
            (await cv.PostJsonAsync($"/api/v1/dossiers/{dossier.Id}/documents", new { documentId = doc })).StatusCode.ShouldBe(HttpStatusCode.OK);
        var publicDoc = await api.ScalarAsync<Guid>("SELECT id FROM hoso.documents WHERE external_key = 'public-003'");
        await cv.PostJsonAsync($"/api/v1/dossiers/{dossier.Id}/documents", new { documentId = publicDoc });
        var other = await (await cv.PostJsonAsync("/api/v1/dossiers", new { title = title + " (hồ sơ khác dùng chung)", workGroupCode = group })).ReadAsync<DossierDetailDto>();
        await api.ExecuteAsync("INSERT INTO hoso.dossier_documents(dossier_id, document_id, position, relation_kind) VALUES ($1, $2, 1, 'reference')", other.Id, shared.DocumentId);

        var reviewer = await api.UserIdAsync("demo_cv_ht");
        foreach (var doc in new[] { a.DocumentId, b.DocumentId, shared.DocumentId, publicDoc })   // trình hồ sơ cần mọi thành phần đã đối chiếu
            await api.ExecuteAsync("UPDATE hoso.documents SET data_review_status = 'verified', reviewed_by = $1, reviewed_at = now() WHERE id = $2", reviewer, doc);
        (await cv.PostJsonAsync($"/api/v1/dossiers/{dossier.Id}/transitions", new { action = "submit" })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await (await api.LoginAsync("demo_head_ht")).PostJsonAsync($"/api/v1/dossiers/{dossier.Id}/transitions", new { action = "accept" })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await clerk.PostJsonAsync($"/api/v1/dossiers/{dossier.Id}/transitions", new { action = "archive" })).StatusCode.ShouldBe(HttpStatusCode.OK);
        await api.ExecuteAsync("UPDATE hoso.dossiers SET archived_at = now() - make_interval(years => $2) WHERE id = $1", dossier.Id, archivedYearsAgo);
        return new Setup(dossier, other, a, b, shared, publicDoc);
    }

    private sealed record Setup(DossierDetailDto Dossier, DossierDetailDto Other, (Guid DocumentId, Guid FileId, string Key) A, (Guid DocumentId, Guid FileId, string Key) B,
        (Guid DocumentId, Guid FileId, string Key) Shared, Guid PublicDocument);

    /// <summary>Quy tắc bảo quản đã xác nhận (người xác nhận + căn cứ pháp lý) gán thẳng cho hồ sơ, không phụ thuộc quy tắc khác trong danh mục.</summary>
    private async Task<Guid> RuleAsync(Guid dossierId, short years, string status = "confirmed", string group = "U15")
    {
        var id = Guid.NewGuid();
        var confirmer = await api.UserIdAsync("demo_chair");
        if (status == "confirmed")
            await api.ExecuteAsync("INSERT INTO hoso.retention_rules(id, work_group_code, retention_label, retention_years, legal_reference, status, confirmed_by, confirmed_at) VALUES ($1, $2, $3, $4, 'Thông tư kiểm thử 01/2026', 'confirmed', $5, now())",
                id, group, $"{years} năm {Tag}", years, confirmer);
        else
            await api.ExecuteAsync("INSERT INTO hoso.retention_rules(id, work_group_code, retention_label, retention_years, status) VALUES ($1, $2, $3, $4, 'proposed')", id, group, $"{years} năm đề xuất {Tag}", years);
        await api.ExecuteAsync("UPDATE hoso.dossiers SET retention_rule_id = $2 WHERE id = $1", dossierId, id);
        return id;
    }

    private Task DispatchAsync() => api.DrainOutboxAsync();

    [Fact]
    public async Task Huy_du_ba_buoc_xoa_noi_dung_rieng_cua_ho_so_giu_metadata_nhat_ky_tep_dung_chung_va_chan_goi_som()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var chair = await api.LoginAsync("demo_chair");
        var s = await ArchivedAsync($"Hồ sơ đến hạn hủy {Tag}");
        await RuleAsync(s.Dossier.Id, 10);

        // Vị trí kho, chữ OCR và gợi ý AI của giấy tờ riêng: phải bị xóa theo.
        var warehouse = await (await clerk.PostJsonAsync("/api/v1/storage-locations", new { kind = "warehouse", code = $"HUY{Tag}", name = "Kho hủy" })).ReadAsync<StorageNode>();
        var box = await (await clerk.PostJsonAsync("/api/v1/storage-locations", new { parentId = warehouse.Id, kind = "room", code = $"HUYP{Tag}", name = "Phòng" })).ReadAsync<StorageNode>();
        var shelf = await (await clerk.PostJsonAsync("/api/v1/storage-locations", new { parentId = box.Id, kind = "shelf", code = $"HUYK{Tag}", name = "Kệ" })).ReadAsync<StorageNode>();
        await clerk.PutJsonAsync($"/api/v1/dossiers/{s.Dossier.Id}/location", new { locationId = shelf.Id });
        await api.ExecuteAsync("INSERT INTO hoso.ocr_pages(job_id, page_no, method, text, status) SELECT id, 1, 'ocr', 'Nội dung nhạy cảm cần xóa', 'completed' FROM hoso.ocr_jobs WHERE file_id = $1", s.A.FileId);

        // Danh sách đến hạn có hồ sơ này.
        (await (await clerk.GetAsync("/api/v1/disposals/eligible")).ReadAsync<List<Eligible>>()).ShouldContain(e => e.DossierId == s.Dossier.Id && e.RetentionYears == 10);

        // Chưa có quyền / thiếu điều kiện thì không đề nghị được.
        (await (await api.LoginAsync("demo_cv_ht")).PostJsonAsync("/api/v1/disposals", new { dossierId = s.Dossier.Id, reason = "Hết thời hạn bảo quản" })).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await clerk.PostJsonAsync("/api/v1/disposals", new { dossierId = s.Dossier.Id, reason = "ngắn" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var created = await (await clerk.PostJsonAsync("/api/v1/disposals", new { dossierId = s.Dossier.Id, reason = "Hết thời hạn bảo quản 10 năm theo quy định" })).ReadAsync<Disposal>();
        created.Status.ShouldBe("requested");
        created.RetentionYears.ShouldBe((short)10);
        var dup = await clerk.PostJsonAsync("/api/v1/disposals", new { dossierId = s.Dossier.Id, reason = "Đề nghị lần hai cho cùng hồ sơ" });
        dup.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await dup.ProblemCodeAsync()).ShouldBe("disposal_conflict");

        // Thực hiện khi chưa duyệt: 409 và tệp còn nguyên.
        var early = await clerk.PostJsonAsync($"/api/v1/disposals/{created.Id}/execute");
        early.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        File.Exists(Path.Combine(api.StorageRoot, s.A.Key)).ShouldBeTrue();

        // Người đề nghị không phê duyệt được; lãnh đạo được báo.
        (await clerk.PostJsonAsync($"/api/v1/disposals/{created.Id}/approve", new { decisionDocumentId = s.PublicDocument })).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        await DispatchAsync();
        (await (await chair.GetAsync("/api/v1/notifications?unread=true")).ReadAsync<Notifications>()).Items.ShouldContain(n => n.Kind == "disposal.requested" && n.DossierId == s.Dossier.Id);

        // Văn bản quyết định: không có thật, hoặc nằm trong chính hồ sơ bị hủy → từ chối.
        var missing = await chair.PostJsonAsync($"/api/v1/disposals/{created.Id}/approve", new { decisionDocumentId = Guid.NewGuid() });
        missing.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await missing.ProblemCodeAsync()).ShouldBe("decision_document_invalid");
        (await chair.PostJsonAsync($"/api/v1/disposals/{created.Id}/approve", new { decisionDocumentId = s.PublicDocument })).StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);   // public-003 đang nằm trong hồ sơ
        var decision = await api.ScalarAsync<Guid>("SELECT id FROM hoso.documents WHERE external_key = 'public-016'");
        var approved = await (await chair.PostJsonAsync($"/api/v1/disposals/{created.Id}/approve", new { decisionDocumentId = decision, note = "Đồng ý hủy theo quyết định của Hội đồng thẩm định" })).ReadAsync<Disposal>();
        approved.Status.ShouldBe("approved");
        approved.DecisionDocumentId.ShouldBe(decision);
        approved.DecidedByName.ShouldBe("GIẢ LẬP · demo_chair");
        (await chair.PostJsonAsync($"/api/v1/disposals/{created.Id}/approve", new { decisionDocumentId = decision })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await chair.PostJsonAsync($"/api/v1/disposals/{created.Id}/execute")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);   // lãnh đạo không thực hiện
        await DispatchAsync();
        (await (await clerk.GetAsync("/api/v1/notifications?unread=true")).ReadAsync<Notifications>()).Items.ShouldContain(n => n.Kind == "disposal.approved" && n.DossierId == s.Dossier.Id);

        // Thực hiện.
        var done = await (await clerk.PostJsonAsync($"/api/v1/disposals/{created.Id}/execute")).ReadAsync<Result>();
        done.Disposal.Status.ShouldBe("executed");
        done.Disposal.ExecutedByName.ShouldBe("GIẢ LẬP · demo_clerk_ubnd");
        done.FilesDisposed.ShouldBe(2, "chỉ hai giấy tờ nội bộ riêng của hồ sơ");
        done.BlobsDeleted.ShouldBe(2);
        done.DocumentsKept.ShouldBe(2, "giấy tờ dùng chung và giấy tờ công khai được giữ");

        File.Exists(Path.Combine(api.StorageRoot, s.A.Key)).ShouldBeFalse();
        File.Exists(Path.Combine(api.StorageRoot, s.B.Key)).ShouldBeFalse();
        File.Exists(Path.Combine(api.StorageRoot, s.Shared.Key)).ShouldBeTrue("giấy tờ còn thuộc hồ sơ khác");
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.files WHERE id = ANY($1) AND disposed_at IS NOT NULL AND storage_key IS NULL", new[] { s.A.FileId, s.B.FileId })).ShouldBe(2);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.files WHERE id = $1 AND disposed_at IS NULL AND storage_key IS NOT NULL", s.Shared.FileId)).ShouldBe(1);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.ocr_pages p JOIN hoso.ocr_jobs j ON j.id = p.job_id WHERE j.file_id = $1", s.A.FileId)).ShouldBe(0, "chữ OCR cũng là nội dung");
        // Metadata và nhật ký còn: hồ sơ, giấy tờ, dòng tệp, vị trí lưu kho đã bỏ kèm lý do.
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.documents WHERE id = ANY($1)", new[] { s.A.DocumentId, s.B.DocumentId })).ShouldBe(2);
        (await api.ScalarAsync<Guid?>("SELECT storage_location_id FROM hoso.dossiers WHERE id = $1", s.Dossier.Id)).ShouldBeNull();
        var history = await (await clerk.GetAsync($"/api/v1/dossiers/{s.Dossier.Id}/history")).ReadAsync<List<History>>();
        history.ShouldContain(h => h.Action == "location.moved" && h.Note.Contains("Hủy theo đề nghị"));
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.audit_events WHERE table_name = 'disposal_requests' AND coalesce(new_row, old_row) ->> 'id' = $1", created.Id.ToString())).ShouldBeGreaterThanOrEqualTo(3);
        // Tệp đã hủy không mở được; thực hiện lần hai bị chặn.
        (await clerk.GetAsync($"/api/v1/files/{s.A.FileId}/content")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await clerk.PostJsonAsync($"/api/v1/disposals/{created.Id}/execute")).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        // Đã hủy rồi thì không đề nghị lại và không còn nằm trong danh sách đến hạn.
        (await clerk.PostJsonAsync("/api/v1/disposals", new { dossierId = s.Dossier.Id, reason = "Đề nghị hủy lại hồ sơ đã hủy" })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await (await clerk.GetAsync("/api/v1/disposals/eligible")).ReadAsync<List<Eligible>>()).ShouldNotContain(e => e.DossierId == s.Dossier.Id);
    }

    private sealed record StorageNode(Guid Id);

    [Fact]
    public async Task Dieu_kien_de_nghi_chua_het_han_chua_xac_nhan_thieu_quy_tac_chua_luu_tru_va_dang_duoc_muon()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var cv = await api.LoginAsync("demo_cv_ht");

        // Chưa đủ số năm bảo quản.
        var young = await ArchivedAsync($"Hồ sơ chưa hết hạn {Tag}", archivedYearsAgo: 3);
        await RuleAsync(young.Dossier.Id, 10);
        var tooEarly = await clerk.PostJsonAsync("/api/v1/disposals", new { dossierId = young.Dossier.Id, reason = "Muốn hủy sớm hồ sơ này" });
        tooEarly.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await tooEarly.ProblemCodeAsync()).ShouldBe("retention_not_elapsed");

        // Quy tắc mới chỉ "đề xuất": hệ thống không coi là thời hạn bảo quản.
        var proposed = await ArchivedAsync($"Hồ sơ quy tắc đề xuất {Tag}");
        await RuleAsync(proposed.Dossier.Id, 5, status: "proposed");
        var notConfirmed = await clerk.PostJsonAsync("/api/v1/disposals", new { dossierId = proposed.Dossier.Id, reason = "Quy tắc mới chỉ đề xuất" });
        (await notConfirmed.ProblemCodeAsync()).ShouldBe("retention_missing");

        // Nhóm công việc không có quy tắc đã xác nhận nào: hệ thống không tự đặt. (Các ca khác trong lớp chỉ thêm quy tắc cho U15 nên dùng một nhóm khác cùng đơn vị.)
        var none = await ArchivedAsync($"Hồ sơ không có quy tắc {Tag}");
        var otherGroup = await api.ScalarAsync<string>("SELECT code FROM hoso.work_groups WHERE department_code = $1 AND organization_code = $2 AND code <> 'U15' ORDER BY code LIMIT 1",
            none.Dossier.DepartmentCode, none.Dossier.OrganizationCode);
        otherGroup.ShouldNotBeNull("cần một nhóm công việc thứ hai của đơn vị để kiểm ca không có quy tắc");
        await api.ExecuteAsync("UPDATE hoso.dossiers SET work_group_code = $2 WHERE id = $1", none.Dossier.Id, otherGroup);
        var noRule = await clerk.PostJsonAsync("/api/v1/disposals", new { dossierId = none.Dossier.Id, reason = "Chưa có quy tắc bảo quản" });
        noRule.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await noRule.ProblemCodeAsync()).ShouldBe("retention_missing");

        // Hồ sơ chưa lưu trữ.
        var draft = await (await cv.PostJsonAsync("/api/v1/dossiers", new { title = "Hồ sơ còn đang soạn", workGroupCode = "U15" })).ReadAsync<DossierDetailDto>();
        var notArchived = await clerk.PostJsonAsync("/api/v1/disposals", new { dossierId = draft.Id, reason = "Hồ sơ này chưa lưu trữ" });
        (await notArchived.ProblemCodeAsync()).ShouldBe("disposal_not_eligible");

        // Đang được mượn bản giấy.
        var lent = await ArchivedAsync($"Hồ sơ đang cho mượn {Tag}");
        await RuleAsync(lent.Dossier.Id, 10);
        var loan = await (await cv.PostJsonAsync("/api/v1/loans", new { dossierId = lent.Dossier.Id, purpose = "Tra cứu số liệu" })).ReadAsync<Loan>();
        await clerk.PostJsonAsync($"/api/v1/loans/{loan.Id}/approve");
        await clerk.PostJsonAsync($"/api/v1/loans/{loan.Id}/lend");
        var borrowed = await clerk.PostJsonAsync("/api/v1/disposals", new { dossierId = lent.Dossier.Id, reason = "Hết hạn bảo quản nhưng đang mượn" });
        borrowed.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await borrowed.ProblemCodeAsync()).ShouldBe("loan_conflict");
        await clerk.PostJsonAsync($"/api/v1/loans/{loan.Id}/return");
        (await clerk.PostJsonAsync("/api/v1/disposals", new { dossierId = lent.Dossier.Id, reason = "Đã nhận trả, hết hạn bảo quản" })).StatusCode.ShouldBe(HttpStatusCode.OK);

        // Hồ sơ ngoài cơ quan: không thấy.
        (await (await api.LoginAsync("demo_clerk_hdnd")).PostJsonAsync("/api/v1/disposals", new { dossierId = lent.Dossier.Id, reason = "Hồ sơ của cơ quan khác" })).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Tu_choi_can_ly_do_cho_phep_de_nghi_lai_va_nguoi_de_nghi_khong_tu_duyet_duoc_ca_khi_co_quyen()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var chair = await api.LoginAsync("demo_chair");
        var s = await ArchivedAsync($"Hồ sơ bị từ chối hủy {Tag}");
        await RuleAsync(s.Dossier.Id, 10);
        var first = await (await clerk.PostJsonAsync("/api/v1/disposals", new { dossierId = s.Dossier.Id, reason = "Đề nghị hủy lần một" })).ReadAsync<Disposal>();

        (await chair.PostJsonAsync($"/api/v1/disposals/{first.Id}/reject", new { note = "ngắn" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var rejected = await (await chair.PostJsonAsync($"/api/v1/disposals/{first.Id}/reject", new { note = "Hồ sơ còn giá trị tham khảo, giữ thêm 2 năm" })).ReadAsync<Disposal>();
        rejected.Status.ShouldBe("rejected");
        (await chair.PostJsonAsync($"/api/v1/disposals/{first.Id}/execute")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await clerk.PostJsonAsync($"/api/v1/disposals/{first.Id}/execute")).StatusCode.ShouldBe(HttpStatusCode.Conflict);   // đã từ chối: không thực hiện được
        await DispatchAsync();
        var notes = await (await clerk.GetAsync("/api/v1/notifications?unread=true")).ReadAsync<Notifications>();
        notes.Items.ShouldContain(n => n.Kind == "disposal.rejected" && n.DossierId == s.Dossier.Id);
        File.Exists(Path.Combine(api.StorageRoot, s.A.Key)).ShouldBeTrue("từ chối thì không đụng tới tệp");

        // Bị từ chối rồi vẫn đề nghị lại được; nhưng nếu người phê duyệt chính là người đề nghị (có cả hai quyền) thì bị chặn.
        var second = await (await clerk.PostJsonAsync("/api/v1/disposals", new { dossierId = s.Dossier.Id, reason = "Đề nghị hủy lần hai sau khi bổ sung căn cứ" })).ReadAsync<Disposal>();
        await api.ExecuteAsync("UPDATE hoso.disposal_requests SET requested_by = $2 WHERE id = $1", second.Id, await api.UserIdAsync("demo_chair"));
        var self = await chair.PostJsonAsync($"/api/v1/disposals/{second.Id}/approve", new { decisionDocumentId = await api.ScalarAsync<Guid>("SELECT id FROM hoso.documents WHERE external_key = 'public-016'") });
        self.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await self.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("khác người đề nghị");

        // Liệt kê theo trạng thái; nhân viên không có quyền xem.
        (await (await clerk.GetAsync("/api/v1/disposals?status=rejected")).ReadAsync<List<Disposal>>()).ShouldContain(d => d.Id == first.Id);
        (await (await api.LoginAsync("demo_cv_ht")).GetAsync("/api/v1/disposals")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Noi_dung_dung_chung_voi_ban_ghi_khac_khong_bi_xoa_khi_huy()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var chair = await api.LoginAsync("demo_chair");
        var s = await ArchivedAsync($"Hồ sơ chung nội dung {Tag}");
        await RuleAsync(s.Dossier.Id, 10);

        // Một bản ghi tệp khác (giấy tờ khác) trỏ cùng nội dung với tệp A: xóa tệp A không được làm mất nội dung của bản ghi kia.
        var holder = Guid.NewGuid();
        await api.ExecuteAsync("INSERT INTO hoso.documents(id, origin, title, document_form) VALUES ($1, 'internal', 'Bản sao dùng chung nội dung', 'Chưa xác định')", holder);
        await api.ExecuteAsync("INSERT INTO hoso.files(id, document_id, component_key, version_no, file_role, original_name, media_type, byte_size, sha256, storage_key) SELECT gen_random_uuid(), $2, 'main', 1, 'derivative', 'ban-sao.pdf', media_type, byte_size, sha256, storage_key FROM hoso.files WHERE id = $1", s.A.FileId, holder);

        var request = await (await clerk.PostJsonAsync("/api/v1/disposals", new { dossierId = s.Dossier.Id, reason = "Hết hạn bảo quản, kiểm tra dùng chung nội dung" })).ReadAsync<Disposal>();
        await chair.PostJsonAsync($"/api/v1/disposals/{request.Id}/approve", new { decisionDocumentId = await api.ScalarAsync<Guid>("SELECT id FROM hoso.documents WHERE external_key = 'public-016'") });
        var done = await (await clerk.PostJsonAsync($"/api/v1/disposals/{request.Id}/execute")).ReadAsync<Result>();

        done.FilesDisposed.ShouldBe(2);
        done.BlobsDeleted.ShouldBe(1, "chỉ nội dung của tệp B; nội dung của tệp A vẫn được bản ghi khác dùng");
        File.Exists(Path.Combine(api.StorageRoot, s.A.Key)).ShouldBeTrue();
        File.Exists(Path.Combine(api.StorageRoot, s.B.Key)).ShouldBeFalse();
    }

    [Fact]
    public async Task Hai_yeu_cau_thuc_hien_cung_luc_chi_mot_thanh_cong_va_dem_tep_khong_bi_gap_doi()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var chair = await api.LoginAsync("demo_chair");
        var s = await ArchivedAsync($"Hồ sơ hủy đồng thời {Tag}");
        await RuleAsync(s.Dossier.Id, 10);
        var request = await (await clerk.PostJsonAsync("/api/v1/disposals", new { dossierId = s.Dossier.Id, reason = "Hết hạn bảo quản, thử thực hiện đồng thời" })).ReadAsync<Disposal>();
        await chair.PostJsonAsync($"/api/v1/disposals/{request.Id}/approve", new { decisionDocumentId = await api.ScalarAsync<Guid>("SELECT id FROM hoso.documents WHERE external_key = 'public-016'") });

        var second = await api.LoginAsync("demo_clerk_ubnd");
        var responses = await Task.WhenAll(clerk.PostJsonAsync($"/api/v1/disposals/{request.Id}/execute"), second.PostJsonAsync($"/api/v1/disposals/{request.Id}/execute"));
        responses.Count(r => r.StatusCode == HttpStatusCode.OK).ShouldBe(1);
        responses.Count(r => r.StatusCode == HttpStatusCode.Conflict).ShouldBe(1);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.files WHERE id = ANY($1) AND disposed_at IS NOT NULL", new[] { s.A.FileId, s.B.FileId })).ShouldBe(2);
        File.Exists(Path.Combine(api.StorageRoot, s.A.Key)).ShouldBeFalse();
    }
}
