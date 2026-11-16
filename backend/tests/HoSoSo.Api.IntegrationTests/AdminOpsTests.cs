using System.Net;
using System.Net.Http.Headers;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Infrastructure.Auditing;
using Microsoft.Extensions.DependencyInjection;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-88, BE-89: vận hành cho quản trị: hàng đợi AI, tra nhật ký, cài đặt, sao lưu.</summary>
public sealed class AdminOpsTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record Counts(int Queued, int Running, int Completed24h, int Failed24h, int Cancelled24h);
    private sealed record Worker(string WorkerId, Guid JobId, string? Stage, int HeartbeatAgeSeconds);
    private sealed record Failure(Guid JobId, string FileName, string? Error);
    private sealed record Model(string Key, bool Active);
    private sealed record AiStatusDto(Counts Queue, int? OldestQueuedSeconds, List<Worker> Workers, List<Failure> RecentFailures, List<Model> Models);
    private sealed record AuditDto(long Id, string Kind, string? Actor, string Action, string? ObjectType, string? ObjectId, List<string>? ChangedColumns);
    private sealed record SettingDto(string Key, System.Text.Json.JsonElement Value);
    private sealed record BackupDto(Guid Id, string Kind, string Status, long? ByteSize, DateTimeOffset? RestoreTestedAt);

    private static async Task<UploadDto> UploadAsync(HttpClient http, string marker)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(System.Text.Encoding.ASCII.GetBytes($"%PDF-1.4\n% {marker}\n%%EOF\n"));
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", $"{marker}.pdf");
        return await (await http.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();
    }

    [Fact]
    public async Task Trang_thai_hang_doi_AI_dem_dung_worker_that_bai_va_mo_hinh()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var running = await UploadAsync(cv, "dang-chay");
        var failed = await UploadAsync(cv, "that-bai");
        var queued = await UploadAsync(cv, "dang-cho");
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='running', locked_by='mac-mini-01', stage='ocr', started_at=now(), heartbeat_at=now() - interval '7 seconds' WHERE id=$1", running.JobId);
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='failed', attempt=3, started_at=now(), finished_at=now(), error_message='Mã băm tệp không khớp' WHERE id=$1", failed.JobId);
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET created_at = now() - interval '90 seconds' WHERE id=$1", queued.JobId);

        var admin = await api.LoginAsync("demo_admin");
        var status = await (await admin.GetAsync("/api/v1/admin/ai/status")).ReadAsync<AiStatusDto>();
        status.Queue.Running.ShouldBe(1);
        status.Queue.Queued.ShouldBe(1);
        status.Queue.Failed24h.ShouldBe(1);
        status.OldestQueuedSeconds.ShouldNotBeNull().ShouldBeGreaterThanOrEqualTo(90);
        var worker = status.Workers.Single();
        (worker.WorkerId, worker.Stage).ShouldBe(("mac-mini-01", "ocr"));
        worker.HeartbeatAgeSeconds.ShouldBeInRange(5, 60);
        status.RecentFailures.Single().Error.ShouldBe("Mã băm tệp không khớp");
        status.Models.Select(m => m.Key).ShouldContain("classifier");
        status.Models.Single(m => m.Key == "fake").Active.ShouldBeFalse("mô hình giả lập luôn tắt");

        (await cv.GetAsync("/api/v1/admin/ai/status")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Nhat_ky_thay_doi_cho_biet_ai_sua_cot_nao_nhung_khong_lo_gia_tri()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var secretTitle = "Hồ sơ riêng tư của ông Nguyễn Văn Bí Mật";
        var dossier = await (await cv.PostJsonAsync("/api/v1/dossiers", new { title = secretTitle, workGroupCode = "U15" })).ReadAsync<DossierDetailDto>();
        (await cv.PatchJsonAsync($"/api/v1/dossiers/{dossier.Id}", new { version = dossier.Version, notes = "Ghi chú nội bộ nhạy cảm" })).StatusCode.ShouldBe(HttpStatusCode.OK);
        await api.Services.GetRequiredService<AccessEventQueue>().DrainAsync(TimeSpan.FromSeconds(10));

        var admin = await api.LoginAsync("demo_admin");
        var cvId = await api.UserIdAsync("demo_cv_ht");
        var raw = await (await admin.GetAsync($"/api/v1/admin/audit?kind=change&objectType=dossiers&objectId={dossier.Id}")).Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.ShouldNotContain("Bí Mật", Case.Sensitive, "nhật ký không chép nội dung dữ liệu");
        raw.ShouldNotContain("nhạy cảm", Case.Sensitive);
        var rows = System.Text.Json.JsonSerializer.Deserialize<List<AuditDto>>(raw, DbApiFactory.Json)!;
        rows.Select(r => r.Action).ShouldBe(["UPDATE", "INSERT"], "mới nhất trước");
        rows[0].Actor.ShouldBe("GIẢ LẬP · cv · ht");
        rows[0].ChangedColumns.ShouldNotBeNull().ShouldContain("notes");
        rows[0].ChangedColumns!.ShouldNotContain("title");

        // Lọc theo người và nhật ký truy cập.
        var byActor = await (await admin.GetAsync($"/api/v1/admin/audit?kind=change&actor={cvId}&objectType=dossiers")).ReadAsync<List<AuditDto>>();
        byActor.ShouldAllBe(r => r.ObjectType == "dossiers");
        (await admin.GetAsync($"/api/v1/admin/audit?kind=access&actor={cvId}")).StatusCode.ShouldBe(HttpStatusCode.OK);
        var access = await (await admin.GetAsync($"/api/v1/admin/audit?kind=access&objectType=dossier&objectId={dossier.Id}")).ReadAsync<List<AuditDto>>();
        access.ShouldBeEmpty("chưa ai mở chi tiết hồ sơ này");
        await cv.GetAsync($"/api/v1/dossiers/{dossier.Id}");
        await api.Services.GetRequiredService<AccessEventQueue>().DrainAsync(TimeSpan.FromSeconds(10));
        (await (await admin.GetAsync($"/api/v1/admin/audit?kind=access&objectType=dossier&objectId={dossier.Id}")).ReadAsync<List<AuditDto>>()).Single().Action.ShouldBe("view");

        (await admin.GetAsync("/api/v1/admin/audit?kind=khac")).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await cv.GetAsync("/api/v1/admin/audit")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Cai_dat_khong_nhan_bi_mat_va_chi_quan_tri_moi_sua_duoc()
    {
        var admin = await api.LoginAsync("demo_admin");
        var saved = await (await admin.PatchJsonAsync("/api/v1/admin/settings", new { key = "upload.max_mb", value = new { mb = 200 } })).ReadAsync<SettingDto>();
        saved.Value.GetProperty("mb").GetInt32().ShouldBe(200);
        await admin.PatchJsonAsync("/api/v1/admin/settings", new { key = "upload.max_mb", value = new { mb = 150 } });
        var all = await (await admin.GetAsync("/api/v1/admin/settings")).ReadAsync<List<SettingDto>>();
        all.Single(s => s.Key == "upload.max_mb").Value.GetProperty("mb").GetInt32().ShouldBe(150);

        foreach (var bad in new[] { "smtp.password", "api_token", "Khoa Hoa", "ab" })
            (await admin.PatchJsonAsync("/api/v1/admin/settings", new { key = bad, value = new { x = 1 } })).StatusCode.ShouldBe(HttpStatusCode.BadRequest, bad);
        var cv = await api.LoginAsync("demo_cv_ht");
        (await cv.PatchJsonAsync("/api/v1/admin/settings", new { key = "upload.max_mb", value = new { mb = 1 } })).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Script_sao_luu_bao_ket_qua_va_giao_dien_thay_ban_chua_thu_khoi_phuc()
    {
        var admin = await api.LoginAsync("demo_admin");
        var started = DateTimeOffset.UtcNow.AddMinutes(-5);
        var ok = await (await admin.PostJsonAsync("/api/v1/admin/backups", new { kind = "database", status = "succeeded", startedAt = started, finishedAt = DateTimeOffset.UtcNow, byteSize = 1234567, location = "s3://backup/hoso-2026-11-16.dump" })).ReadAsync<BackupDto>();
        ok.RestoreTestedAt.ShouldBeNull("chưa từng thử khôi phục");
        (await admin.PostJsonAsync("/api/v1/admin/backups", new { kind = "files", status = "running" })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.PostJsonAsync("/api/v1/admin/backups", new { kind = "database", status = "running", finishedAt = DateTimeOffset.UtcNow })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await admin.PostJsonAsync("/api/v1/admin/backups", new { kind = "sai", status = "succeeded", finishedAt = DateTimeOffset.UtcNow })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await (await admin.GetAsync("/api/v1/admin/backups")).ReadAsync<List<BackupDto>>()).Count.ShouldBe(2);
    }
}
