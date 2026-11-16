using System.Net;
using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-10, BE-61, BE-62, BE-64–68: tạo hồ sơ, xếp giấy tờ, chuyển bước, giao việc, việc của tôi.</summary>
public sealed class DossierWorkflowTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private const string GroupHt = "U15";      // Hạ tầng - Nông nghiệp và Môi trường, UBND
    private const string GroupKt = "U11";      // Phòng Kinh tế, UBND

    private async Task<DossierDetailDto> CreateAsync(HttpClient http, string title, string group = GroupHt) =>
        await (await http.PostJsonAsync("/api/v1/dossiers", new { title, workGroupCode = group })).ReadAsync<DossierDetailDto>();

    private async Task<Guid> PublicDocAsync(string key) => await api.ScalarAsync<Guid>("SELECT id FROM hoso.documents WHERE external_key = $1", key);

    private async Task VerifyAsync(Guid documentId, string reviewer)
    {
        var user = await api.UserIdAsync(reviewer);
        await api.ExecuteAsync("UPDATE hoso.documents SET data_review_status = 'verified', reviewed_by = $1, reviewed_at = now() WHERE id = $2", user, documentId);
    }

    [Fact]
    public async Task Tao_ho_so_cap_ma_theo_nam_gan_chuyen_vien_va_ghi_vet_phan_cong()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var first = await CreateAsync(http, "Hồ sơ thử nghiệm quy trình số 1");
        var second = await CreateAsync(http, "Hồ sơ thử nghiệm quy trình số 2");
        var year = DateTime.UtcNow.AddHours(7).Year;
        first.Code.ShouldMatch($"^UBND-{year}-\\d{{6}}$");
        int Number(string code) => int.Parse(code[^6..]);
        Number(second.Code).ShouldBe(Number(first.Code) + 1, "mã cấp liên tiếp, không trùng");
        first.Status.ShouldBe("draft");
        first.AssigneeName.ShouldBe("GIẢ LẬP · cv · ht");
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.dossier_assignments WHERE dossier_id = $1 AND assignment_role = 'lead' AND ended_at IS NULL", first.Id)).ShouldBe(1);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.audit_events WHERE table_name = 'dossiers' AND operation = 'INSERT' AND actor_subject = $1", (await api.UserIdAsync("demo_cv_ht")).ToString())).ShouldBeGreaterThanOrEqualTo(2);
    }

    [Fact]
    public async Task Tao_ho_so_sai_thi_bao_loi_tung_truong_bang_tieng_viet()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var missing = await http.PostJsonAsync("/api/v1/dossiers", new { workGroupCode = GroupHt });
        missing.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var body = await missing.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldContain("\"errors\"");
        body.ShouldContain("\"title\"");
        body.ShouldContain("Nhập tên hồ sơ");
        (await missing.ProblemCodeAsync()).ShouldBe("validation_failed");

        (await http.PostJsonAsync("/api/v1/dossiers", new { title = "Hồ sơ hợp lệ", workGroupCode = "KHONG-CO" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await http.PostJsonAsync("/api/v1/dossiers", new { title = "Hồ sơ hợp lệ", workGroupCode = GroupHt, accessLevel = "bi-mat" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Khong_tao_duoc_ho_so_cua_don_vi_khac()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var response = await http.PostJsonAsync("/api/v1/dossiers", new { title = "Hồ sơ của phòng Kinh tế", workGroupCode = GroupKt });
        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await response.ProblemCodeAsync()).ShouldBe("out_of_scope");

        var manager = await api.LoginAsync("demo_head_ht");
        (await manager.PostJsonAsync("/api/v1/dossiers", new { title = "Trưởng phòng không soạn hồ sơ", workGroupCode = GroupHt })).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Sua_ho_so_khoa_lac_quan_va_chi_sua_o_buoc_dang_chuan_bi()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var d = await CreateAsync(http, "Hồ sơ để thử sửa đồng thời");
        var updated = await (await http.PatchJsonAsync($"/api/v1/dossiers/{d.Id}", new { version = d.Version, notes = "Ghi chú lần 1" })).ReadAsync<DossierDetailDto>();
        updated.Version.ShouldNotBe(d.Version);

        // Người thứ hai còn giữ phiên bản cũ.
        var stale = await http.PatchJsonAsync($"/api/v1/dossiers/{d.Id}", new { version = d.Version, notes = "Ghi chú lần 2" });
        stale.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await stale.ProblemCodeAsync()).ShouldBe("concurrency_conflict");

        // Hồ sơ đang chờ trưởng phòng thì không sửa được.
        var waiting = await api.ScalarAsync<Guid>("SELECT id FROM hoso.dossiers WHERE code = 'DEMO-2026-0002'");
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var response = await clerk.PatchJsonAsync($"/api/v1/dossiers/{waiting}", new { version = 1, notes = "Sửa khi đang chờ duyệt" });
        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await response.ProblemCodeAsync()).ShouldBe("workflow_conflict");
    }

    [Fact]
    public async Task Xep_giay_to_vao_ho_so_sap_xep_va_go_ra()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var d = await CreateAsync(http, "Hồ sơ để thử xếp giấy tờ");
        var docs = new[] { await PublicDocAsync("public-001"), await PublicDocAsync("public-003"), await PublicDocAsync("public-004") };
        foreach (var doc in docs)
            (await http.PostJsonAsync($"/api/v1/dossiers/{d.Id}/documents", new { documentId = doc, direction = "incoming" })).StatusCode.ShouldBe(HttpStatusCode.OK);

        (await http.PostJsonAsync($"/api/v1/dossiers/{d.Id}/documents", new { documentId = docs[0] })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await http.PostJsonAsync($"/api/v1/dossiers/{d.Id}/documents", new { documentId = Guid.NewGuid() })).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        // Đổi thứ tự: đưa giấy tờ thứ ba lên đầu.
        var arranged = await (await http.PatchJsonAsync($"/api/v1/dossiers/{d.Id}/documents", new[]
        {
            new { documentId = docs[2], position = 1, direction = (string?)"outgoing" },
            new { documentId = docs[0], position = 2, direction = (string?)null },
            new { documentId = docs[1], position = 3, direction = (string?)null },
        })).ReadAsync<List<DocumentItem>>();
        arranged.Select(x => x.DocumentId).ShouldBe([docs[2], docs[0], docs[1]]);
        arranged[0].Direction.ShouldBe("outgoing");

        (await http.PatchJsonAsync($"/api/v1/dossiers/{d.Id}/documents", new[]
        {
            new { documentId = docs[0], position = 1, direction = (string?)null },
        })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);   // trùng vị trí với giấy tờ khác

        (await http.DeleteAsync($"/api/v1/dossiers/{d.Id}/documents/{docs[1]}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var detail = await (await http.GetAsync($"/api/v1/dossiers/{d.Id}")).ReadAsync<DossierDetailDto>();
        detail.Documents.Count.ShouldBe(2);
        detail.Completeness.Ready.ShouldBeFalse();
        detail.Completeness.Reasons.ShouldContain(r => r.Contains("chưa đối chiếu"));
    }

    [Fact]
    public async Task Quy_trinh_day_du_tu_soan_thao_den_luu_tru_qua_ba_vai_tro()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var d = await CreateAsync(cv, "Hồ sơ chạy đủ quy trình đến nộp lưu");
        var doc = await PublicDocAsync("public-001");
        (await cv.PostJsonAsync($"/api/v1/dossiers/{d.Id}/documents", new { documentId = doc })).StatusCode.ShouldBe(HttpStatusCode.OK);

        // Giấy tờ chưa đối chiếu: nút "Trình" bị khóa và nói rõ lý do; ép gọi API cũng bị chặn.
        var blocked = await (await cv.GetAsync($"/api/v1/dossiers/{d.Id}/actions")).ReadAsync<List<ActionDto>>();
        var submit = blocked.Single();
        (submit.Action, submit.Enabled).ShouldBe(("submit", false));
        submit.DisabledReason.ShouldNotBeNull().ShouldContain("chưa đối chiếu");
        var refused = await cv.PostJsonAsync($"/api/v1/dossiers/{d.Id}/transitions", new { action = "submit" });
        refused.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await refused.ProblemCodeAsync()).ShouldBe("dossier_incomplete");

        await VerifyAsync(doc, "demo_cv_ht");
        var ready = (await (await cv.GetAsync($"/api/v1/dossiers/{d.Id}/actions")).ReadAsync<List<ActionDto>>()).Single();
        (ready.Enabled, ready.ToState).ShouldBe((true, "department_review"));

        // Người khác không có quyền "trình" thì không thấy nút và bị chặn khi ép gọi.
        var manager = await api.LoginAsync("demo_head_ht");
        (await (await manager.GetAsync($"/api/v1/dossiers/{d.Id}/actions")).ReadAsync<List<ActionDto>>()).ShouldBeEmpty();
        (await manager.PostJsonAsync($"/api/v1/dossiers/{d.Id}/transitions", new { action = "submit" })).StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        // Bản cũ của hồ sơ: bị từ chối vì đã có người sửa.
        var current = await (await cv.GetAsync($"/api/v1/dossiers/{d.Id}")).ReadAsync<DossierDetailDto>();
        var stale = await cv.PostJsonAsync($"/api/v1/dossiers/{d.Id}/transitions", new { action = "submit", version = (long)current.Version + 1 });
        stale.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await stale.ProblemCodeAsync()).ShouldBe("concurrency_conflict");

        var submitted = await (await cv.PostJsonAsync($"/api/v1/dossiers/{d.Id}/transitions", new { action = "submit", version = (long)current.Version })).ReadAsync<TransitionDto>();
        submitted.Status.ShouldBe("department_review");

        // Hồ sơ đã chuyển bước: gọi lại cùng thao tác là sai bước (409), không làm gì hai lần.
        var again = await cv.PostJsonAsync($"/api/v1/dossiers/{d.Id}/transitions", new { action = "submit" });
        again.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await again.ProblemCodeAsync()).ShouldBe("workflow_conflict");
        // Trưởng phòng: trả lại cần ý kiến; đạt thì sang chờ nộp lưu.
        var actions = await (await manager.GetAsync($"/api/v1/dossiers/{d.Id}/actions")).ReadAsync<List<ActionDto>>();
        actions.Select(a => a.Action).ShouldBe(["accept", "escalate", "return"]);
        var noNote = await manager.PostJsonAsync($"/api/v1/dossiers/{d.Id}/transitions", new { action = "return", note = "ngắn" });
        noNote.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await noNote.ProblemCodeAsync()).ShouldBe("note_required");
        (await (await manager.PostJsonAsync($"/api/v1/dossiers/{d.Id}/transitions", new { action = "accept" })).ReadAsync<TransitionDto>()).Status.ShouldBe("ready_archive");

        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        (await (await clerk.PostJsonAsync($"/api/v1/dossiers/{d.Id}/transitions", new { action = "archive" })).ReadAsync<TransitionDto>()).Status.ShouldBe("archived");

        var history = await (await clerk.GetAsync($"/api/v1/dossiers/{d.Id}/history")).ReadAsync<List<HistoryDto>>();
        history.Select(h => h.Action).ShouldBe(["archive", "accept", "submit"]);
        history[0].ActorRole.ShouldBe("clerk");
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.outbox_messages WHERE type = 'dossier.transitioned' AND payload->>'dossierId' = $1", d.Id.ToString())).ShouldBe(3);
        (await api.ScalarAsync<DateTime?>("SELECT archived_at FROM hoso.dossiers WHERE id = $1", d.Id)).ShouldNotBeNull();
    }

    [Fact]
    public async Task Tra_lai_roi_chuyen_vien_bo_sung_va_trinh_lai()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var d = await CreateAsync(cv, "Hồ sơ thử đường trả lại bổ sung");
        var doc = await PublicDocAsync("public-003");
        await cv.PostJsonAsync($"/api/v1/dossiers/{d.Id}/documents", new { documentId = doc });
        await VerifyAsync(doc, "demo_cv_ht");
        await cv.PostJsonAsync($"/api/v1/dossiers/{d.Id}/transitions", new { action = "submit" });

        var manager = await api.LoginAsync("demo_head_ht");
        var returned = await (await manager.PostJsonAsync($"/api/v1/dossiers/{d.Id}/transitions", new { action = "return", note = "Thiếu bản vẽ hiện trạng, bổ sung rồi trình lại." })).ReadAsync<TransitionDto>();
        returned.Status.ShouldBe("returned");

        var current = await (await cv.GetAsync($"/api/v1/dossiers/{d.Id}")).ReadAsync<DossierDetailDto>();
        (await cv.PatchJsonAsync($"/api/v1/dossiers/{d.Id}", new { version = current.Version, notes = "Đã bổ sung bản vẽ" })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await (await cv.PostJsonAsync($"/api/v1/dossiers/{d.Id}/transitions", new { action = "submit" })).ReadAsync<TransitionDto>()).Status.ShouldBe("department_review");
        var history = await (await manager.GetAsync($"/api/v1/dossiers/{d.Id}/history")).ReadAsync<List<HistoryDto>>();
        history.First(h => h.Action == "return").Note.ShouldContain("bản vẽ");
    }

    [Fact]
    public async Task Giao_viec_chi_trong_don_vi_va_chi_truong_phong_duoc_giao()
    {
        var manager = await api.LoginAsync("demo_head_ht");
        var id = await api.ScalarAsync<Guid>("SELECT id FROM hoso.dossiers WHERE code = 'DEMO-2026-0001'");
        var colleague = await api.UserIdAsync("demo_cv_ht_02");

        var assigned = await (await manager.PutJsonAsync($"/api/v1/dossiers/{id}/assignment", new { userId = colleague, dueOn = "2026-12-31", note = "Chuyển người chủ trì" })).ReadAsync<DossierDetailDto>();
        assigned.AssigneeId.ShouldBe(colleague);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.dossier_assignments WHERE dossier_id = $1 AND ended_at IS NULL AND assignment_role = 'lead'", id)).ShouldBe(1);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.dossier_assignments WHERE dossier_id = $1 AND ended_at IS NOT NULL", id)).ShouldBeGreaterThanOrEqualTo(1);

        // Người cũ không còn thấy hồ sơ; người mới thấy.
        var old = await api.LoginAsync("demo_cv_ht");
        (await old.GetAsync($"/api/v1/dossiers/{id}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var newOne = await api.LoginAsync("demo_cv_ht_02");
        (await newOne.GetAsync($"/api/v1/dossiers/{id}")).StatusCode.ShouldBe(HttpStatusCode.OK);

        // Giao cho người đơn vị khác, hoặc chuyên viên tự giao: bị chặn.
        var other = await api.UserIdAsync("demo_cv_kt");
        (await manager.PutJsonAsync($"/api/v1/dossiers/{id}/assignment", new { userId = other })).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await newOne.PutJsonAsync($"/api/v1/dossiers/{id}/assignment", new { userId = colleague })).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Viec_cua_toi_theo_phan_cong_dang_dung()
    {
        async Task<Dictionary<string, List<string>>> QueueAsync(string user)
        {
            var http = await api.LoginAsync(user);
            var ws = await (await http.GetAsync("/api/v1/workspace/queue")).ReadAsync<WorkspaceDto>();
            return ws.Queues.ToDictionary(k => k.Key, k => k.Value.Select(i => i.Code).Order().ToList());
        }

        (await QueueAsync("demo_head_kt"))["to_review"].ShouldBe(["DEMO-2026-0002"]);
        (await QueueAsync("demo_chair"))["to_decide"].ShouldBe(["DEMO-2026-0003"]);
        (await QueueAsync("demo_clerk_ubnd"))["to_archive"].ShouldBe(["DEMO-2026-0004"]);
        (await QueueAsync("demo_council"))["to_decide"].ShouldBe(["DEMO-2026-0006"]);
        (await QueueAsync("demo_cv_ht"))["assigned"].ShouldContain("DEMO-2026-0008");   // bước "yêu cầu bổ sung" của chính mình; các test khác trong lớp có thể tạo thêm hồ sơ nháp

        var summary = await (await (await api.LoginAsync("demo_head_kt")).GetAsync("/api/v1/workspace/summary")).ReadAsync<SummaryDto>();
        summary.Counts["to_review"].ShouldBe(1);
        summary.Inbox.ShouldBe(0);
    }

    [Fact]
    public async Task Danh_muc_tra_dung_nhom_loai_giay_to_va_truong()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var groups = await (await http.GetAsync("/api/v1/catalog/work-groups?organization=tl-ubnd&department=ht")).ReadAsync<List<WorkGroupDto>>();
        groups.ShouldContain(g => g.Code == GroupHt);
        groups.ShouldAllBe(g => g.OrganizationCode == "tl-ubnd" && g.DepartmentCode == "ht" && g.DocumentTypeCount > 0);

        var types = await (await http.GetAsync($"/api/v1/catalog/work-groups/{GroupHt}/document-types")).ReadAsync<List<DocumentTypeDto>>();
        types.ShouldNotBeEmpty();
        types.ShouldContain(t => t.Fields.Count > 0);
        (await http.GetAsync("/api/v1/catalog/work-groups/KHONG-CO/document-types")).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        var all = await (await http.GetAsync("/api/v1/catalog/work-groups")).ReadAsync<List<WorkGroupDto>>();
        all.Count.ShouldBe(38);
    }
}
