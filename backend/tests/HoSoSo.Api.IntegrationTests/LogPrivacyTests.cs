using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using HoSoSo.Api.IntegrationTests.Support;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Serilog.Core;
using Serilog.Events;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>
/// SEC-07: log không chứa dữ liệu cá nhân hay nội dung giấy tờ (docs/05-bao-mat.md, 06-log-va-giam-sat.md). Chạy một chuỗi thao tác có "chuỗi mồi"
/// trong tên hồ sơ, tên tệp, từ khóa tìm, ghi chú, email, số định danh, văn bản OCR, giá trị cài đặt... ở mức log chi tiết nhất (kể cả câu lệnh SQL của EF),
/// rồi quét toàn bộ log (thông điệp, mọi thuộc tính, ngoại lệ) tìm các chuỗi mồi đó.
/// </summary>
public sealed class LogPrivacyTests(LogPrivacyTests.VerboseFactory api) : IClassFixture<LogPrivacyTests.VerboseFactory>
{
    public sealed class CapturingSink : ILogEventSink
    {
        public ConcurrentQueue<LogEvent> Events { get; } = new();
        public void Emit(LogEvent logEvent) => Events.Enqueue(logEvent);
    }

    /// <summary>Mức Debug cho mọi thứ và EF in câu lệnh SQL: tình huống xấu nhất khi bật chẩn đoán ở máy thật.</summary>
    public sealed class VerboseFactory : DbApiFactory
    {
        public CapturingSink Sink { get; } = new();

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseSetting("Serilog:MinimumLevel:Default", "Debug");
            builder.UseSetting("Serilog:MinimumLevel:Override:Microsoft.EntityFrameworkCore.Database.Command", "Debug");
            builder.UseSetting("Serilog:MinimumLevel:Override:Microsoft.AspNetCore", "Debug");
            builder.UseSetting("Serilog:MinimumLevel:Override:Npgsql", "Debug");
            builder.ConfigureServices(services =>
            {
                services.AddSingleton<ILogEventSink>(Sink);
                // Đường dẫn chỉ có trong kiểm thử: ném lỗi PostgreSQL không ánh xạ kèm DETAIL chứa dữ liệu cá nhân (như lỗi trùng khóa thật có "Key (email)=(...)").
                services.AddSingleton<Microsoft.AspNetCore.Hosting.IStartupFilter, RaiseWithDetailFilter>();
            });
        }
    }

    private sealed class RaiseWithDetailFilter : Microsoft.AspNetCore.Hosting.IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            next(app);
            app.Use(async (context, nextMiddleware) =>
            {
                if (!context.Request.Path.StartsWithSegments("/__test/raise-detail")) { await nextMiddleware(context); return; }
                var data = context.RequestServices.GetRequiredService<NpgsqlDataSource>();
                await using var command = data.CreateCommand($"DO $$ BEGIN RAISE EXCEPTION 'loi-thu' USING ERRCODE = 'XX000', DETAIL = 'Key (email)=({Canary.Email}) already exists.'; END $$");
                await command.ExecuteNonQueryAsync(context.RequestAborted);
            });
        };
    }

    private static class Canary
    {
        public const string Title = "TieuDeHoSo-NguyenVanCanary-8471";
        public const string FileName = "CCCD-079123456789-CanaryFile.pdf";
        public const string CitizenId = "079123456789";
        public const string Search = "tukhoa-canary-5512";
        public const string Note = "ghi-chu-canary-7788-benh-an";
        public const string Email = "nguoi.canary-3391@example.test";
        public const string DisplayName = "Tran Thi Canary 6620";
        public const string Ocr = "Ho ten Le Van Canary 9034 so dinh danh 079987654321";
        public const string SettingValue = "gia-tri-cai-dat-canary-2255";
    }

    private static readonly string[] AllCanaries =
    [
        Canary.Title, Canary.FileName, Canary.CitizenId, Canary.Search, Canary.Note, Canary.Email, Canary.DisplayName, "Canary 9034", "079987654321", Canary.SettingValue,
    ];

    private static string Everything(LogEvent e) =>
        e.RenderMessage() + "\n" + string.Join("\n", e.Properties.Select(p => $"{p.Key}={p.Value}")) + "\n" + e.Exception;

    [Fact]
    public async Task Log_o_muc_chi_tiet_nhat_khong_chua_noi_dung_giay_to_hay_du_lieu_ca_nhan()
    {
        var clerk = await api.LoginAsync("demo_cv_ht");
        var admin = await api.LoginAsync("demo_admin");

        // 1. Tải PDF có tên tệp chứa số định danh; tải lại (trùng) để đi qua đường lỗi 409.
        var pdf = Encoding.ASCII.GetBytes($"%PDF-1.4\n% {Guid.NewGuid():N}\n%%EOF\n");
        async Task<HttpResponseMessage> Upload()
        {
            var form = new MultipartFormDataContent { { new ByteArrayContent(pdf) { Headers = { ContentType = new MediaTypeHeaderValue("application/pdf") } }, "file", Canary.FileName } };
            return await clerk.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken);
        }
        var upload = await (await Upload()).ReadAsync<UploadDto>();
        (await Upload()).StatusCode.ShouldBe(HttpStatusCode.Conflict);

        // 2. Văn bản OCR có họ tên và số định danh; tìm theo từ khóa trên chuỗi truy vấn và theo nội dung OCR.
        await api.ExecuteAsync("UPDATE hoso.ocr_jobs SET status='completed', started_at=now(), finished_at=now(), page_count=1, processed_pages=1 WHERE id=$1", upload.JobId);
        await api.ExecuteAsync("INSERT INTO hoso.ocr_pages(job_id, page_no, method, text, status) VALUES ($1, 1, 'ocr', $2, 'completed')", upload.JobId, Canary.Ocr);
        (await clerk.GetAsync($"/api/v1/search?q={Uri.EscapeDataString(Canary.Search)}")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await clerk.GetAsync($"/api/v1/search?q={Uri.EscapeDataString("Le Van Canary 9034")}&kind=documents")).StatusCode.ShouldBe(HttpStatusCode.OK);

        // 3. Hồ sơ có tên chứa họ tên; xếp giấy tờ, gửi duyệt khi chưa đủ (422) kèm ghi chú nhạy cảm; sửa với phiên bản sai (409).
        var dossier = await (await clerk.PostJsonAsync("/api/v1/dossiers", new { title = Canary.Title, workGroupCode = "U15", notes = Canary.Note })).ReadAsync<DossierDetailDto>();
        await clerk.PostJsonAsync($"/api/v1/dossiers/{dossier.Id}/documents", new { documentId = upload.DocumentId });
        (await clerk.PostJsonAsync($"/api/v1/dossiers/{dossier.Id}/transitions", new { action = "submit", note = Canary.Note })).StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await clerk.PatchJsonAsync($"/api/v1/dossiers/{dossier.Id}", new { version = 1, notes = Canary.Note })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await clerk.PostJsonAsync("/api/v1/dossiers", new { title = "x", workGroupCode = "U15", notes = Canary.Note })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);   // lỗi kiểm tra đầu vào

        // 4. Quản trị tạo người dùng có email và họ tên; tạo trùng (409); đổi cài đặt có giá trị.
        var created = await admin.PostJsonAsync("/api/v1/admin/users", new { username = "canary_user", displayName = Canary.DisplayName, email = Canary.Email });
        created.StatusCode.ShouldBe(HttpStatusCode.Created);
        (await admin.PostJsonAsync("/api/v1/admin/users", new { username = "canary_user", displayName = Canary.DisplayName, email = Canary.Email })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await admin.PatchJsonAsync("/api/v1/admin/settings", new { key = "tuy_chon.thu", value = Canary.SettingValue })).StatusCode.ShouldBe(HttpStatusCode.OK);

        // 5. Lỗi hệ thống (5xx) mà PostgreSQL kèm DETAIL có email: nhật ký lỗi và báo lỗi không được chép lại DETAIL.
        (await clerk.GetAsync("/__test/raise-detail")).StatusCode.ShouldBe(HttpStatusCode.InternalServerError);

        // Quét toàn bộ log.
        var events = api.Sink.Events.ToList();
        events.Count.ShouldBeGreaterThan(50, "phải bắt được log chi tiết (HTTP, EF, Npgsql), nếu không test này vô nghĩa");
        events.ShouldContain(e => e.MessageTemplate.Text.StartsWith("http_request", StringComparison.Ordinal), "có dòng log HTTP");
        events.ShouldContain(e => Everything(e).Contains("INSERT", StringComparison.Ordinal), "có câu lệnh SQL của EF ở mức Debug");
        events.ShouldContain(e => e.Level == LogEventLevel.Error, "có dòng lỗi 5xx để kiểm đường ngoại lệ");

        var leaks = events.SelectMany(e => AllCanaries.Where(c => Everything(e).Contains(c, StringComparison.OrdinalIgnoreCase)).Select(c => $"«{c}» trong: {e.MessageTemplate.Text}")).Distinct().ToList();
        leaks.ShouldBeEmpty("log lộ dữ liệu cá nhân hoặc nội dung giấy tờ:\n" + string.Join("\n", leaks));
    }
}
