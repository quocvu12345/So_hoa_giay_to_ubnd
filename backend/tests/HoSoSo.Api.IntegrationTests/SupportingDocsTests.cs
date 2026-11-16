using System.Net;
using System.Net.Http.Headers;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Infrastructure.Messaging;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Npgsql;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-52, BE-63, BE-71, BE-09: liên kết văn bản, hồ sơ gợi ý, nhắc hạn bằng đồng hồ giả, mã lỗi HS006.</summary>
public sealed class SupportingDocsTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record Relation(Guid OtherDocumentId, string Relation1, string Direction);
    private sealed record RelationDto(Guid OtherDocumentId, string Relation, string Direction);
    private sealed record Suggested(Guid Id, string Code, string Status);

    private async Task<Guid> PublicDocAsync(string key) => await api.ScalarAsync<Guid>("SELECT id FROM hoso.documents WHERE external_key = $1", key);

    [Fact]
    public async Task Lien_ket_van_ban_chan_vong_phu_luc_ke_ca_gian_tiep_va_chan_trung()
    {
        var http = await api.LoginAsync("demo_clerk_ubnd");
        var (a, b, c) = (await PublicDocAsync("public-001"), await PublicDocAsync("public-003"), await PublicDocAsync("public-004"));

        (await http.PostJsonAsync($"/api/v1/documents/{a}/relations", new { toDocumentId = b, relation = "appendix_of", note = "Phụ lục kèm theo" })).StatusCode.ShouldBe(HttpStatusCode.OK);
        var cycle = await http.PostJsonAsync($"/api/v1/documents/{b}/relations", new { toDocumentId = a, relation = "appendix_of" });
        cycle.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await cycle.ProblemCodeAsync()).ShouldBe("relation_cycle");

        (await http.PostJsonAsync($"/api/v1/documents/{b}/relations", new { toDocumentId = c, relation = "appendix_of" })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await http.PostJsonAsync($"/api/v1/documents/{c}/relations", new { toDocumentId = a, relation = "appendix_of" })).StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);   // a→b→c→a
        (await http.PostJsonAsync($"/api/v1/documents/{c}/relations", new { toDocumentId = a, relation = "related" })).StatusCode.ShouldBe(HttpStatusCode.OK);                 // loại khác không bị chặn vòng

        var dup = await http.PostJsonAsync($"/api/v1/documents/{a}/relations", new { toDocumentId = b, relation = "appendix_of" });
        dup.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await dup.ProblemCodeAsync()).ShouldBe("duplicate_value");
        (await http.PostJsonAsync($"/api/v1/documents/{a}/relations", new { toDocumentId = a, relation = "related" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await http.PostJsonAsync($"/api/v1/documents/{a}/relations", new { toDocumentId = b, relation = "la-gi" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var listed = await (await http.GetAsync($"/api/v1/documents/{b}/relations")).ReadAsync<List<RelationDto>>();
        listed.ShouldContain(r => r.OtherDocumentId == a && r.Direction == "incoming" && r.Relation == "appendix_of");
        listed.ShouldContain(r => r.OtherDocumentId == c && r.Direction == "outgoing");

        (await http.DeleteAsync($"/api/v1/documents/{a}/relations/{b}/appendix_of", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await http.DeleteAsync($"/api/v1/documents/{a}/relations/{b}/appendix_of", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await http.PostJsonAsync($"/api/v1/documents/{b}/relations", new { toDocumentId = a, relation = "appendix_of" })).StatusCode.ShouldBe(HttpStatusCode.OK);   // gỡ rồi thì đảo chiều được
    }

    [Fact]
    public async Task Chi_nguoi_thay_giay_to_moi_lien_ket_duoc()
    {
        var mine = await api.LoginAsync("demo_cv_ht");
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent("%PDF-1.4\n% lien-ket-rieng\n%%EOF\n"u8.ToArray());
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", "rieng.pdf");
        var up = await (await mine.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();
        var other = await api.LoginAsync("demo_cv_kt");
        (await other.PostJsonAsync($"/api/v1/documents/{await PublicDocAsync("public-001")}/relations", new { toDocumentId = up.DocumentId, relation = "related" })).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await other.GetAsync($"/api/v1/documents/{up.DocumentId}/relations")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Hoso_goi_y_cung_nhom_dang_soan_trong_pham_vi_toi_da_10_khong_goi_y_ho_so_da_xep()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var form = new MultipartFormDataContent();
        var content = new ByteArrayContent("%PDF-1.4\n% goi-y\n%%EOF\n"u8.ToArray());
        content.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(content, "file", "goi-y.pdf");
        var up = await (await cv.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();
        (await (await cv.GetAsync($"/api/v1/dossiers/suggestions?documentId={up.DocumentId}")).ReadAsync<List<Suggested>>()).ShouldBeEmpty("AI chưa gợi ý nhóm nào");

        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='completed', started_at=now(), finished_at=now() WHERE id=$1", up.JobId);
        await api.ExecuteAsync("INSERT INTO hoso.ai_suggestions(job_id, document_id, work_group_code, document_form, title, model_key) VALUES ($1,$2,'U15','Biên bản','x','classifier')", up.JobId, up.DocumentId);

        var created = new List<Guid>();
        for (var i = 0; i < 12; i++)
            created.Add((await (await cv.PostJsonAsync("/api/v1/dossiers", new { title = $"Hồ sơ đất đai số {i:00}", workGroupCode = "U15" })).ReadAsync<DossierDetailDto>()).Id);
        await api.ExecuteAsync("UPDATE hoso.dossiers SET status='department_review' WHERE id=$1", created[0]);      // đang chờ trưởng phòng: không gợi ý
        await api.ExecuteAsync("UPDATE hoso.dossiers SET updated_at = now() + interval '1 hour' WHERE id=$1", created[5]);   // mới nhất: đứng đầu

        var suggested = await (await cv.GetAsync($"/api/v1/dossiers/suggestions?documentId={up.DocumentId}")).ReadAsync<List<Suggested>>();
        suggested.Count.ShouldBe(10);
        suggested[0].Id.ShouldBe(created[5]);
        suggested.ShouldNotContain(s => s.Id == created[0]);
        suggested.ShouldAllBe(s => s.Status == "draft" || s.Status == "returned");
        // DEMO-0008 (returned, cùng nhóm không?) và hồ sơ khác nhóm không xuất hiện.
        suggested.ShouldNotContain(s => s.Code == "DEMO-2026-0004");

        // Giấy tờ đã nằm trong hồ sơ thì hồ sơ đó không được gợi ý lại.
        (await cv.PostJsonAsync($"/api/v1/dossiers/{created[5]}/documents", new { documentId = up.DocumentId })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await (await cv.GetAsync($"/api/v1/dossiers/suggestions?documentId={up.DocumentId}")).ReadAsync<List<Suggested>>()).ShouldNotContain(s => s.Id == created[5]);

        // Người khác đơn vị không có hồ sơ nào trong phạm vi để gợi ý, và không thấy giấy tờ của tôi.
        var other = await api.LoginAsync("demo_cv_kt");
        (await other.GetAsync($"/api/v1/dossiers/suggestions?documentId={up.DocumentId}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Nhac_han_chay_dung_ba_lan_qua_ba_ngay_khong_trung_va_bo_qua_ho_so_da_luu_tru()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var dossier = await (await cv.PostJsonAsync("/api/v1/dossiers", new { title = "Hồ sơ có hạn nội bộ", workGroupCode = "U15", internalDueOn = "2027-03-10" })).ReadAsync<DossierDetailDto>();
        var archived = await (await cv.PostJsonAsync("/api/v1/dossiers", new { title = "Hồ sơ đã lưu trữ", workGroupCode = "U15", internalDueOn = "2027-03-10" })).ReadAsync<DossierDetailDto>();
        await api.ExecuteAsync("UPDATE hoso.dossiers SET status='archived', archived_at=now() WHERE id=$1", archived.Id);
        var service = api.Services.GetServices<IHostedService>().OfType<DueReminderService>().Single();

        static DateTimeOffset At(int day, int hour = 8) => new(2027, 3, day, hour, 0, 0, TimeSpan.FromHours(7));
        async Task<int> CountAsync() => (int)await api.ScalarAsync<long>("SELECT count(*) FROM hoso.notifications WHERE dossier_id = $1 AND kind = 'dossier.due'", dossier.Id);

        // Dữ liệu mẫu có hồ sơ quá hạn nên mỗi lần chạy có thể nhắc hồ sơ khác; chỉ đếm hồ sơ đang xét.
        await service.RunOnceAsync(At(6), TestContext.Current.CancellationToken);                   // còn 4 ngày: chưa nhắc
        (await CountAsync()).ShouldBe(0);
        await service.RunOnceAsync(At(8), TestContext.Current.CancellationToken);                   // còn 2 ngày: nhắc 1
        await service.RunOnceAsync(At(8, 15), TestContext.Current.CancellationToken);              // cùng ngày: không nhắc lại
        await service.RunOnceAsync(At(9), TestContext.Current.CancellationToken);                   // còn 1 ngày: nhắc 2
        await service.RunOnceAsync(At(10), TestContext.Current.CancellationToken);                  // đúng hạn: nhắc 3
        (await CountAsync()).ShouldBe(3);
        await service.RunOnceAsync(At(11), TestContext.Current.CancellationToken);                  // quá hạn vẫn nhắc mỗi ngày
        (await CountAsync()).ShouldBe(4);
        (await api.ScalarAsync<string>("SELECT title FROM hoso.notifications WHERE dossier_id = $1 ORDER BY created_at DESC LIMIT 1", dossier.Id)).ShouldBe("Hồ sơ đã quá hạn nội bộ");
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.notifications WHERE dossier_id = $1", archived.Id)).ShouldBe(0);

        var me = await (await cv.GetAsync("/api/v1/notifications?unread=true")).ReadAsync<NotificationsDto>();
        me.Items.Count(n => n.DossierId == dossier.Id).ShouldBe(4);

        // 7:30 giờ Việt Nam hằng ngày.
        DueReminderService.NextRun(At(10, 6)).ShouldBe(new DateTimeOffset(2027, 3, 10, 7, 30, 0, TimeSpan.FromHours(7)));
        DueReminderService.NextRun(At(10, 8)).ShouldBe(new DateTimeOffset(2027, 3, 11, 7, 30, 0, TimeSpan.FromHours(7)));
    }

    [Fact]
    public async Task Ham_SQL_bao_HS006_khi_khong_thay_ho_so_va_HS001_khi_ngoai_pham_vi()
    {
        var user = await api.UserIdAsync("demo_cv_ht");
        var assignment = await api.AssignmentIdAsync("demo_cv_ht", "employee");
        var missing = await Should.ThrowAsync<PostgresException>(async () => await api.ScalarAsync<string>("SELECT hoso.transition_dossier($1, $2, $3, 'submit', '')", Guid.NewGuid(), user, assignment));
        missing.SqlState.ShouldBe("HS006");
        var other = await api.ScalarAsync<Guid>("SELECT id FROM hoso.dossiers WHERE code = 'DEMO-2026-0002'");
        var outside = await Should.ThrowAsync<PostgresException>(async () => await api.ScalarAsync<string>("SELECT hoso.transition_dossier($1, $2, $3, 'submit', '')", other, user, assignment));
        outside.SqlState.ShouldBe("HS001");
    }

    private sealed record NotificationsDto(List<NotificationItem> Items);
    private sealed record NotificationItem(Guid? DossierId, string Kind);
}
