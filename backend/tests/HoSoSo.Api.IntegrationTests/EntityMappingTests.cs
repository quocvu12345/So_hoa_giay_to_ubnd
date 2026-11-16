using System.Net;
using System.Text.Json;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Application.Common;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-06, BE-07: mọi bảng có entity (trừ ngoại lệ có chủ ý), ghi rồi đọc lại từng bảng mới, bảng chỉ thêm không sửa/xóa được, trigger chặn trường sai loại giấy tờ.</summary>
public sealed class EntityMappingTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    /// <summary>
    /// Bảng cố ý không có entity, kèm lý do. Thêm bảng mới mà quên entity thì test đầu tiên đỏ.
    /// CSDL dựng từ migration (như trong test) không có bảng này; chỉ CSDL cài từ baseline install.sql cũ (như hoso_dev) mới còn.
    /// </summary>
    private static readonly Dictionary<string, string> IntentionallyUnmapped = new()
    {
        ["schema_migrations"] = "Bảng của baseline install.sql cũ; lịch sử migration nay do DbUp ghi ở public.hoso_schema_versions.",
    };

    private async Task<T> WithDb<T>(Func<IHoSoDb, Task<T>> action)
    {
        api.RequireDatabase();
        await using var scope = api.Services.CreateAsyncScope();
        return await action(scope.ServiceProvider.GetRequiredService<IHoSoDb>());
    }

    private Task WithDb(Func<IHoSoDb, Task> action) => WithDb<int>(async db => { await action(db); return 0; });

    [Fact]
    public async Task Moi_bang_trong_schema_hoso_deu_co_entity_tru_ngoai_le_co_chu_y()
    {
        api.RequireDatabase();
        var mapped = await WithDb(db => Task.FromResult(db.ChangeTracker.Context.Model.GetEntityTypes().Select(t => t.GetTableName()!).ToHashSet()));
        var tables = new List<string>();
        await using (var command = api.Data.CreateCommand("""
            SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'hoso' AND c.relkind IN ('r', 'p') AND NOT c.relispartition ORDER BY 1
            """))
        await using (var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken))
            while (await reader.ReadAsync(TestContext.Current.CancellationToken)) tables.Add(reader.GetString(0));

        tables.Count.ShouldBeGreaterThan(55);
        var missing = tables.Where(t => !mapped.Contains(t) && !IntentionallyUnmapped.ContainsKey(t)).ToList();
        missing.ShouldBeEmpty($"bảng chưa có entity: {string.Join(", ", missing)}");
    }

    [Fact]
    public async Task Ghi_va_doc_lai_cac_bang_tham_chieu()
    {
        api.RequireDatabase();
        var organization = (await api.ScalarAsync<string>("SELECT code FROM hoso.organizations ORDER BY code LIMIT 1"))!;
        var scopeRow = await api.Data.CreateCommand("SELECT department_code, organization_code FROM hoso.department_scopes ORDER BY 1, 2 LIMIT 1").ExecuteReaderAsync(TestContext.Current.CancellationToken);
        await scopeRow.ReadAsync(TestContext.Current.CancellationToken);
        var (department, scopeOrganization) = (scopeRow.GetString(0), scopeRow.GetString(1));
        await scopeRow.DisposeAsync();
        await api.ExecuteAsync("INSERT INTO hoso.procedures(id, name) VALUES ('map-001', 'Thủ tục thử ánh xạ')");
        var template = await api.ScalarAsync<Guid>("INSERT INTO hoso.form_templates(kind, filename, sha256, byte_size) VALUES ('blank_form', 'map.docx', $1, 1) RETURNING id", new string('a', 64));
        var sha = new string('b', 64);

        await WithDb(async db =>
        {
            db.Set<Role>().Add(new Role { Code = "map_role", Name = "Vai trò thử", ScopeKind = "assigned" });
            db.Set<Permission>().Add(new Permission { Code = "map.permission", Description = "Quyền thử" });
            db.Set<Source>().Add(new Source { Id = "map-src", Publisher = "Cơ quan thử", Url = "https://example.test/a", ResolvedUrl = "https://example.test/b", RetrievedAt = DateTimeOffset.UtcNow, ResponseSha256 = sha, VerificationNote = "thử" });
            db.Set<WorkflowDefinition>().Add(new WorkflowDefinition { Code = "map_flow", Name = "Quy trình thử", Description = "mô tả" });
            db.Set<OrganizationName>().Add(new OrganizationName { OrganizationCode = organization, Name = "Tên cũ của cơ quan", ValidFrom = new DateOnly(2020, 1, 1), ValidUntil = new DateOnly(2024, 6, 30), Basis = "Nghị quyết thử" });
            db.Set<PaperType>().Add(new PaperType { Code = "MAP-001", CanonicalName = "Đơn thử", Names = "[\"Đơn\",\"Đơn đề nghị\"]" });
            db.Set<ProcedureDepartment>().Add(new ProcedureDepartment { ProcedureId = "map-001", DepartmentCode = department, OrganizationCode = scopeOrganization });
            db.Set<FormTemplateField>().Add(new FormTemplateField { TemplateId = template, FieldKey = "ho_ten", Label = "Họ và tên", Page = 2, Bbox = "{\"x\": 10, \"y\": 20}", Role = "applicant" });
            db.Set<DossierCodeSequence>().Add(new DossierCodeSequence { OrganizationCode = organization, Year = 2150, LastValue = 7 });
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        });

        await WithDb(async db =>
        {
            (await db.Read<Role>().SingleAsync(r => r.Code == "map_role", TestContext.Current.CancellationToken)).ScopeKind.ShouldBe("assigned");
            (await db.Read<Permission>().SingleAsync(p => p.Code == "map.permission", TestContext.Current.CancellationToken)).Description.ShouldBe("Quyền thử");
            var source = await db.Read<Source>().SingleAsync(s => s.Id == "map-src", TestContext.Current.CancellationToken);
            (source.Publisher, source.ResolvedUrl, source.ResponseSha256).ShouldBe(("Cơ quan thử", "https://example.test/b", sha));
            (await db.Read<WorkflowDefinition>().SingleAsync(w => w.Code == "map_flow", TestContext.Current.CancellationToken)).Name.ShouldBe("Quy trình thử");

            var name = await db.Read<OrganizationName>().SingleAsync(n => n.OrganizationCode == organization && n.Basis == "Nghị quyết thử", TestContext.Current.CancellationToken);
            name.Id.ShouldBeGreaterThan(0, "khóa tự tăng do CSDL cấp");
            (name.ValidFrom, name.ValidUntil).ShouldBe((new DateOnly(2020, 1, 1), new DateOnly(2024, 6, 30)));

            var paper = await db.Read<PaperType>().SingleAsync(p => p.Code == "MAP-001", TestContext.Current.CancellationToken);
            JsonSerializer.Deserialize<string[]>(paper.Names).ShouldBe(["Đơn", "Đơn đề nghị"], "cột jsonb đọc lại đúng mảng");

            (await db.Read<ProcedureDepartment>().SingleAsync(p => p.ProcedureId == "map-001", TestContext.Current.CancellationToken)).VerificationStatus.ShouldBe("proposed");

            var field = await db.Read<FormTemplateField>().SingleAsync(f => f.TemplateId == template, TestContext.Current.CancellationToken);
            (field.Page, field.InputType, field.Role).ShouldBe((2, "text", "applicant"));
            JsonDocument.Parse(field.Bbox!).RootElement.GetProperty("y").GetInt32().ShouldBe(20);

            (await db.Read<DossierCodeSequence>().SingleAsync(s => s.OrganizationCode == organization && s.Year == 2150, TestContext.Current.CancellationToken)).LastValue.ShouldBe(7);
        });

        // Sai ràng buộc thì CSDL từ chối (CHECK trên sources.url phải là https).
        var bad = await Should.ThrowAsync<DbUpdateException>(() => WithDb(async db =>
        {
            db.Set<Source>().Add(new Source { Id = "map-bad", Publisher = "x", Url = "http://khong-https", ResolvedUrl = "https://example.test/c", RetrievedAt = DateTimeOffset.UtcNow, ResponseSha256 = sha, VerificationNote = "" });
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }));
        bad.InnerException.ShouldBeOfType<PostgresException>().SqlState.ShouldBe("23514");
    }

    [Fact]
    public async Task Cap_quyen_xem_giay_to_ghi_doc_va_thu_hoi_khong_xoa()
    {
        api.RequireDatabase();
        var grantee = await api.UserIdAsync("demo_cv_ht");
        var grantor = await api.UserIdAsync("demo_head_ht");
        var document = await api.ScalarAsync<Guid>("SELECT id FROM hoso.documents WHERE external_key = 'public-001'");
        var id = Guid.NewGuid();
        await WithDb(async db =>
        {
            db.Set<DocumentAccessGrant>().Add(new DocumentAccessGrant { Id = id, DocumentId = document, GranteeUserId = grantee, Access = "view", ValidUntil = DateTimeOffset.UtcNow.AddDays(7), Reason = "Phối hợp xử lý hồ sơ liên phòng", GrantedBy = grantor });
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        });
        await WithDb(async db =>
        {
            var grant = await db.Set<DocumentAccessGrant>().SingleAsync(g => g.Id == id, TestContext.Current.CancellationToken);
            grant.GrantedAt.ShouldBeGreaterThan(DateTimeOffset.UtcNow.AddMinutes(-5), "thời điểm cấp do CSDL đặt");
            grant.RevokedAt.ShouldBeNull();
            grant.RevokedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        });
        (await WithDb(db => db.Read<DocumentAccessGrant>().SingleAsync(g => g.Id == id, TestContext.Current.CancellationToken))).RevokedAt.ShouldNotBeNull();

        // Thiếu cả hồ sơ lẫn giấy tờ, hoặc lý do quá ngắn: CSDL từ chối.
        foreach (var (dossier, doc, reason) in new (Guid?, Guid?, string)[] { (null, null, "Lý do đủ dài để hợp lệ"), (null, document, "ngắn") })
        {
            var rejected = await Should.ThrowAsync<DbUpdateException>(() => WithDb(async db =>
            {
                db.Set<DocumentAccessGrant>().Add(new DocumentAccessGrant { DossierId = dossier, DocumentId = doc, GranteeUserId = grantee, Access = "view", ValidUntil = DateTimeOffset.UtcNow.AddDays(1), Reason = reason, GrantedBy = grantor });
                await db.SaveChangesAsync(TestContext.Current.CancellationToken);
            }));
            rejected.InnerException.ShouldBeOfType<PostgresException>().SqlState.ShouldBe("23514");
        }
    }

    [Fact]
    public async Task Nhat_ky_chi_them_ghi_doc_duoc_nhung_khong_sua_khong_xoa_o_ca_hai_tang()
    {
        api.RequireDatabase();
        var user = await api.UserIdAsync("demo_cv_ht");
        var correlation = "map-" + Guid.NewGuid().ToString("N")[..8];
        await WithDb(async db =>
        {
            db.Set<AccessEvent>().Add(new AccessEvent { UserId = user, Action = "search", ObjectType = "search", ClientIp = IPAddress.Parse("10.1.2.3"), CorrelationId = correlation });
            db.Set<AuditEvent>().Add(new AuditEvent { TableName = "map_test", Operation = "INSERT", DatabaseUser = "test", ActorSubject = user.ToString(), NewRow = "{\"a\": 1}" });
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        });

        var access = await WithDb(db => db.Read<AccessEvent>().SingleAsync(e => e.CorrelationId == correlation, TestContext.Current.CancellationToken));
        access.Id.ShouldBeGreaterThan(0);
        (access.Action, access.ClientIp!.ToString(), access.UserId).ShouldBe(("search", "10.1.2.3", user));
        access.HappenedAt.ShouldBeGreaterThan(DateTimeOffset.UtcNow.AddMinutes(-5));
        var audit = await WithDb(db => db.Read<AuditEvent>().SingleAsync(e => e.TableName == "map_test", TestContext.Current.CancellationToken));
        JsonDocument.Parse(audit.NewRow!).RootElement.GetProperty("a").GetInt32().ShouldBe(1);

        // Tầng EF: từ chối ngay, không gửi lệnh nào tới CSDL.
        var modified = await Should.ThrowAsync<InvalidOperationException>(() => WithDb(async db =>
        {
            var tracked = await db.Set<AccessEvent>().SingleAsync(e => e.CorrelationId == correlation, TestContext.Current.CancellationToken);
            tracked.Action = "view";
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }));
        modified.Message.ShouldContain("chỉ thêm");
        await Should.ThrowAsync<InvalidOperationException>(() => WithDb(async db =>
        {
            db.Set<AuditEvent>().Remove(await db.Set<AuditEvent>().SingleAsync(e => e.TableName == "map_test", TestContext.Current.CancellationToken));
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }));
        await Should.ThrowAsync<InvalidOperationException>(() => WithDb(async db =>
        {
            var e = await db.Set<WorkflowEvent>().FirstAsync(TestContext.Current.CancellationToken);
            e.Note = "sửa lén";
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }));

        // Tầng CSDL: ai đó có quyền SQL cũng không sửa hay xóa được.
        var update = await Should.ThrowAsync<PostgresException>(() => api.ExecuteAsync("UPDATE hoso.access_events SET action = 'view' WHERE correlation_id = $1", correlation));
        var delete = await Should.ThrowAsync<PostgresException>(() => api.ExecuteAsync("DELETE FROM hoso.audit_events WHERE table_name = 'map_test'"));
        delete.SqlState.ShouldBe(update.SqlState, "cùng một mã lỗi từ trigger reject_log_mutation");
        (await api.ScalarAsync<string>("SELECT action FROM hoso.access_events WHERE correlation_id = $1", correlation)).ShouldBe("search");
    }

    [Fact]
    public async Task Trigger_field_definition_guard_chan_gia_tri_truong_sai_loai_giay_to()
    {
        api.RequireDatabase();
        // Hai loại giấy tờ khác nhau, mỗi loại có ít nhất một trường.
        var rows = new List<(string Type, string Group, string Field)>();
        await using (var command = api.Data.CreateCommand("""
            SELECT DISTINCT ON (t.code) t.code, t.work_group_code, f.code
            FROM hoso.document_types t JOIN hoso.field_definitions f ON f.document_type_code = t.code
            ORDER BY t.code LIMIT 2
            """))
        await using (var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken))
            while (await reader.ReadAsync(TestContext.Current.CancellationToken)) rows.Add((reader.GetString(0), reader.GetString(1), reader.GetString(2)));
        rows.Count.ShouldBe(2);
        var document = await api.ScalarAsync<Guid>("SELECT id FROM hoso.documents WHERE external_key = 'public-002'");
        await api.ExecuteAsync("INSERT INTO hoso.document_classifications(document_id, work_group_code, document_type_code, classification_status, basis) VALUES ($1, $2, $3, 'confirmed', 'thử')", document, rows[0].Group, rows[0].Type);

        // Trường của đúng loại đã phân loại: nhận.
        await api.ExecuteAsync("INSERT INTO hoso.document_field_values(document_id, field_definition_code, value_text, value_origin) VALUES ($1, $2, 'giá trị', 'manual')", document, rows[0].Field);
        // Trường của loại khác: trigger chặn (RAISE EXCEPTION không mã riêng → P0001), và không để lại dòng nào.
        var wrong = await Should.ThrowAsync<PostgresException>(() =>
            api.ExecuteAsync("INSERT INTO hoso.document_field_values(document_id, field_definition_code, value_text, value_origin) VALUES ($1, $2, 'sai loại', 'manual')", document, rows[1].Field));
        wrong.SqlState.ShouldBe("P0001");
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.document_field_values WHERE document_id = $1", document)).ShouldBe(1);
    }
}
