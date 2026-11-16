using System.Diagnostics;
using System.Security.Claims;
using HoSoSo.Api.Endpoints;
using HoSoSo.Api.Configuration;
using HoSoSo.Api.Errors;
using HoSoSo.Api.Middleware;
using HoSoSo.Api.Observability;
using HoSoSo.Application;
using HoSoSo.Infrastructure;
using HoSoSo.Infrastructure.Migrations;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Scalar.AspNetCore;
using Serilog;
using Serilog.Events;

// BE-93: tiến trình con của sandbox PDF. Chạy trước mọi khởi tạo khác (không dựng máy chủ web, không đọc cấu hình, không kết nối CSDL).
if (args is ["pdf-sandbox", ..])
{
    return await HoSoSo.Infrastructure.Pdf.PdfSandboxHost.RunAsync(args[1..], Console.OpenStandardInput(), Console.OpenStandardOutput(), Console.Error);
}

using var bootstrapLog = ObservabilitySetup.CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);
    // BE-96: cấu hình an toàn riêng cho Production (lỗi thì không khởi động, cảnh báo thì ghi log).
    var production = ProductionSafety.Check(builder.Configuration, builder.Environment);
    foreach (var warning in production.Warnings) bootstrapLog.Warning("production_config_warning {Detail}", warning);
    if (production.Errors.Count > 0)
        throw new InvalidOperationException("Cấu hình chưa an toàn để chạy Production:" + Environment.NewLine + " - " + string.Join(Environment.NewLine + " - ", production.Errors));
    builder.AddHoSoObservability();
    builder.Services.AddHoSoApplication();
    builder.Services.AddHoSoInfrastructure(builder.Configuration);
    builder.Services.AddHoSoSecurity(builder.Configuration, builder.Environment);
    builder.Services.AddHoSoErrorHandling();
    // BE-19: mặc định 1 MB cho mọi request ghi; riêng endpoint tải PDF được nâng bằng RequestSizeLimit (Limits:UploadMaxBytes).
    var uploadMax = builder.Configuration.GetValue("Limits:UploadMaxBytes", 200L * 1024 * 1024);
    builder.WebHost.ConfigureKestrel(kestrel => kestrel.Limits.MaxRequestBodySize = builder.Configuration.GetValue("Limits:DefaultMaxBodyBytes", 1L * 1024 * 1024));
    builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(form => form.MultipartBodyLengthLimit = uploadMax);
    builder.Services.AddHoSoOpenApi();

    var app = builder.Build();

    // dotnet HoSoSo.Api.dll migrate → chạy migration SQL rồi thoát (ADR-03).
    if (args.Contains("migrate", StringComparer.OrdinalIgnoreCase))
    {
        // --baseline 000,001,002,003,007: chỉ đánh dấu các script đã chạy từ trước (CSDL cài bằng install.sql), không chạy chúng.
        var baselineIndex = Array.FindIndex(args, a => a.Equals("--baseline", StringComparison.OrdinalIgnoreCase));
        var baseline = baselineIndex >= 0 && baselineIndex + 1 < args.Length ? args[baselineIndex + 1].Split(',', StringSplitOptions.RemoveEmptyEntries) : null;
        var report = app.Services.MigrateDatabase(dryRun: args.Contains("--dry-run", StringComparer.OrdinalIgnoreCase), baseline);
        Console.WriteLine(baseline is not null ? $"Đã đánh dấu {report.Scripts.Count} script là đã chạy: {string.Join(", ", report.Scripts)}"
            : report.DryRun ? $"Sẽ chạy {report.Scripts.Count} script: {string.Join(", ", report.Scripts)}" : $"Đã chạy {report.Scripts.Count} script.");
        return 0;
    }

    app.UseForwardedHeaders();
    app.UseMiddleware<CorrelationIdMiddleware>();
    app.UseSerilogRequestLogging(options =>
    {
        // Tên trường theo docs/06-log-va-giam-sat.md: method, path (không có chuỗi truy vấn), status, elapsedMs.
        // Mặc định middleware ghi qua logger TĨNH Log.Logger; host dùng preserveStaticLogger nên logger đó im lặng → phải gắn logger của host.
        options.Logger = app.Services.GetRequiredService<Serilog.ILogger>();
        options.MessageTemplate = "http_request {method} {path} {status} {elapsedMs} ms";
        options.GetLevel = (http, elapsedMs, exception) =>
            exception is not null || http.Response.StatusCode >= 500 ? LogEventLevel.Error : LogEventLevel.Information;
        options.EnrichDiagnosticContext = (diagnostics, http) =>
        {
            diagnostics.Set("method", http.Request.Method);
            diagnostics.Set("path", http.Request.Path.Value);
            diagnostics.Set("status", http.Response.StatusCode);
            diagnostics.Set("elapsedMs", http.Items.TryGetValue(CorrelationIdMiddleware.StartedKey, out var started) && started is long ticks
                ? (long)Stopwatch.GetElapsedTime(ticks).TotalMilliseconds
                : -1L);
            diagnostics.Set("userSubject", http.User.FindFirstValue(HoSoClaims.Subject));
            diagnostics.Set("assignment", http.User.FindFirstValue(HoSoClaims.Assignment));
        };
    });
    app.UseMiddleware<SecurityHeadersMiddleware>();
    app.UseExceptionHandler();
    app.UseStatusCodePages();
    app.UseAuthentication();
    app.UseMiddleware<ActiveAssignmentMiddleware>();
    app.UseMiddleware<RequestLogContextMiddleware>();
    app.UseMiddleware<CsrfMiddleware>();
    app.UseRateLimiter();
    app.UseAuthorization();

    if (app.Environment.IsDevelopment())
    {
        app.MapOpenApi().AllowAnonymous();
        app.MapScalarApiReference("/docs").AllowAnonymous();
    }
    app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();
    app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") }).AllowAnonymous();
    app.MapHoSoApi();

    await app.RunAsync();
    return 0;
}
catch (Exception exception) when (exception is not HostAbortedException)
{
    bootstrapLog.Fatal(exception, "api_start_failed");
    return 1;
}
finally
{
    // Logger của host do host tự đóng; không đóng Log.Logger tĩnh dùng chung giữa các host (xem ObservabilitySetup).
}

/// <summary>Cho WebApplicationFactory trong kiểm thử tích hợp.</summary>
public partial class Program
{
}
