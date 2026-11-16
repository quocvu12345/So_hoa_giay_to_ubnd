using System.Collections.Concurrent;
using HoSoSo.Api.IntegrationTests.Support;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Serilog.Core;
using Serilog.Events;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-03: mỗi request một dòng http_request có correlationId, userSubject, elapsedMs; không ghi chuỗi truy vấn; request chậm có slow_request.</summary>
public sealed class LoggingTests(LoggingTests.LoggingFactory api) : IClassFixture<LoggingTests.LoggingFactory>
{
    public sealed class CapturingSink : ILogEventSink
    {
        public ConcurrentQueue<LogEvent> Events { get; } = new();
        public void Emit(LogEvent logEvent) => Events.Enqueue(logEvent);
    }

    /// <summary>Hạ ngưỡng chậm xuống 0 ms để request nào cũng bị coi là chậm, và bật mức Information cho log HTTP.</summary>
    public sealed class LoggingFactory : DbApiFactory
    {
        public CapturingSink Sink { get; } = new();

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseSetting("Serilog:MinimumLevel:Override:Serilog.AspNetCore.RequestLoggingMiddleware", "Information");
            builder.UseSetting("Observability:SlowRequestMs", "0");
            builder.ConfigureServices(services => services.AddSingleton<ILogEventSink>(Sink));
        }
    }

    private static string? Text(LogEvent e, string name) =>
        e.Properties.TryGetValue(name, out var value) && value is ScalarValue { Value: not null } s ? s.Value.ToString() : null;

    private List<LogEvent> Matching(string message, string correlationId) =>
        api.Sink.Events.Where(e => e.MessageTemplate.Text.StartsWith(message, StringComparison.Ordinal) && Text(e, "correlationId") == correlationId).ToList();

    [Fact]
    public async Task Mot_request_tao_dung_mot_dong_http_request_day_du_truong_va_khong_co_chuoi_truy_van()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var correlationId = "log-" + Guid.NewGuid().ToString("N")[..12];
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/search?q=tu-khoa-nhay-cam-12345&kind=documents");
        request.Headers.Add("X-Correlation-Id", correlationId);
        (await http.SendAsync(request, TestContext.Current.CancellationToken)).IsSuccessStatusCode.ShouldBeTrue();

        var lines = Matching("http_request", correlationId);
        lines.Count.ShouldBe(1);
        var line = lines[0];
        Text(line, "method").ShouldBe("GET");
        Text(line, "path").ShouldBe("/api/v1/search");
        Text(line, "status").ShouldBe("200");
        long.Parse(Text(line, "elapsedMs")!).ShouldBeGreaterThanOrEqualTo(0);
        Guid.TryParse(Text(line, "userSubject"), out _).ShouldBeTrue("userSubject là mã người dùng");
        Guid.TryParse(Text(line, "assignment"), out _).ShouldBeTrue("assignment là mã phân công");

        // Từ khóa tra cứu có thể là tên người hay số định danh: không dòng log nào của request được chứa nó.
        api.Sink.Events.Where(e => Text(e, "correlationId") == correlationId)
            .Select(e => e.RenderMessage() + string.Join("|", e.Properties.Values.Select(v => v.ToString())))
            .ShouldAllBe(s => !s.Contains("tu-khoa-nhay-cam-12345"));
    }

    [Fact]
    public async Task Request_vuot_nguong_co_them_dong_slow_request_muc_Warning()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var correlationId = "slow-" + Guid.NewGuid().ToString("N")[..12];
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/dossiers");
        request.Headers.Add("X-Correlation-Id", correlationId);
        await http.SendAsync(request, TestContext.Current.CancellationToken);

        var slow = Matching("slow_request", correlationId).ShouldHaveSingleItem();
        slow.Level.ShouldBe(LogEventLevel.Warning);
        Text(slow, "path").ShouldBe("/api/v1/dossiers");
        long.Parse(Text(slow, "elapsedMs")!).ShouldBeGreaterThanOrEqualTo(0);
        Guid.TryParse(Text(slow, "userSubject"), out _).ShouldBeTrue("dòng chậm cũng mang userSubject");
    }

    [Fact]
    public async Task Request_chua_dang_nhap_van_co_dong_log_khong_co_userSubject()
    {
        var http = api.CreateClient();
        var correlationId = "anon-" + Guid.NewGuid().ToString("N")[..12];
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/dossiers");
        request.Headers.Add("X-Correlation-Id", correlationId);
        (await http.SendAsync(request, TestContext.Current.CancellationToken)).StatusCode.ShouldBe(System.Net.HttpStatusCode.Unauthorized);

        var line = Matching("http_request", correlationId).ShouldHaveSingleItem();
        Text(line, "status").ShouldBe("401");
        Text(line, "userSubject").ShouldBeNull();
    }
}
