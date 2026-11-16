using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Domain.Identity;
using HoSoSo.Infrastructure.Migrations;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-04, BE-05, DB-04: migration chạy được, chạy lại không làm gì, dữ liệu danh mục đủ, quyền khớp mã nguồn.</summary>
public sealed class MigrationTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    [Fact]
    public async Task Danh_muc_co_du_38_nhom_427_loai_2624_truong()
    {
        api.RequireDatabase();
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.work_groups")).ShouldBe(38);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.document_types")).ShouldBe(427);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.field_definitions")).ShouldBe(2624);
    }

    [Fact]
    public async Task Chay_hai_lan_thi_lan_hai_khong_co_script_nao_va_dry_run_khong_ghi()
    {
        api.RequireDatabase();
        var (name, connection) = await TestDatabase.CreateEmptyAsync();
        try
        {
            var dry = DatabaseMigrator.Run(connection, TestDatabase.MigrationsPath, [], false, dryRun: true, NullLogger.Instance);
            dry.Scripts.ShouldContain("000_schema.sql");
            dry.Scripts.ShouldNotContain(s => s.EndsWith("_optional.sql"));

            var first = DatabaseMigrator.Run(connection, TestDatabase.MigrationsPath, [], false, false, NullLogger.Instance);
            first.Scripts.Count.ShouldBe(dry.Scripts.Count, "dry-run liệt kê đúng những gì sẽ chạy");

            var second = DatabaseMigrator.Run(connection, TestDatabase.MigrationsPath, [], false, false, NullLogger.Instance);
            second.Scripts.ShouldBeEmpty();

            await using var data = NpgsqlDataSource.Create(connection);
            await using var count = data.CreateCommand("SELECT count(*) FROM hoso.users");
            ((long)(await count.ExecuteScalarAsync(TestContext.Current.CancellationToken))!).ShouldBe(0, "production không có người dùng mẫu");
        }
        finally
        {
            await TestDatabase.DropAsync(name);
        }
    }

    [Fact]
    public async Task Script_loi_thi_dung_va_khong_ghi_nhat_ky()
    {
        api.RequireDatabase();
        var (name, connection) = await TestDatabase.CreateEmptyAsync();
        var folder = Path.Combine(Path.GetTempPath(), "hoso-bad-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(folder);
        try
        {
            await File.WriteAllTextAsync(Path.Combine(folder, "001_ok.sql"), "CREATE TABLE public.t1(id int);", TestContext.Current.CancellationToken);
            await File.WriteAllTextAsync(Path.Combine(folder, "002_loi.sql"), "CREATE TABLE public.t2(id int); SELECT 1/0;", TestContext.Current.CancellationToken);
            Should.Throw<InvalidOperationException>(() => DatabaseMigrator.Run(connection, folder, [], false, false, NullLogger.Instance))
                .Message.ShouldContain("002_loi.sql");

            await using var data = NpgsqlDataSource.Create(connection);
            await using var journal = data.CreateCommand("SELECT array_agg(scriptname) FROM public.hoso_schema_versions");
            var applied = (string[])(await journal.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
            applied.Length.ShouldBe(1);
            await using var t2 = data.CreateCommand("SELECT to_regclass('public.t2')::text");
            (await t2.ExecuteScalarAsync(TestContext.Current.CancellationToken)).ShouldBeOfType<DBNull>("script lỗi phải được hoàn tác");
        }
        finally
        {
            await TestDatabase.DropAsync(name);
            Directory.Delete(folder, true);
        }
    }

    [Fact]
    public async Task Quyen_trong_CSDL_khop_DefaultRolePermissions()
    {
        api.RequireDatabase();
        await using var command = api.Data.CreateCommand("SELECT role_code, permission_code FROM hoso.role_permissions");
        await using var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
        var database = new Dictionary<string, HashSet<string>>();
        while (await reader.ReadAsync(TestContext.Current.CancellationToken))
        {
            database.TryAdd(reader.GetString(0), []);
            database[reader.GetString(0)].Add(reader.GetString(1));
        }
        foreach (var role in RoleCode.All)
        {
            var expected = DefaultRolePermissions.For(role).ToHashSet();
            // dossier.configure chỉ có trong CSDL (quản trị quy trình), chưa có endpoint nên không nằm trong mã nguồn.
            database[role].Where(p => p != "dossier.configure").ToHashSet().ShouldBe(expected, $"quyền của vai trò {role}");
        }
    }

    [Fact]
    public async Task Kiem_tra_toan_ven_sau_migration_020_dat()
    {
        api.RequireDatabase();
        var script = await File.ReadAllTextAsync(Path.Combine(TestDatabase.MigrationsPath, "..", "tests", "verify_after_020.sql"), TestContext.Current.CancellationToken);
        await using var command = api.Data.CreateCommand(script);
        // Script tự ROLLBACK; có lỗi ASSERT thì ném PostgresException.
        await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Baseline_cho_csdl_cai_tu_truoc_chi_danh_dau_khong_chay_lai_roi_nang_cap_tiep()
    {
        api.RequireDatabase();
        var (name, connection) = await TestDatabase.CreateEmptyAsync();
        var legacy = Path.Combine(Path.GetTempPath(), "hoso-legacy-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(legacy);
        try
        {
            // Giả lập CSDL cũ: chỉ có 000–003 (như install.sql), chưa có nhật ký DbUp.
            foreach (var file in Directory.GetFiles(TestDatabase.MigrationsPath, "*.sql").Where(f => Path.GetFileName(f)[..3] is "000" or "001" or "002" or "003")) File.Copy(file, Path.Combine(legacy, Path.GetFileName(file)));
            DatabaseMigrator.Run(connection, legacy, [], false, false, NullLogger.Instance);
            await using (var data = NpgsqlDataSource.Create(connection))
            {
                await using var drop = data.CreateCommand("DROP TABLE public.hoso_schema_versions");
                await drop.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
            }

            // Chạy thẳng sẽ lỗi vì bảng đã có. 000 (CREATE SCHEMA IF NOT EXISTS) chạy xong và được ghi nhật ký trước khi 001 lỗi.
            Should.Throw<InvalidOperationException>(() => DatabaseMigrator.Run(connection, TestDatabase.MigrationsPath, [], false, false, NullLogger.Instance));

            var marked = DatabaseMigrator.Baseline(connection, TestDatabase.MigrationsPath, ["000", "001", "002", "003"], NullLogger.Instance);
            marked.Scripts.ShouldBe(["001_schema.sql", "002_seed_catalog.sql", "003_seed_public_documents.sql"]);

            var rest = DatabaseMigrator.Run(connection, TestDatabase.MigrationsPath, [], false, false, NullLogger.Instance);
            rest.Scripts.ShouldNotContain("001_schema.sql");
            rest.Scripts.ShouldContain("008_extensions_conventions.sql");
            DatabaseMigrator.Run(connection, TestDatabase.MigrationsPath, [], false, false, NullLogger.Instance).Scripts.ShouldBeEmpty();
        }
        finally
        {
            await TestDatabase.DropAsync(name);
            Directory.Delete(legacy, true);
        }
    }

    [Fact]
    public async Task Tai_khoan_quan_tri_dev_co_phan_cong_dung_mo_hinh_phan_quyen()
    {
        api.RequireDatabase();
        var (name, connection) = await TestDatabase.CreateEmptyAsync();
        try
        {
            DatabaseMigrator.Run(connection, TestDatabase.MigrationsPath, ["021"], false, false, NullLogger.Instance);
            await using var data = NpgsqlDataSource.Create(connection);
            await using var command = data.CreateCommand(
                "SELECT ur.role_code, count(*) FROM hoso.user_roles ur JOIN hoso.users u ON u.id = ur.user_id WHERE u.username = 'dev_admin' GROUP BY 1 ORDER BY 1");
            await using var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
            var roles = new Dictionary<string, long>();
            while (await reader.ReadAsync(TestContext.Current.CancellationToken)) roles[reader.GetString(0)] = reader.GetInt64(1);
            roles.Keys.ShouldBe(["chair", "clerk", "council", "employee", "manager", "technical_admin"]);
            roles["technical_admin"].ShouldBe(1);
            await using var scopes = data.CreateCommand("SELECT count(*) FROM hoso.department_scopes");
            roles["manager"].ShouldBe((long)(await scopes.ExecuteScalarAsync(TestContext.Current.CancellationToken))!, "một phân công trưởng phòng cho mỗi cặp đơn vị–cơ quan trong danh mục");

            // Chạy lại không nhân đôi.
            DatabaseMigrator.Run(connection, TestDatabase.MigrationsPath, ["021"], false, false, NullLogger.Instance).Scripts.ShouldBeEmpty();
        }
        finally
        {
            await TestDatabase.DropAsync(name);
        }
    }
}
