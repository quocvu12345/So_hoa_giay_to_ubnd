using Npgsql;
using OpenTelemetry;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;
using Serilog.Formatting.Compact;

namespace HoSoSo.Api.Observability;

/// <summary>
/// Log, trace, metric và báo lỗi (docs/06-log-va-giam-sat.md):
/// - Serilog ghi JSON một dòng ra stdout → Promtail/Vector gom về Loki.
/// - OpenTelemetry gửi trace/metric qua OTLP nếu có OpenTelemetry:OtlpEndpoint.
/// - GlitchTip (tương thích Sentry SDK, tự cài đặt tại cơ quan) nếu có ErrorTracking:Dsn.
/// Không gửi dữ liệu ra dịch vụ bên ngoài cơ quan.
/// </summary>
public static class ObservabilitySetup
{
    /// <summary>Logger riêng của tiến trình để ghi lỗi khởi động. KHÔNG gán vào Log.Logger tĩnh: nhiều host cùng chạy (kiểm thử) sẽ đóng logger của nhau.</summary>
    public static Serilog.Core.Logger CreateBootstrapLogger() =>
        new LoggerConfiguration()
            .MinimumLevel.Information()
            .Enrich.WithProperty("service", "hoso-api")
            .WriteTo.Console(new RenderedCompactJsonFormatter())
            .CreateLogger();

    public static WebApplicationBuilder AddHoSoObservability(this WebApplicationBuilder builder)
    {
        builder.Services.AddSerilog((services, logger) => logger
            .ReadFrom.Configuration(builder.Configuration)
            .ReadFrom.Services(services)
            // Cố định trong mã, không cho cấu hình hạ thấp: log mặc định của ASP.NET "Request starting/finished" in cả chuỗi truy vấn
            // (từ khóa tra cứu, mã QR...). Dòng http_request của hệ thống thay cho chúng và chỉ ghi đường dẫn (SEC-07).
            .MinimumLevel.Override("Microsoft.AspNetCore.Hosting.Diagnostics", Serilog.Events.LogEventLevel.Warning)
            .Enrich.FromLogContext()
            .Enrich.WithProperty("service", "hoso-api")
            .Enrich.WithProperty("env", builder.Environment.EnvironmentName)
            .WriteTo.Console(new RenderedCompactJsonFormatter()),
            preserveStaticLogger: true);

        var dsn = builder.Configuration["ErrorTracking:Dsn"];
        if (!string.IsNullOrWhiteSpace(dsn))
        {
            builder.WebHost.UseSentry(options =>
            {
                options.Dsn = dsn;
                options.Environment = builder.Configuration["ErrorTracking:Environment"] ?? builder.Environment.EnvironmentName;
                options.SendDefaultPii = false;     // không gửi cookie, IP, thân request
                options.MaxRequestBodySize = Sentry.Extensibility.RequestSize.None;
                options.TracesSampleRate = 0;       // trace đi qua OpenTelemetry, không qua GlitchTip
            });
        }

        var otlp = builder.Configuration["OpenTelemetry:OtlpEndpoint"];
        var telemetry = builder.Services.AddOpenTelemetry()
            .ConfigureResource(resource => resource.AddService("hoso-api"))
            .WithTracing(tracing => tracing
                .AddAspNetCoreInstrumentation(options => options.Filter = context => !context.Request.Path.StartsWithSegments("/health"))
                .AddHttpClientInstrumentation()
                .AddNpgsql())
            .WithMetrics(metrics => metrics
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddMeter("Npgsql")
                .AddMeter("HoSo.Backup")
                .AddMeter("HoSo.AccessLog"));
        if (!string.IsNullOrWhiteSpace(otlp))
        {
            telemetry.UseOtlpExporter(OpenTelemetry.Exporter.OtlpExportProtocol.Grpc, new Uri(otlp));
        }
        return builder;
    }
}
