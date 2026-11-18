using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Application.Common;
using Microsoft.Extensions.DependencyInjection;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>
/// BE-111 (hiệu năng). ScopeFilter đặt một điều kiện CẦN theo tập (cơ quan/phòng của phân công, chuyên viên chỉ hồ sơ chủ trì hoặc phối hợp)
/// trước hoso.scope_matches. Điều kiện đó không được làm MẤT hồ sơ nào: với mọi phân công (riêng và ủy quyền) của mọi người dùng mẫu,
/// danh sách API phải đúng bằng tập scope_matches tính thẳng trong SQL, kể cả các ca phối hợp, phối hợp đã kết thúc và ủy quyền chéo phòng.
/// </summary>
public sealed class ScopePrefilterTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private async Task<Guid> DelegateAsync(string from, string role, string to)
    {
        var fromRole = await api.ScalarAsync<Guid>(
            "SELECT ur.id FROM hoso.user_roles ur JOIN hoso.users u ON u.id = ur.user_id WHERE u.username = $1 AND ur.role_code = $2 ORDER BY ur.valid_from LIMIT 1", from, role);
        var id = await api.ScalarAsync<Guid>(
            "INSERT INTO hoso.delegations(from_user_role_id, to_user_id, permission_codes, valid_until, basis, created_by) VALUES ($1, $2, ARRAY['dossier.read'], now() + interval '3 days', 'Ủy quyền thử bộ lọc sơ bộ phạm vi', $3) RETURNING id",
            fromRole, await api.UserIdAsync(to), await api.UserIdAsync("demo_admin"));
        using var scope = api.Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<IIdentityService>().Invalidate(await api.UserIdAsync(to));
        return id;
    }

    private async Task<List<string>> ExpectedAsync(Guid userId, string assignment)
    {
        await using var command = api.Data.CreateCommand("SELECT code FROM hoso.dossiers WHERE hoso.scope_matches($1, id, $2) ORDER BY code");
        command.Parameters.AddWithValue(userId);
        command.Parameters.AddWithValue(assignment);
        await using var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
        var codes = new List<string>();
        while (await reader.ReadAsync(TestContext.Current.CancellationToken)) codes.Add(reader.GetString(0));
        return codes;
    }

    [Fact]
    public async Task Bo_loc_so_bo_khong_lam_mat_ho_so_nao()
    {
        api.RequireDatabase();
        var head = await api.UserIdAsync("demo_head_ht");
        var second = await api.UserIdAsync("demo_cv_ht_02");
        // Chuyên viên thứ hai của Hạ tầng phối hợp ở DEMO-0001 (đang hiệu lực) và từng phối hợp ở DEMO-0008 (đã kết thúc).
        await api.ExecuteAsync("""
            INSERT INTO hoso.dossier_assignments(dossier_id, user_id, assignment_role, assigned_by) SELECT id, $1, 'support', $2 FROM hoso.dossiers WHERE code = 'DEMO-2026-0001';
            """, second, head);
        await api.ExecuteAsync("""
            INSERT INTO hoso.dossier_assignments(dossier_id, user_id, assignment_role, assigned_by, ended_at) SELECT id, $1, 'support', $2, now() - interval '1 day' FROM hoso.dossiers WHERE code = 'DEMO-2026-0008';
            """, second, head);
        // Ủy quyền chéo phòng và chéo khối: chuyên viên nhận phạm vi trưởng phòng; trưởng phòng UBND nhận phạm vi Ban HĐND; chuyên viên nhận phạm vi chuyên viên khác.
        await DelegateAsync("demo_head_kt", "manager", "demo_cv_ht");
        await DelegateAsync("demo_head_bkt", "manager", "demo_head_ht");
        await DelegateAsync("demo_cv_kt", "employee", "demo_cv_ht_02");

        var cases = new List<(string User, Guid UserId, string Assignment)>();
        await using (var command = api.Data.CreateCommand("""
            SELECT u.username, u.id, ur.id::text FROM hoso.user_roles ur JOIN hoso.users u ON u.id = ur.user_id
            WHERE u.username LIKE 'demo\_%' AND u.active AND ur.valid_from <= now() AND (ur.valid_until IS NULL OR ur.valid_until > now()) AND ur.role_code <> 'technical_admin'
            UNION ALL
            SELECT u.username, u.id, 'd:' || dg.id FROM hoso.delegations dg JOIN hoso.users u ON u.id = dg.to_user_id
            WHERE u.username LIKE 'demo\_%' AND dg.revoked_at IS NULL AND dg.valid_until > now()
            ORDER BY 1, 3
            """))
        await using (var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken))
            while (await reader.ReadAsync(TestContext.Current.CancellationToken)) cases.Add((reader.GetString(0), reader.GetGuid(1), reader.GetString(2)));
        cases.Count.ShouldBeGreaterThan(25, "đủ người dùng mẫu và ủy quyền");
        cases.ShouldContain(c => c.Assignment.StartsWith("d:", StringComparison.Ordinal));

        var nonEmpty = 0;
        foreach (var (user, userId, assignment) in cases)
        {
            var expected = await ExpectedAsync(userId, assignment);
            var http = await api.LoginAsync(user, assignment);
            var response = await http.GetAsync("/api/v1/dossiers?limit=200");
            if (response.StatusCode == System.Net.HttpStatusCode.Forbidden)
            {
                expected.ShouldBeEmpty($"{user} ({assignment}) không có quyền xem danh sách thì scope_matches cũng không được thấy gì");
                continue;
            }
            var visible = (await response.ReadAsync<PageDto<DossierItem>>()).Items.Select(i => i.Code).Order().ToList();
            visible.ShouldBe(expected, $"{user} ({assignment})");
            if (expected.Count > 0) nonEmpty++;
        }
        nonEmpty.ShouldBeGreaterThan(10, "phép so có ý nghĩa: nhiều phân công thấy được hồ sơ");

        // Các ca cố ý: phối hợp đang hiệu lực thấy, đã kết thúc thì không; ủy quyền chéo phòng thấy hồ sơ phòng kia.
        var secondOwn = await api.AssignmentIdAsync("demo_cv_ht_02", "employee");
        (await ExpectedAsync(second, secondOwn)).ShouldContain("DEMO-2026-0001");
        (await ExpectedAsync(second, secondOwn)).ShouldNotContain("DEMO-2026-0008");
    }
}
