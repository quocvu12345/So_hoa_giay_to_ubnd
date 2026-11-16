using System.Net;
using System.Net.Http.Json;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Infrastructure.Messaging;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-89: script sao lưu báo kết quả bằng khóa máy; trạng thái quá hạn, lỗi, treo, diễn tập khôi phục; cảnh báo cho quản trị kỹ thuật.</summary>
public sealed class BackupMonitoringTests(BackupMonitoringTests.BackupFactory api) : IClassFixture<BackupMonitoringTests.BackupFactory>
{
    public const string Token = "khoa-may-thu-nghiem-0123456789-abcdefghij";

    public sealed class BackupFactory : DbApiFactory
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseSetting("Backup:IngestToken", Token);
            builder.UseSetting("Limits:OpsRequestsPerMinute", "1000");     // các test gọi liên tục; test giới hạn dùng host riêng
        }
    }

    private sealed record BackupDto(Guid Id, string Kind, string Status, DateTimeOffset StartedAt, DateTimeOffset? FinishedAt, long? ByteSize, string? Location, DateTimeOffset? RestoreTestedAt, string Note);
    private sealed record KindStatus(string Kind, bool Required, DateTimeOffset? LastSuccessAt, double? AgeHours, bool Overdue, string? LastRunStatus);
    private sealed record Status(bool Healthy, List<KindStatus> Kinds, DateTimeOffset? LastRestoreTestedAt, bool RestoreTestOverdue, List<string> Problems);

    private async Task ResetAsync()
    {
        api.RequireDatabase();
        await api.ExecuteAsync("DELETE FROM hoso.backup_runs");
        await api.ExecuteAsync("DELETE FROM hoso.notifications WHERE kind = 'backup.alert'");
    }

    private static HttpRequestMessage Machine(HttpMethod method, string url, object? body = null, string? token = Token)
    {
        var request = new HttpRequestMessage(method, url);
        if (token is not null) request.Headers.Add("X-Backup-Token", token);
        if (body is not null) request.Content = JsonContent.Create(body, options: DbApiFactory.Json);
        return request;
    }

    /// <summary>Ghi một lần sao lưu thành công qua đường khóa máy, rồi lùi thời điểm kết thúc về <paramref name="hoursAgo"/> giờ trước.</summary>
    private async Task<BackupDto> SucceededAsync(string kind, double hoursAgo)
    {
        var http = api.CreateClient();
        var started = DateTimeOffset.UtcNow.AddHours(-hoursAgo - 0.1);
        var run = await (await http.SendAsync(Machine(HttpMethod.Post, "/api/v1/ops/backups",
            new { kind, status = "succeeded", startedAt = started, finishedAt = started.AddMinutes(5), byteSize = 1000, location = "s3://sao-luu/" + kind }), TestContext.Current.CancellationToken)).ReadAsync<BackupDto>();
        return run;
    }

    private async Task<Status> StatusAsync()
    {
        var admin = await api.LoginAsync("demo_admin");
        return await (await admin.GetAsync("/api/v1/admin/backups/status")).ReadAsync<Status>();
    }

    [Fact]
    public async Task Endpoint_khoa_may_tu_choi_khi_thieu_hoac_sai_khoa_va_khong_nhan_cookie_phien()
    {
        await ResetAsync();
        var http = api.CreateClient();
        var body = new { kind = "database", status = "running" };
        (await http.SendAsync(Machine(HttpMethod.Post, "/api/v1/ops/backups", body, token: null), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await http.SendAsync(Machine(HttpMethod.Post, "/api/v1/ops/backups", body, token: Token[..^1] + "X"), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);

        // Quản trị đã đăng nhập (cookie hợp lệ) mà không có khóa máy vẫn bị từ chối: đường này không tin cookie.
        var admin = await api.LoginAsync("demo_admin");
        (await admin.PostJsonAsync("/api/v1/ops/backups", body)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.backup_runs")).ShouldBe(0);

        // Khóa đúng thì ghi được, không cần cookie hay header X-CSRF.
        var ok = await http.SendAsync(Machine(HttpMethod.Post, "/api/v1/ops/backups", body), TestContext.Current.CancellationToken);
        ok.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.backup_runs")).ShouldBe(1);
    }

    [Fact]
    public async Task Doan_khoa_bang_cach_thu_lien_tuc_bi_gioi_han_toc_do()
    {
        api.RequireDatabase();
        await using var limited = api.WithWebHostBuilder(b => b.UseSetting("Limits:OpsRequestsPerMinute", "5"));
        var http = limited.CreateClient();
        var codes = new List<HttpStatusCode>();
        for (var i = 0; i < 8; i++)
            codes.Add((await http.SendAsync(Machine(HttpMethod.Post, "/api/v1/ops/backups", new { kind = "database", status = "running" }, token: "doan-sai-" + i), TestContext.Current.CancellationToken)).StatusCode);
        codes.Take(5).ShouldAllBe(c => c == HttpStatusCode.Unauthorized);
        codes.Skip(5).ShouldAllBe(c => c == HttpStatusCode.TooManyRequests, "sau 5 lần sai trong một phút là bị chặn 429");
    }

    [Fact]
    public async Task Chua_cau_hinh_khoa_may_thi_endpoint_tra_404()
    {
        api.RequireDatabase();
        await using var disabled = api.WithWebHostBuilder(b => b.UseSetting("Backup:IngestToken", ""));
        var response = await disabled.CreateClient().SendAsync(Machine(HttpMethod.Post, "/api/v1/ops/backups", new { kind = "database", status = "running" }), TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);

        await using var tooShort = api.WithWebHostBuilder(b => b.UseSetting("Backup:IngestToken", "ngan"));
        (await tooShort.CreateClient().SendAsync(Machine(HttpMethod.Post, "/api/v1/ops/backups", new { kind = "database", status = "running" }, "ngan"), TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Script_ghi_dang_chay_roi_bao_ket_thuc_va_ket_qua_da_chot_khong_doi_lai_duoc()
    {
        await ResetAsync();
        var http = api.CreateClient();
        var running = await (await http.SendAsync(Machine(HttpMethod.Post, "/api/v1/ops/backups", new { kind = "database", status = "running" }), TestContext.Current.CancellationToken)).ReadAsync<BackupDto>();
        running.Status.ShouldBe("running");

        var finished = await (await http.SendAsync(Machine(HttpMethod.Patch, $"/api/v1/ops/backups/{running.Id}",
            new { status = "succeeded", byteSize = 9_999_999, location = "s3://sao-luu/hoso.dump" }), TestContext.Current.CancellationToken)).ReadAsync<BackupDto>();
        (finished.Status, finished.ByteSize, finished.Location).ShouldBe(("succeeded", 9_999_999, "s3://sao-luu/hoso.dump"));
        finished.FinishedAt.ShouldNotBeNull();

        var again = await http.SendAsync(Machine(HttpMethod.Patch, $"/api/v1/ops/backups/{running.Id}", new { status = "failed" }), TestContext.Current.CancellationToken);
        again.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await api.ScalarAsync<string>("SELECT status FROM hoso.backup_runs WHERE id = $1", running.Id)).ShouldBe("succeeded");

        (await http.SendAsync(Machine(HttpMethod.Patch, $"/api/v1/ops/backups/{Guid.NewGuid()}", new { note = "x" }), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var invalid = await http.SendAsync(Machine(HttpMethod.Patch, $"/api/v1/ops/backups/{running.Id}", new { byteSize = -5 }), TestContext.Current.CancellationToken);
        invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Chua_co_ban_sao_luu_nao_thi_khong_on_nhung_chua_nhac_dien_tap_vi_he_thong_con_moi()
    {
        await ResetAsync();
        var status = await StatusAsync();
        status.Healthy.ShouldBeFalse();
        status.Problems.ShouldContain("Chưa có bản sao lưu cơ sở dữ liệu nào thành công.");
        status.Problems.ShouldContain("Chưa có bản sao lưu kho tệp nào thành công.");
        status.Kinds.Single(k => k.Kind == "config").Required.ShouldBeFalse();
        status.RestoreTestOverdue.ShouldBeFalse("chưa có bản sao lưu nào thì chưa thể đòi diễn tập");
    }

    [Fact]
    public async Task Du_hai_loai_trong_han_thi_on_va_qua_26_gio_thi_canh_bao()
    {
        await ResetAsync();
        await SucceededAsync("database", hoursAgo: 3);
        await SucceededAsync("files", hoursAgo: 5);
        var healthy = await StatusAsync();
        healthy.Healthy.ShouldBeTrue(string.Join("; ", healthy.Problems));
        healthy.Kinds.Single(k => k.Kind == "database").AgeHours.ShouldNotBeNull().ShouldBeInRange(2.5, 3.5);

        await ResetAsync();
        await SucceededAsync("database", hoursAgo: 30);
        await SucceededAsync("files", hoursAgo: 2);
        var late = await StatusAsync();
        late.Healthy.ShouldBeFalse();
        late.Kinds.Single(k => k.Kind == "database").Overdue.ShouldBeTrue();
        late.Kinds.Single(k => k.Kind == "files").Overdue.ShouldBeFalse();
        late.Problems.Single().ShouldContain("cơ sở dữ liệu thành công gần nhất cách 30 giờ (ngưỡng 26 giờ)");
    }

    [Fact]
    public async Task Lan_chay_gan_nhat_that_bai_hoac_treo_la_van_de_ke_ca_khi_ban_cu_van_trong_han()
    {
        await ResetAsync();
        await SucceededAsync("database", hoursAgo: 20);
        await SucceededAsync("files", hoursAgo: 20);
        var http = api.CreateClient();
        // Lần chạy mới nhất của cơ sở dữ liệu báo lỗi; lần của kho tệp bắt đầu 13 giờ trước vẫn đang chạy.
        await http.SendAsync(Machine(HttpMethod.Post, "/api/v1/ops/backups", new { kind = "database", status = "failed", finishedAt = DateTimeOffset.UtcNow, note = "pg_dump: hết dung lượng đĩa" }), TestContext.Current.CancellationToken);
        await http.SendAsync(Machine(HttpMethod.Post, "/api/v1/ops/backups", new { kind = "files", status = "running", startedAt = DateTimeOffset.UtcNow.AddHours(-13) }), TestContext.Current.CancellationToken);

        var status = await StatusAsync();
        status.Healthy.ShouldBeFalse();
        status.Problems.ShouldContain(p => p.Contains("Lần sao lưu cơ sở dữ liệu gần nhất thất bại: pg_dump: hết dung lượng đĩa"));
        status.Problems.ShouldContain(p => p.Contains("Lần sao lưu kho tệp bắt đầu từ") && p.Contains("vẫn chưa kết thúc"));
        status.Kinds.Single(k => k.Kind == "database").Overdue.ShouldBeFalse("bản thành công cũ vẫn trong 26 giờ; vấn đề là lần chạy mới nhất lỗi");
    }

    [Fact]
    public async Task Qua_100_ngay_chua_dien_tap_khoi_phuc_thi_nhac_va_ghi_nhan_dien_tap_thi_het_nhac()
    {
        await ResetAsync();
        var old = await SucceededAsync("database", hoursAgo: 120 * 24);
        await SucceededAsync("database", hoursAgo: 2);
        await SucceededAsync("files", hoursAgo: 2);
        var overdue = await StatusAsync();
        overdue.RestoreTestOverdue.ShouldBeTrue();
        overdue.Problems.ShouldContain(p => p.Contains("Chưa từng diễn tập khôi phục"));

        var admin = await api.LoginAsync("demo_admin");
        var tested = await (await admin.PostJsonAsync($"/api/v1/admin/backups/{old.Id}/restore-test", new { note = "Khôi phục thử sang máy phụ, đủ 3 hồ sơ mẫu" })).ReadAsync<BackupDto>();
        tested.RestoreTestedAt.ShouldNotBeNull();
        tested.Note.ShouldContain("Diễn tập khôi phục: Khôi phục thử sang máy phụ");
        var after = await StatusAsync();
        after.RestoreTestOverdue.ShouldBeFalse();
        after.Healthy.ShouldBeTrue(string.Join("; ", after.Problems));

        // Chỉ bản đã thành công mới ghi được diễn tập.
        var failed = await (await api.CreateClient().SendAsync(Machine(HttpMethod.Post, "/api/v1/ops/backups", new { kind = "files", status = "failed", finishedAt = DateTimeOffset.UtcNow }), TestContext.Current.CancellationToken)).ReadAsync<BackupDto>();
        (await admin.PostJsonAsync($"/api/v1/admin/backups/{failed.Id}/restore-test", new { })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Dich_vu_nen_bao_quan_tri_ky_thuat_mot_lan_moi_noi_dung_va_khong_bao_khi_on()
    {
        await ResetAsync();
        var service = api.Services.GetServices<IHostedService>().OfType<BackupWatchdogService>().Single();
        var admins = await api.ScalarAsync<long>("""
            SELECT count(DISTINCT u.id) FROM hoso.users u JOIN hoso.user_roles ur ON ur.user_id = u.id
            WHERE u.active AND ur.role_code = 'technical_admin' AND ur.valid_from <= now() AND (ur.valid_until IS NULL OR ur.valid_until > now())
            """);
        admins.ShouldBeGreaterThan(0);

        (await service.RunOnceAsync(TestContext.Current.CancellationToken)).ShouldBe((int)admins, "chưa có bản sao lưu nào: mỗi quản trị kỹ thuật một thông báo");
        (await service.RunOnceAsync(TestContext.Current.CancellationToken)).ShouldBe(0, "cùng nội dung trong 24 giờ không báo lại");
        var note = await api.ScalarAsync<string>("SELECT body FROM hoso.notifications WHERE kind = 'backup.alert' LIMIT 1");
        note.ShouldNotBeNull().ShouldContain("Chưa có bản sao lưu cơ sở dữ liệu");
        (await api.ScalarAsync<string>("SELECT link FROM hoso.notifications WHERE kind = 'backup.alert' LIMIT 1")).ShouldBe("/quan-tri/van-hanh");

        // Nội dung đổi (thêm một lần lỗi) thì báo ngay.
        await SucceededAsync("files", hoursAgo: 1);
        (await service.RunOnceAsync(TestContext.Current.CancellationToken)).ShouldBe((int)admins, "nội dung khác nên báo lại");

        // Ổn rồi thì không báo thêm.
        await SucceededAsync("database", hoursAgo: 1);
        var before = await api.ScalarAsync<long>("SELECT count(*) FROM hoso.notifications WHERE kind = 'backup.alert'");
        (await service.RunOnceAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.notifications WHERE kind = 'backup.alert'")).ShouldBe(before);

        // Chỉ quản trị kỹ thuật nhận; văn thư không nhận.
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.notifications n JOIN hoso.users u ON u.id = n.user_id WHERE n.kind = 'backup.alert' AND u.username = 'demo_clerk_ubnd'")).ShouldBe(0);
    }
}
