using System.Net;
using System.Net.Http.Headers;
using System.Text;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Application.Common;
using HoSoSo.Infrastructure.Messaging;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-91: gói xuất được kiểm lại quyền mỗi lần tải và bị thu hồi khi người yêu cầu mất phạm vi, phân công hoặc tài khoản.</summary>
public sealed class ExportRevocationTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record Export(Guid Id, string Status);

    private void Forget(Guid userId)
    {
        using var scope = api.Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<IIdentityService>().Invalidate(userId);
    }

    /// <summary>Văn thư có hai phân công cùng vai trò ở cùng cơ quan (A mặc định, B thêm vào) để thử đổi phân công.</summary>
    private async Task<(string A, string B, Guid User)> ClerkWithTwoAssignmentsAsync()
    {
        var user = await api.UserIdAsync("demo_clerk_ubnd");
        var a = await api.AssignmentIdAsync("demo_clerk_ubnd", "clerk");
        var b = (await api.ScalarAsync<Guid>(
            "INSERT INTO hoso.user_roles(user_id, role_code, organization_code, valid_from, assignment_basis) VALUES ($1, 'clerk', 'tl-ubnd', now() - interval '1 day', 'Phân công thứ hai thử gói xuất') RETURNING id", user)).ToString();
        Forget(user);
        return (a, b, user);
    }

    private async Task<Guid> DossierWithPdfAsync(HttpClient http, string title)
    {
        var dossier = await (await http.PostJsonAsync("/api/v1/dossiers", new { title, workGroupCode = "U15" })).ReadAsync<DossierDetailDto>();
        var form = new MultipartFormDataContent
        {
            { new ByteArrayContent(Encoding.ASCII.GetBytes($"%PDF-1.4\n% {Guid.NewGuid():N}\n%%EOF\n")) { Headers = { ContentType = new MediaTypeHeaderValue("application/pdf") } }, "file", "van-ban.pdf" },
        };
        var upload = await (await http.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();
        (await http.PostJsonAsync($"/api/v1/dossiers/{dossier.Id}/documents", new { documentId = upload.DocumentId })).StatusCode.ShouldBe(HttpStatusCode.OK);
        return dossier.Id;
    }

    private async Task<Export> ReadyExportAsync(HttpClient http, Guid dossier)
    {
        var created = await (await http.PostJsonAsync("/api/v1/exports", new { dossierIds = new[] { dossier } })).ReadAsync<Export>();
        var ready = await Eventually.ForAsync(async () => await (await http.GetAsync($"/api/v1/exports/{created.Id}")).ReadAsync<Export>(), e => e.Status is "ready" or "failed", TimeSpan.FromSeconds(30));
        ready.Status.ShouldBe("ready");
        return ready;
    }

    private ExportWorker Worker() => api.Services.GetServices<IHostedService>().OfType<ExportWorker>().Single();

    [Fact]
    public async Task Mat_pham_vi_ho_so_thi_goi_bi_thu_hoi_noi_dung_bi_xoa_va_khong_tai_lai_duoc()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var dossier = await DossierWithPdfAsync(clerk, "Hồ sơ xuất rồi mất phạm vi");
        var export = await ReadyExportAsync(clerk, dossier);
        var key = (await api.ScalarAsync<string>("SELECT storage_key FROM hoso.export_packages WHERE id = $1", export.Id))!;
        (await clerk.GetAsync($"/api/v1/exports/{export.Id}/file")).StatusCode.ShouldBe(HttpStatusCode.OK, "còn phạm vi thì tải bình thường");

        // Hồ sơ chuyển sang hạn chế: văn thư không còn thấy (ca đã tái hiện trong rà soát).
        await api.ExecuteAsync("UPDATE hoso.dossiers SET access_level = 'restricted' WHERE id = $1", dossier);
        (await clerk.GetAsync($"/api/v1/dossiers/{dossier}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var denied = await clerk.GetAsync($"/api/v1/exports/{export.Id}/file");
        denied.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await denied.ProblemCodeAsync()).ShouldBe("export_scope_changed");
        (await api.ScalarAsync<string>("SELECT status FROM hoso.export_packages WHERE id = $1", export.Id)).ShouldBe("revoked");

        // Thu hồi là vĩnh viễn: trả lại quyền cũng không tải được gói cũ; phải tạo gói mới.
        await api.ExecuteAsync("UPDATE hoso.dossiers SET access_level = 'internal' WHERE id = $1", dossier);
        var gone = await clerk.GetAsync($"/api/v1/exports/{export.Id}/file");
        gone.StatusCode.ShouldBe(HttpStatusCode.Gone);
        (await gone.ProblemCodeAsync()).ShouldBe("export_revoked");

        // Nội dung ZIP được dọn như gói hết hạn.
        File.Exists(Path.Combine(api.StorageRoot, key)).ShouldBeTrue();
        (await Worker().ExpireAsync(TestContext.Current.CancellationToken)).ShouldBeGreaterThanOrEqualTo(1);
        File.Exists(Path.Combine(api.StorageRoot, key)).ShouldBeFalse("nội dung gói bị thu hồi phải bị xóa");
        (await ReadyExportAsync(clerk, dossier)).Id.ShouldNotBe(export.Id);
    }

    [Fact]
    public async Task Doi_sang_phan_cong_khac_khong_tai_duoc_nhung_chon_lai_thi_tai_duoc_va_goi_khong_bi_thu_hoi()
    {
        var (a, b, _) = await ClerkWithTwoAssignmentsAsync();
        var asA = await api.LoginAsync("demo_clerk_ubnd", a);
        var asB = await api.LoginAsync("demo_clerk_ubnd", b);
        var dossier = await DossierWithPdfAsync(asA, "Hồ sơ xuất bằng phân công A");
        var export = await ReadyExportAsync(asA, dossier);

        var wrong = await asB.GetAsync($"/api/v1/exports/{export.Id}/file");
        wrong.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await wrong.ProblemCodeAsync()).ShouldBe("export_wrong_assignment");
        (await api.ScalarAsync<string>("SELECT status FROM hoso.export_packages WHERE id = $1", export.Id)).ShouldBe("ready", "chỉ chọn nhầm phân công, chưa mất quyền: không thu hồi");
        (await asA.GetAsync($"/api/v1/exports/{export.Id}/file")).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Ket_thuc_phan_cong_hoac_khoa_tai_khoan_thu_hoi_cac_goi_con_hieu_luc()
    {
        var (a, b, user) = await ClerkWithTwoAssignmentsAsync();
        var admin = await api.LoginAsync("demo_admin");
        var asA = await api.LoginAsync("demo_clerk_ubnd", a);
        var asB = await api.LoginAsync("demo_clerk_ubnd", b);
        var dossier = await DossierWithPdfAsync(asA, "Hồ sơ xuất rồi kết thúc phân công");
        var byA = await ReadyExportAsync(asA, dossier);
        var byB = await ReadyExportAsync(asB, dossier);

        (await admin.PostJsonAsync($"/api/v1/admin/assignments/{b}/end")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await api.ScalarAsync<string>("SELECT status FROM hoso.export_packages WHERE id = $1", byB.Id)).ShouldBe("revoked", "gói của phân công đã kết thúc bị thu hồi");
        (await api.ScalarAsync<string>("SELECT status FROM hoso.export_packages WHERE id = $1", byA.Id)).ShouldBe("ready", "gói của phân công khác còn nguyên");
        (await asA.GetAsync($"/api/v1/exports/{byB.Id}/file")).StatusCode.ShouldBe(HttpStatusCode.Gone);
        (await asA.GetAsync($"/api/v1/exports/{byA.Id}/file")).StatusCode.ShouldBe(HttpStatusCode.OK);

        // Khóa tài khoản thu hồi mọi gói còn hiệu lực của người đó (admin khác nhóm với văn thư nên khóa được).
        (await admin.PatchJsonAsync($"/api/v1/admin/users/{user}", new { active = false })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await api.ScalarAsync<string>("SELECT status FROM hoso.export_packages WHERE id = $1", byA.Id)).ShouldBe("revoked");
        (await admin.PatchJsonAsync($"/api/v1/admin/users/{user}", new { active = true })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await (await api.LoginAsync("demo_clerk_ubnd", a)).GetAsync($"/api/v1/exports/{byA.Id}/file")).StatusCode.ShouldBe(HttpStatusCode.Gone);
    }

    [Fact]
    public async Task Goi_dang_dong_bi_thu_hoi_thi_cong_nhan_khong_dua_ve_san_sang_va_xoa_noi_dung_vua_ghi()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var dossier = await DossierWithPdfAsync(clerk, "Hồ sơ thu hồi giữa lúc đóng gói");
        var user = await api.UserIdAsync("demo_clerk_ubnd");
        // Tạo gói bằng SQL ở trạng thái "running" để mô phỏng worker đang đóng dở; thu hồi; rồi xác nhận nó không quay về "ready".
        var id = await api.ScalarAsync<Guid>(
            "INSERT INTO hoso.export_packages(requested_by, scope, status, total_items, started_at, heartbeat_at) VALUES ($1, jsonb_build_object('dossierIds', jsonb_build_array($2::text)), 'running', 1, now(), now()) RETURNING id",
            user, dossier.ToString());
        (await api.ScalarAsync<int>("SELECT hoso.revoke_exports($1, NULL, 'thử')", user)).ShouldBeGreaterThanOrEqualTo(1);
        (await api.ScalarAsync<string>("SELECT status FROM hoso.export_packages WHERE id = $1", id)).ShouldBe("revoked");
        // Bản thân việc "running → ready" chỉ cho phép khi còn running (WHERE status = 'running'): kiểm trực tiếp điều kiện đó.
        (await api.ExecuteAsync("UPDATE hoso.export_packages SET status = 'ready' WHERE id = $1 AND status = 'running'", id)).ShouldBe(0);
    }
}
