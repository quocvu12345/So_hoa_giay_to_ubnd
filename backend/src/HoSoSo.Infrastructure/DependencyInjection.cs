using HoSoSo.Application.Common;
using HoSoSo.Application.Intake;
using HoSoSo.Infrastructure.Auditing;
using HoSoSo.Infrastructure.Health;
using HoSoSo.Infrastructure.Identity;
using HoSoSo.Infrastructure.Messaging;
using HoSoSo.Infrastructure.Persistence;
using HoSoSo.Infrastructure.Persistence.Interceptors;
using HoSoSo.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace HoSoSo.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddHoSoInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("HoSo");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("Thiếu ConnectionStrings:HoSo. Đặt biến môi trường ConnectionStrings__HoSo hoặc user-secrets (không ghi mật khẩu vào appsettings).");
        }

        var dataSourceBuilder = new NpgsqlDataSourceBuilder(connectionString);
        dataSourceBuilder.ConnectionStringBuilder.ApplicationName ??= "hoso-api";
        services.AddSingleton(dataSourceBuilder.Build());

        services.AddScoped<ActorContextInterceptor>();
        services.AddDbContext<HoSoDbContext>((provider, options) => options
            .UseNpgsql(provider.GetRequiredService<NpgsqlDataSource>())
            .UseSnakeCaseNamingConvention()
            // EF tự ghi mức Error cho mọi lệnh SQL lỗi, kể cả lỗi nghiệp vụ API đã chuyển thành 409/422 (trùng mã, khóa ngoại, HS00x):
            // nhật ký đầy Error giả, cảnh báo theo Error kêu oan. GlobalExceptionHandler đã ghi 5xx ở Error (bản đã che giá trị, SEC-07)
            // và 4xx ở Warning, nên ba sự kiện này hạ xuống Warning: lỗi thật vẫn có một dòng Error, không trùng.
            .ConfigureWarnings(w => w.Log(
                (RelationalEventId.CommandError, LogLevel.Warning),
                (CoreEventId.SaveChangesFailed, LogLevel.Warning),
                (CoreEventId.QueryIterationFailed, LogLevel.Warning)))
            .AddInterceptors(provider.GetRequiredService<ActorContextInterceptor>()));
        services.AddScoped<IHoSoDb>(provider => provider.GetRequiredService<HoSoDbContext>());
        services.AddScoped<IScopeFilter, ScopeFilter>();
        services.AddScoped<IIdentityService, IdentityService>();
        services.AddMemoryCache();

        services.AddSingleton<AccessEventQueue>();
        services.AddHostedService<AccessEventWriter>();
        services.AddSingleton<ErrorEventRecorder>();      // BE-117
        services.AddHostedService(p => p.GetRequiredService<ErrorEventRecorder>());

        services.AddOptions<StorageOptions>().Bind(configuration.GetSection("Storage"))
            .Validate(o => o.Provider is not null && (o.UsesS3 || string.Equals(o.Provider, "Local", StringComparison.OrdinalIgnoreCase)), "Storage:Provider chỉ nhận Local hoặc S3.")
            .Validate(o => !o.UsesS3 || !string.IsNullOrWhiteSpace(o.S3.Bucket), "Storage:S3:Bucket không được để trống khi Storage:Provider=S3.")
            .Validate(o => !o.UsesS3 || string.IsNullOrEmpty(o.S3.AccessKey) == string.IsNullOrEmpty(o.S3.SecretKey),
                "Storage:S3:AccessKey và Storage:S3:SecretKey phải đặt cùng nhau (hoặc cùng để trống để dùng vai trò IAM). Đặt SecretKey bằng biến môi trường Storage__S3__SecretKey.")
            .ValidateOnStart();
        // LocalFileStorage luôn có: kho chính khi Provider=Local, và là nơi giữ thư mục tạm (đóng gói, dọn tệp .part) khi Provider=S3.
        services.AddSingleton<LocalFileStorage>();
        if (configuration.GetSection("Storage").Get<StorageOptions>()?.UsesS3 == true)
        {
            services.AddSingleton<S3FileStorage>();
            services.AddSingleton<IFileStorage>(provider => provider.GetRequiredService<S3FileStorage>());
            services.AddSingleton<IStorageProbe>(provider => provider.GetRequiredService<S3FileStorage>());
        }
        else
        {
            services.AddSingleton<IFileStorage>(provider => provider.GetRequiredService<LocalFileStorage>());
        }
        services.AddOptions<HoSoSo.Infrastructure.Antivirus.AntivirusOptions>().Bind(configuration.GetSection("Antivirus"))
            .Validate(o => !o.Enabled || (!string.IsNullOrWhiteSpace(o.Host) && o.Port is > 0 and <= 65535), "Antivirus:Host và Antivirus:Port phải hợp lệ khi bật quét virus.")
            .Validate(o => o.TimeoutSeconds is >= 1 and <= 600, "Antivirus:TimeoutSeconds phải từ 1 đến 600.")
            .ValidateOnStart();
        services.AddSingleton<IVirusScanner, HoSoSo.Infrastructure.Antivirus.ClamAvScanner>();
        services.AddSingleton<IClock, SystemClock>();
        // BE-93: PDF là đầu vào không tin cậy. Mặc định chạy mã phân tích (PdfPig, PDFium) trong tiến trình con có hạn giờ và bộ nhớ.
        services.AddOptions<HoSoSo.Infrastructure.Pdf.PdfSandboxOptions>().Bind(configuration.GetSection("PdfSandbox"))
            .Validate(o => o.Mode is not null && (o.InProcess || string.Equals(o.Mode, "Process", StringComparison.OrdinalIgnoreCase)), "PdfSandbox:Mode chỉ nhận Process hoặc InProcess.")
            .Validate(o => o.TimeoutSeconds is >= 1 and <= 600, "PdfSandbox:TimeoutSeconds phải từ 1 đến 600.")
            .Validate(o => o.MaxMemoryMb is >= 128 and <= 16384, "PdfSandbox:MaxMemoryMb phải từ 128 đến 16384.")
            .Validate(o => o.MaxConcurrency is >= 1 and <= 16, "PdfSandbox:MaxConcurrency phải từ 1 đến 16.")
            .Validate(o => o.MaxOutputMb is >= 1 and <= 1024, "PdfSandbox:MaxOutputMb phải từ 1 đến 1024.")
            .ValidateOnStart();
        if (configuration.GetSection("PdfSandbox").Get<HoSoSo.Infrastructure.Pdf.PdfSandboxOptions>()?.InProcess == true)
        {
            services.AddSingleton<HoSoSo.Application.Documents.IPdfTools, HoSoSo.Infrastructure.Pdf.PdfTools>();
            services.AddSingleton<HoSoSo.Application.Documents.IPagePreviewRenderer, HoSoSo.Infrastructure.Pdf.PdfiumPreviewRenderer>();
        }
        else
        {
            services.AddSingleton<HoSoSo.Infrastructure.Pdf.PdfSandboxRunner>();
            services.AddSingleton<HoSoSo.Application.Documents.IPdfTools, HoSoSo.Infrastructure.Pdf.SandboxedPdfTools>();
            services.AddSingleton<HoSoSo.Application.Documents.IPagePreviewRenderer, HoSoSo.Infrastructure.Pdf.SandboxedPreviewRenderer>();
        }
        services.AddSingleton<HoSoSo.Application.Documents.IDocumentRenderer, HoSoSo.Infrastructure.Pdf.DocumentRenderer>();
        services.AddSingleton<IEventBus, InMemoryEventBus>();
        services.AddSingleton<DisposalProcessor>();
        services.AddSingleton<HoSoSo.Application.Operations.IDisposalProcessor>(p => p.GetRequiredService<DisposalProcessor>());
        // Tác vụ nền (LISTEN, outbox, thu hồi job treo). Tắt bằng Background:Enabled=false (kiểm thử không có CSDL, lệnh migrate).
        if (configuration.GetValue("Background:Enabled", true))
        {
            services.AddHostedService<PgNotificationListener>();
            services.AddHostedService<OutboxDispatcher>();
            services.AddHostedService<StaleJobReaper>();
            services.AddHostedService<DueReminderService>();
            services.AddHostedService<StorageMaintenanceService>();
            services.AddHostedService<ExportWorker>();
            services.AddHostedService(p => p.GetRequiredService<DisposalProcessor>());
            services.AddHostedService<BackupWatchdogService>();
            services.AddHostedService<SessionCleanupService>();
        }
        services.AddOptions<HoSoSo.Application.Admin.BackupPolicy>().Bind(configuration.GetSection("Backup"));
        services.AddOptions<HoSoSo.Application.Intake.AiQueueOptions>().Bind(configuration.GetSection("Ai")).ValidateOnStart();
        services.AddSingleton<Microsoft.Extensions.Options.IValidateOptions<HoSoSo.Application.Intake.AiQueueOptions>, HoSoSo.Application.Intake.AiQueueOptionsValidator>();
        services.AddHealthChecks()
            .AddCheck<DatabaseHealthCheck>("database", tags: ["ready"])
            .AddCheck<StorageHealthCheck>("storage", tags: ["ready"])
            .AddCheck<AiQueueHealthCheck>("ai-queue", tags: ["ready"])
            .AddCheck<AccessLogHealthCheck>("access-log", tags: ["ready"]);
        return services;
    }
}

internal sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
