using System.Net;
using System.Text.Json;
using HoSoSo.Api.IntegrationTests.Support;
using Microsoft.Extensions.DependencyInjection;
using UglyToad.PdfPig;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-84 nộp lưu theo đợt, BE-85 biên bản.</summary>
public sealed class ArchiveTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record Item(Guid DossierId, string Code, string Title, int PageCount, string? Location, string CheckResult, string Note);
    private sealed record Submission(Guid Id, string Code, string Status, string CreatedByName, string? SubmittedByName, string? ReceivedByName, bool HasMinutes, string ReturnNote, int DossierCount, int PageCount, List<Item>? Items);
    private sealed record Node(Guid Id, string Path);
    private sealed record NotificationItem(string Kind, string Title, string? Link);
    private sealed record Notifications(List<NotificationItem> Items);

    private static readonly string Tag = Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
    private static readonly Guid SecondClerk = Guid.NewGuid();

    /// <summary>Hồ sơ đi hết đường: có giấy tờ đã đối chiếu → trình → trưởng phòng đạt → chờ nộp lưu.</summary>
    private async Task<DossierDetailDto> ReadyAsync(string title, string documentKey = "public-003")
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var d = await (await cv.PostJsonAsync("/api/v1/dossiers", new { title, workGroupCode = "U15" })).ReadAsync<DossierDetailDto>();
        var doc = await api.ScalarAsync<Guid>("SELECT id FROM hoso.documents WHERE external_key = $1", documentKey);
        await cv.PostJsonAsync($"/api/v1/dossiers/{d.Id}/documents", new { documentId = doc });
        await api.ExecuteAsync("UPDATE hoso.documents SET data_review_status = 'verified', reviewed_by = $1, reviewed_at = now() WHERE id = $2", await api.UserIdAsync("demo_cv_ht"), doc);
        await cv.PostJsonAsync($"/api/v1/dossiers/{d.Id}/transitions", new { action = "submit" });
        var manager = await api.LoginAsync("demo_head_ht");
        (await manager.PostJsonAsync($"/api/v1/dossiers/{d.Id}/transitions", new { action = "accept" })).StatusCode.ShouldBe(HttpStatusCode.OK);
        return d;
    }

    /// <summary>Văn thư thứ hai của UBND để người nộp và người nhận là hai người khác nhau.</summary>
    private async Task<HttpClient> SecondClerkAsync()
    {
        if (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.users WHERE id = $1", SecondClerk) == 0)
        {
            await api.ExecuteAsync("INSERT INTO hoso.users(id, username, display_name, is_demo) VALUES ($1, 'demo_clerk_ubnd_2', 'GIẢ LẬP · văn thư 2', true)", SecondClerk);
            await api.ExecuteAsync("INSERT INTO hoso.user_roles(id, user_id, role_code, organization_code, department_code, valid_from, assignment_basis) VALUES (gen_random_uuid(), $1, 'clerk', 'tl-ubnd', NULL, '2025-01-01', 'Kiểm thử')", SecondClerk);
        }
        return await api.LoginAsync("demo_clerk_ubnd_2");
    }

    private static Task<HttpResponseMessage> CreateAsync(HttpClient clerk, params Guid[] ids) => clerk.PostJsonAsync("/api/v1/archive-submissions", new { dossierIds = ids, note = "Đợt thử" });

    [Fact]
    public async Task Nop_luu_tao_dot_nop_tiep_nhan_ca_dot_va_sinh_bien_ban_co_day_du_noi_dung()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var receiver = await SecondClerkAsync();
        var a = await ReadyAsync($"Hồ sơ nộp lưu A {Tag}");
        var b = await ReadyAsync($"Hồ sơ nộp lưu B {Tag}", "public-016");
        var notReady = await (await (await api.LoginAsync("demo_cv_ht")).PostJsonAsync("/api/v1/dossiers", new { title = "Hồ sơ chưa trình", workGroupCode = "U15" })).ReadAsync<DossierDetailDto>();

        // Đặt hồ sơ A vào hộp để biên bản có vị trí.
        var warehouse = await (await clerk.PostJsonAsync("/api/v1/storage-locations", new { kind = "warehouse", code = $"NL{Tag}", name = "Kho lưu trữ" })).ReadAsync<Node>();
        var box = await (await clerk.PostJsonAsync("/api/v1/storage-locations", new { parentId = warehouse.Id, kind = "room", code = $"NLP{Tag}", name = "Phòng 1" })).ReadAsync<Node>();
        var shelf = await (await clerk.PostJsonAsync("/api/v1/storage-locations", new { parentId = box.Id, kind = "shelf", code = $"NLK{Tag}", name = "Kệ 1" })).ReadAsync<Node>();
        (await clerk.PutJsonAsync($"/api/v1/dossiers/{a.Id}/location", new { locationId = shelf.Id })).StatusCode.ShouldBe(HttpStatusCode.OK);

        // Chuyên viên không gom được; hồ sơ chưa ở bước chờ nộp lưu bị từ chối cả đợt kèm chi tiết.
        (await CreateAsync(await api.LoginAsync("demo_cv_ht"), a.Id)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        var bad = await CreateAsync(clerk, a.Id, notReady.Id);
        bad.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await bad.ProblemCodeAsync()).ShouldBe("archive_invalid");
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.archive_submission_items WHERE dossier_id = $1", a.Id)).ShouldBe(0, "đợt lỗi không để lại gì");
        (await clerk.PostJsonAsync("/api/v1/archive-submissions", new { dossierIds = Array.Empty<Guid>() })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var draft = await (await CreateAsync(clerk, a.Id, b.Id)).ReadAsync<Submission>();
        draft.Status.ShouldBe("draft");
        draft.Code.ShouldMatch(@"^NL-\d{4}-\d{4}$");
        draft.DossierCount.ShouldBe(2);
        draft.PageCount.ShouldBeGreaterThan(0, "số trang cộng từ tệp của các thành phần");
        draft.Items!.Single(i => i.DossierId == a.Id).Location.ShouldBe("Kho lưu trữ › Phòng 1 › Kệ 1");

        // Hồ sơ đã nằm trong đợt đang mở thì không gom lần nữa.
        var dup = await CreateAsync(clerk, a.Id);
        dup.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await dup.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain(draft.Code);

        (await receiver.PostJsonAsync($"/api/v1/archive-submissions/{draft.Id}/receive")).StatusCode.ShouldBe(HttpStatusCode.Conflict);   // chưa nộp
        var submitted = await (await clerk.PostJsonAsync($"/api/v1/archive-submissions/{draft.Id}/submit")).ReadAsync<Submission>();
        submitted.Status.ShouldBe("submitted");
        submitted.SubmittedByName.ShouldBe("GIẢ LẬP · demo_clerk_ubnd");
        (await clerk.DeleteAsync($"/api/v1/archive-submissions/{draft.Id}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Conflict);   // đã nộp: không xóa
        (await (await api.LoginAsync("demo_clerk_hdnd")).GetAsync($"/api/v1/archive-submissions/{draft.Id}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);   // cơ quan khác

        // Biên bản chưa có trước khi tiếp nhận.
        (await receiver.GetAsync($"/api/v1/archive-submissions/{draft.Id}/minutes")).StatusCode.ShouldBe(HttpStatusCode.Conflict);

        var received = await (await receiver.PostJsonAsync($"/api/v1/archive-submissions/{draft.Id}/receive")).ReadAsync<Submission>();
        received.Status.ShouldBe("received");
        received.ReceivedByName.ShouldBe("GIẢ LẬP · văn thư 2");
        received.HasMinutes.ShouldBeTrue();
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.dossiers WHERE id = ANY($1) AND status = 'archived' AND archived_at IS NOT NULL", new[] { a.Id, b.Id })).ShouldBe(2);
        (await receiver.PostJsonAsync($"/api/v1/archive-submissions/{draft.Id}/receive")).StatusCode.ShouldBe(HttpStatusCode.Conflict);   // tiếp nhận hai lần

        // Biên bản: mã đợt, danh mục hồ sơ, số trang, vị trí, người nộp, người nhận; tải lại cho đúng tệp cũ.
        var first = await receiver.GetAsync($"/api/v1/archive-submissions/{draft.Id}/minutes");
        first.Content.Headers.ContentType!.MediaType.ShouldBe("application/pdf");
        var bytes = await first.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        using (var pdf = PdfDocument.Open(bytes))
        {
            var text = string.Join(" ", pdf.GetPages().Select(p => p.Text));
            text.ShouldContain(draft.Code);
            text.ShouldContain(a.Code);
            text.ShouldContain(b.Code);
            text.ShouldContain("Kho lưu trữ › Phòng 1 › Kệ 1");
            text.ShouldContain("demo_clerk_ubnd");
            text.ShouldContain("văn thư 2");
            text.ShouldContain($"Hồ sơ nộp lưu A {Tag}");
        }
        var second = await (await receiver.GetAsync($"/api/v1/archive-submissions/{draft.Id}/minutes")).Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        second.ShouldBe(bytes, "sinh một lần rồi lưu, không sinh lại");
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.documents WHERE title = $1", $"Biên bản nộp lưu {draft.Code}")).ShouldBe(1);

        // Người nộp được báo đã tiếp nhận; trường hợp văn thư 2 được báo khi nộp.
        await DispatchAsync();
        var notes = await (await clerk.GetAsync("/api/v1/notifications?unread=true")).ReadAsync<Notifications>();
        notes.Items.ShouldContain(n => n.Kind == "archive.received" && n.Link == $"/nop-luu/{draft.Id}");
        var notes2 = await (await receiver.GetAsync("/api/v1/notifications?unread=true")).ReadAsync<Notifications>();
        notes2.Items.ShouldContain(n => n.Kind == "archive.submitted");
    }

    [Fact]
    public async Task Mot_ho_so_loi_thi_ca_dot_khong_doi_trang_thai_loi_duoc_ghi_lai_va_sua_xong_tiep_nhan_lai_duoc()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var a = await ReadyAsync($"Đợt lỗi A {Tag}");
        var b = await ReadyAsync($"Đợt lỗi B {Tag}");
        var c = await ReadyAsync($"Đợt lỗi C {Tag}");
        var s = await (await CreateAsync(clerk, a.Id, b.Id, c.Id)).ReadAsync<Submission>();
        await clerk.PostJsonAsync($"/api/v1/archive-submissions/{s.Id}/submit");

        // Sau khi nộp, hồ sơ B bị người khác trả lại: tiếp nhận phải hoàn tác cả đợt.
        await api.ExecuteAsync("UPDATE hoso.dossiers SET status = 'returned' WHERE id = $1", b.Id);
        var failed = await clerk.PostJsonAsync($"/api/v1/archive-submissions/{s.Id}/receive");
        failed.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await failed.ProblemCodeAsync()).ShouldBe("archive_issues");
        var body = await failed.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldContain(b.Code);
        body.ShouldContain("chờ nộp lưu");
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.dossiers WHERE id = ANY($1) AND status = 'archived'", new[] { a.Id, b.Id, c.Id })).ShouldBe(0, "không hồ sơ nào đổi trạng thái");
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.workflow_events WHERE action = 'archive' AND dossier_id = ANY($1)", new[] { a.Id, b.Id, c.Id })).ShouldBe(0);
        var after = await (await clerk.GetAsync($"/api/v1/archive-submissions/{s.Id}")).ReadAsync<Submission>();
        after.Status.ShouldBe("submitted");
        after.HasMinutes.ShouldBeFalse();
        after.Items!.Single(i => i.DossierId == b.Id).CheckResult.ShouldBe("issue");
        after.Items!.Where(i => i.DossierId != b.Id).ShouldAllBe(i => i.CheckResult == "ok");

        // Sửa xong thì tiếp nhận lại được, mọi hồ sơ cùng lưu trữ.
        await api.ExecuteAsync("UPDATE hoso.dossiers SET status = 'ready_archive' WHERE id = $1", b.Id);
        (await (await clerk.PostJsonAsync($"/api/v1/archive-submissions/{s.Id}/receive")).ReadAsync<Submission>()).Status.ShouldBe("received");
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.dossiers WHERE id = ANY($1) AND status = 'archived'", new[] { a.Id, b.Id, c.Id })).ShouldBe(3);
        (await (await clerk.GetAsync($"/api/v1/archive-submissions/{s.Id}")).ReadAsync<Submission>()).Items!.ShouldAllBe(i => i.CheckResult == "ok" && i.Note == "");
    }

    [Fact]
    public async Task Tra_lai_dot_can_ly_do_ghi_loi_tung_ho_so_bao_nguoi_nop_va_giai_phong_ho_so_de_gom_lai()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var receiver = await SecondClerkAsync();
        var a = await ReadyAsync($"Trả lại A {Tag}");
        var b = await ReadyAsync($"Trả lại B {Tag}");
        var s = await (await CreateAsync(clerk, a.Id, b.Id)).ReadAsync<Submission>();
        await clerk.PostJsonAsync($"/api/v1/archive-submissions/{s.Id}/submit");

        (await receiver.PostJsonAsync($"/api/v1/archive-submissions/{s.Id}/return", new { note = "ngắn" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await receiver.PostJsonAsync($"/api/v1/archive-submissions/{s.Id}/return", new { note = "Bản giấy thiếu trang 3", issues = new[] { new { dossierId = Guid.NewGuid(), note = "lạ" } } })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var returned = await (await receiver.PostJsonAsync($"/api/v1/archive-submissions/{s.Id}/return",
            new { note = "Bản giấy hồ sơ B thiếu trang 3, bổ sung rồi nộp lại.", issues = new[] { new { dossierId = b.Id, note = "Thiếu trang 3" } } })).ReadAsync<Submission>();
        returned.Status.ShouldBe("returned");
        returned.Items!.Single(i => i.DossierId == b.Id).Note.ShouldBe("Thiếu trang 3");
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.dossiers WHERE id = ANY($1) AND status = 'ready_archive'", new[] { a.Id, b.Id })).ShouldBe(2, "trả lại không đổi trạng thái hồ sơ");
        (await receiver.PostJsonAsync($"/api/v1/archive-submissions/{s.Id}/receive")).StatusCode.ShouldBe(HttpStatusCode.Conflict);

        await DispatchAsync();
        var notes = await (await clerk.GetAsync("/api/v1/notifications?unread=true")).ReadAsync<Notifications>();
        notes.Items.ShouldContain(n => n.Kind == "archive.returned");

        // Hồ sơ được giải phóng nên gom vào đợt mới; đợt đang soạn xóa được và cũng giải phóng hồ sơ.
        var again = await (await CreateAsync(clerk, a.Id, b.Id)).ReadAsync<Submission>();
        (await clerk.DeleteAsync($"/api/v1/archive-submissions/{again.Id}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await CreateAsync(clerk, a.Id, b.Id)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await (await clerk.GetAsync("/api/v1/archive-submissions?status=returned")).ReadAsync<List<Submission>>()).ShouldContain(x => x.Id == s.Id);
    }

    private Task DispatchAsync() => api.DrainOutboxAsync();
}
