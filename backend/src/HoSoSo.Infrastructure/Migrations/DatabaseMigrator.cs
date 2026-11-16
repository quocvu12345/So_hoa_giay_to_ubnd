using DbUp;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HoSoSo.Infrastructure.Migrations;

/// <summary>Kết quả chạy migration: các script đã/sẽ chạy.</summary>
public sealed record MigrationReport(IReadOnlyList<string> Scripts, bool DryRun);

/// <summary>
/// Chạy migration SQL theo thứ tự tên tệp trong backend/database/migrations (ADR-03).
/// Dùng tài khoản hoso_migrator (ConnectionStrings:HoSoMigrator), không dùng tài khoản của API.
/// Gọi bằng: dotnet HoSoSo.Api.dll migrate [--dry-run]
/// Tệp *_optional.sql (dữ liệu mẫu) mặc định chỉ chạy ngoài Production; Database:OptionalSeeds liệt kê tiền tố được chạy (vd. ["004"]).
/// </summary>
public static class DatabaseMigrator
{
    public static MigrationReport MigrateDatabase(this IServiceProvider services, bool dryRun = false, string[]? baselinePrefixes = null)
    {
        var configuration = services.GetRequiredService<IConfiguration>();
        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger("DatabaseMigrator");
        var environment = services.GetRequiredService<IHostEnvironment>();
        var connectionString = configuration.GetConnectionString("HoSoMigrator")
            ?? configuration.GetConnectionString("HoSo")
            ?? throw new InvalidOperationException("Thiếu ConnectionStrings:HoSoMigrator hoặc ConnectionStrings:HoSo.");
        var scriptsPath = configuration["Database:MigrationsPath"] is { Length: > 0 } configured
            ? Path.GetFullPath(configured, environment.ContentRootPath)
            : Path.Combine(AppContext.BaseDirectory, "migrations");
        var optional = configuration.GetSection("Database:OptionalSeeds").Get<string[]>();
        return baselinePrefixes is { Length: > 0 }
            ? Baseline(connectionString, scriptsPath, baselinePrefixes, logger)
            : Run(connectionString, scriptsPath, optional, includeAllOptional: !environment.IsProduction(), dryRun, logger);
    }

    /// <summary>
    /// Đánh dấu các script ĐÃ chạy từ trước (CSDL cài bằng database/install.sql, chưa có nhật ký DbUp) mà không chạy lại chúng.
    /// Chỉ dùng một lần cho CSDL cũ, với đúng những script thật sự đã áp dụng: đánh dấu nhầm sẽ làm bỏ sót script.
    /// </summary>
    public static MigrationReport Baseline(string connectionString, string scriptsPath, string[] prefixes, ILogger logger)
    {
        if (!Directory.Exists(scriptsPath)) throw new InvalidOperationException($"Không thấy thư mục migration: {scriptsPath}.");
        var upgrader = DeployChanges.To
            .PostgresqlDatabase(connectionString)
            .WithScriptsFromFileSystem(scriptsPath, path => prefixes.Any(p => Path.GetFileName(path).StartsWith(p, StringComparison.Ordinal)))
            .JournalToPostgresqlTable("public", "hoso_schema_versions")
            .LogToNowhere()
            .Build();
        var marked = upgrader.GetScriptsToExecute().Select(s => Path.GetFileName(s.Name)).ToList();
        var result = upgrader.MarkAsExecuted();
        if (!result.Successful) throw new InvalidOperationException($"Không đánh dấu baseline được: {result.Error?.Message}", result.Error);
        logger.LogWarning("migration_baseline {Count} {Scripts}: các script này được coi là đã chạy, không thực thi", marked.Count, marked);
        return new MigrationReport(marked, false);
    }

    /// <param name="optionalPrefixes">Tiền tố các tệp *_optional.sql được chạy; null = theo includeAllOptional.</param>
    public static MigrationReport Run(string connectionString, string scriptsPath, string[]? optionalPrefixes, bool includeAllOptional, bool dryRun, ILogger logger)
    {
        if (!Directory.Exists(scriptsPath))
        {
            throw new InvalidOperationException($"Không thấy thư mục migration: {scriptsPath}. Đặt Database:MigrationsPath.");
        }

        bool Wanted(string path)
        {
            var name = Path.GetFileName(path);
            if (!name.EndsWith("_optional.sql", StringComparison.OrdinalIgnoreCase)) return true;
            return optionalPrefixes is not null
                ? optionalPrefixes.Any(p => name.StartsWith(p, StringComparison.Ordinal))
                : includeAllOptional;
        }

        var upgrader = DeployChanges.To
            .PostgresqlDatabase(connectionString)
            .WithScriptsFromFileSystem(scriptsPath, Wanted)
            .WithTransactionPerScript()
            .JournalToPostgresqlTable("public", "hoso_schema_versions")
            .LogToNowhere()
            .Build();

        var pending = upgrader.GetScriptsToExecute().Select(s => Path.GetFileName(s.Name)).ToList();
        logger.LogInformation("migration_pending {Count} {Scripts} dryRun={DryRun}", pending.Count, pending, dryRun);
        if (dryRun) return new MigrationReport(pending, true);

        var result = upgrader.PerformUpgrade();
        if (!result.Successful)
        {
            throw new InvalidOperationException($"Migration lỗi ở {result.ErrorScript?.Name}: {result.Error?.Message}", result.Error);
        }
        logger.LogInformation("migration_completed {Count}", pending.Count);
        return new MigrationReport(pending, false);
    }
}
