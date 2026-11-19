using System.Net;
using System.Net.Http.Headers;
using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>
/// AI-24, BE-133: worker tự ghi trạng thái vào ai_workers (migration 044); API phân biệt máy AI đang đọc được · worker sống nhưng máy chạy mô hình
/// (Ollama ở máy khác) không trả lời · không còn worker nào. Người dùng chỉ thấy trạng thái và thời điểm; chi tiết kỹ thuật chỉ ở trang vận hành.
/// </summary>
public sealed class AiAvailabilityTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record Availability(string State, DateTimeOffset? Since);
    private sealed record Machine(string WorkerId, string Profile, string? Engine, bool EngineOk, string? EngineError, DateTimeOffset? EngineDownSince,
        Guid? CurrentJobId, int LastSeenSecondsAgo, bool Alive);
    private sealed record AiStatusDto(Availability Availability, List<Machine> Machines);

    private async Task ResetAsync()
    {
        api.RequireDatabase();
        await api.ExecuteAsync("DELETE FROM hoso.ai_workers");
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status = 'cancelled', locked_by = NULL, started_at = coalesce(started_at, now()), finished_at = now() " +
                               "WHERE status IN ('queued', 'running')");
    }

    private Task WorkerAsync(string id, bool engineOk, string lastSeen = "now()", string? downSince = null) =>
        api.ExecuteAsync(
            "INSERT INTO hoso.ai_workers (worker_id, profile, engine, engine_ok, engine_error, engine_down_since, last_seen_at) " +
            $"VALUES ($1, 'ollama', 'Ollama http://100.78.102.53:11434', $2, $3, {downSince ?? "NULL"}, {lastSeen})",
            id, engineOk, engineOk ? DBNull.Value : "Không gọi được Ollama ở http://100.78.102.53:11434: timed out");

    private static async Task QueueAsync(HttpClient http, string marker)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(System.Text.Encoding.ASCII.GetBytes($"%PDF-1.4\n% {marker}\ntrailer<<>>\n%%EOF\n"));
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", $"{marker}.pdf");
        (await http.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    private static async Task<Availability> GetAsync(HttpClient http) =>
        await (await http.GetAsync("/api/v1/ai/availability", TestContext.Current.CancellationToken)).ReadAsync<Availability>();

    private async Task<string> ReadyAsync() =>
        await (await api.CreateClient().GetAsync("/health/ready", TestContext.Current.CancellationToken)).Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

    [Fact]
    public async Task Chua_tung_co_worker_hoac_worker_im_lang_qua_2_phut_thi_bao_khong_co_worker()
    {
        await ResetAsync();
        var cv = await api.LoginAsync("demo_cv_ht");
        (await GetAsync(cv)).ShouldBe(new Availability("no_worker", null));

        await WorkerAsync("may-mac-1", engineOk: true, lastSeen: "now() - interval '10 minutes'");
        var stale = await GetAsync(cv);
        stale.State.ShouldBe("no_worker");
        stale.Since.ShouldNotBeNull().ShouldBeInRange(DateTimeOffset.UtcNow.AddMinutes(-11), DateTimeOffset.UtcNow.AddMinutes(-9), "lần cuối thấy worker");
    }

    [Fact]
    public async Task Worker_song_ma_may_chay_mo_hinh_khong_tra_loi_thi_bao_ro_va_health_degraded()
    {
        await ResetAsync();
        var cv = await api.LoginAsync("demo_cv_ht");
        await QueueAsync(cv, "cho-may-ai");
        await WorkerAsync("may-mac-1", engineOk: false, downSince: "now() - interval '5 minutes'");

        var state = await GetAsync(cv);
        state.State.ShouldBe("engine_down");
        state.Since.ShouldNotBeNull().ShouldBeInRange(DateTimeOffset.UtcNow.AddMinutes(-6), DateTimeOffset.UtcNow.AddMinutes(-4));
        var raw = await (await cv.GetAsync("/api/v1/ai/availability", TestContext.Current.CancellationToken)).Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.ShouldNotContain("100.78", customMessage: "người dùng thường không thấy địa chỉ máy hay thông điệp lỗi");

        (await ReadyAsync()).ShouldBe("Degraded", "có việc chờ mà máy AI không trả lời quá 2 phút");

        var admin = await api.LoginAsync("demo_admin");
        var ops = await (await admin.GetAsync("/api/v1/admin/ai/status", TestContext.Current.CancellationToken)).ReadAsync<AiStatusDto>();
        ops.Availability.State.ShouldBe("engine_down");
        var machine = ops.Machines.Single();
        (machine.WorkerId, machine.Engine, machine.EngineOk, machine.Alive).ShouldBe(("may-mac-1", "Ollama http://100.78.102.53:11434", false, true));
        machine.EngineError.ShouldNotBeNull().ShouldContain("timed out", customMessage: "quản trị thấy chi tiết để sửa");
    }

    [Fact]
    public async Task Con_mot_worker_doc_duoc_hoac_worker_cu_dang_giu_viec_thi_van_ok()
    {
        await ResetAsync();
        var cv = await api.LoginAsync("demo_cv_ht");
        await QueueAsync(cv, "con-may-tot");
        await WorkerAsync("may-mac-1", engineOk: false, downSince: "now() - interval '5 minutes'");
        await WorkerAsync("may-mac-2", engineOk: true);
        (await GetAsync(cv)).ShouldBe(new Availability("ok", null));
        (await ReadyAsync()).ShouldBe("Healthy");

        // Worker bản cũ (chưa ghi ai_workers) đang đọc với heartbeat mới: vẫn là đang hoạt động.
        await api.ExecuteAsync("DELETE FROM hoso.ai_workers");
        await QueueAsync(cv, "worker-cu");
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status = 'running', locked_by = 'worker-ban-cu', attempt = 1, started_at = now(), heartbeat_at = now() " +
                               "WHERE id = (SELECT id FROM hoso.ocr_jobs WHERE status = 'queued' ORDER BY created_at DESC LIMIT 1)");
        (await GetAsync(cv)).ShouldBe(new Availability("ok", null));
    }

    [Fact]
    public async Task May_ai_vua_doi_trang_thai_thi_bao_moi_nguoi_dang_mo_qua_SSE()
    {
        await ResetAsync();
        var cv = await api.LoginAsync("demo_cv_ht");
        var kt = await api.LoginAsync("demo_cv_kt");
        await using var a = await SseClient.ConnectAsync(cv);
        await using var b = await SseClient.ConnectAsync(kt);

        using var stop = new CancellationTokenSource();
        var pump = Task.Run(async () =>
        {
            // Kết nối LISTEN của máy chủ có thể chưa sẵn sàng lúc test vừa bắt đầu: báo lặp lại tới khi nhận được.
            while (!stop.IsCancellationRequested)
            {
                await api.ExecuteAsync("SELECT pg_notify('ai_worker_status', '{\"workerId\":\"may-mac-1\",\"engineOk\":false}')");
                await Task.Delay(300);
            }
        });
        try
        {
            var seenA = await a.WaitForAsync("ai.availability", TimeSpan.FromSeconds(15));
            await b.WaitForAsync("ai.availability", TimeSpan.FromSeconds(15));
            seenA.Data.ShouldNotContain("may-mac-1", customMessage: "không gửi chi tiết worker, giao diện tự hỏi lại /ai/availability");
        }
        finally
        {
            await stop.CancelAsync();
            await pump;
        }
    }

    [Fact]
    public async Task Chua_dang_nhap_thi_khong_hoi_duoc()
    {
        api.RequireDatabase();
        (await api.CreateClient().GetAsync("/api/v1/ai/availability", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}
