using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using HoSoSo.Infrastructure.Migrations;
using Testcontainers.PostgreSql;

namespace HoSoSo.Api.IntegrationTests.Support;

/// <summary>
/// BE-17. Một CSDL mẫu đã migrate (000–020 + dữ liệu mẫu 004) cho cả lần chạy test; mỗi lớp test sao ra CSDL riêng
/// bằng CREATE DATABASE ... TEMPLATE nên nhanh và không ảnh hưởng nhau.
/// PostgreSQL lấy từ biến HOSO_TEST_PG (vd. "Host=127.0.0.1;Port=55432;Username=hoso_admin") hoặc Testcontainers nếu có Docker.
/// Không có cả hai thì các test cần CSDL được bỏ qua (skip), không báo đỏ giả.
/// </summary>
public static class TestDatabase
{
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static bool _ready;
    private static string? _admin;
    private static string? _template;
    private static PostgreSqlContainer? _container;

    public static string? SkipReason { get; private set; }

    public static string MigrationsPath { get; } = FindUp("backend/database/migrations");

    public static async Task EnsureAsync()
    {
        if (_ready) return;
        await Gate.WaitAsync();
        try
        {
            if (_ready) return;
            _admin = Environment.GetEnvironmentVariable("HOSO_TEST_PG");
            if (string.IsNullOrWhiteSpace(_admin))
            {
                try
                {
                    _container = new PostgreSqlBuilder("postgres:16-alpine").Build();
                    await _container.StartAsync();
                    _admin = _container.GetConnectionString();
                }
                catch (Exception exception)
                {
                    SkipReason = $"Không có PostgreSQL để kiểm thử: đặt HOSO_TEST_PG hoặc bật Docker ({exception.GetType().Name}).";
                    _ready = true;
                    return;
                }
            }
            _template = "hoso_tpl_" + Guid.NewGuid().ToString("N")[..12];
            await ExecuteAdminAsync($"CREATE DATABASE {_template}");
            DatabaseMigrator.Run(ConnectionTo(_template), MigrationsPath, ["004"], false, false, NullLogger.Instance);
            NpgsqlConnection.ClearAllPools();
            AppDomain.CurrentDomain.ProcessExit += (_, _) => DropQuietly(_template);
            _ready = true;
        }
        finally
        {
            Gate.Release();
        }
    }

    /// <summary>CSDL mới sao từ mẫu. Trả tên và chuỗi kết nối.</summary>
    public static async Task<(string Name, string ConnectionString)> CreateAsync()
    {
        await EnsureAsync();
        var name = "hoso_test_" + Guid.NewGuid().ToString("N")[..12];
        await ExecuteAdminAsync($"CREATE DATABASE {name} TEMPLATE {_template}");
        return (name, ConnectionTo(name));
    }

    /// <summary>CSDL rỗng (chưa migrate), để kiểm thử chính bộ migration.</summary>
    public static async Task<(string Name, string ConnectionString)> CreateEmptyAsync()
    {
        await EnsureAsync();
        var name = "hoso_empty_" + Guid.NewGuid().ToString("N")[..12];
        await ExecuteAdminAsync($"CREATE DATABASE {name}");
        return (name, ConnectionTo(name));
    }

    public static async Task DropAsync(string name)
    {
        NpgsqlConnection.ClearAllPools();
        await ExecuteAdminAsync($"DROP DATABASE IF EXISTS {name} WITH (FORCE)");
    }

    private static string ConnectionTo(string database) =>
        new NpgsqlConnectionStringBuilder(_admin) { Database = database, Pooling = true, IncludeErrorDetail = true }.ConnectionString;

    private static async Task ExecuteAdminAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(new NpgsqlConnectionStringBuilder(_admin) { Database = "postgres" }.ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }

    private static void DropQuietly(string? name)
    {
        if (name is null || _admin is null) return;
        try
        {
            NpgsqlConnection.ClearAllPools();
            using var connection = new NpgsqlConnection(new NpgsqlConnectionStringBuilder(_admin) { Database = "postgres" }.ConnectionString);
            connection.Open();
            using var command = new NpgsqlCommand($"DROP DATABASE IF EXISTS {name} WITH (FORCE)", connection);
            command.ExecuteNonQuery();
        }
        catch
        {
            // Dọn dẹp không thành công không làm hỏng kết quả test.
        }
    }

    private static string FindUp(string relative)
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            var candidate = Path.Combine(directory.FullName, relative);
            if (Directory.Exists(candidate)) return candidate;
            var inBackend = Path.Combine(directory.FullName, relative.Replace("backend/", ""));
            if (directory.Name == "backend" && Directory.Exists(inBackend)) return inBackend;
        }
        throw new DirectoryNotFoundException($"Không thấy {relative} từ {AppContext.BaseDirectory}");
    }
}
