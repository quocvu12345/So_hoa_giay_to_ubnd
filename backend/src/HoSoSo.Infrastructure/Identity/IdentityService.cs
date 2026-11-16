using HoSoSo.Application.Common;
using HoSoSo.Domain.Catalog;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using HoSoSo.Infrastructure.Persistence;

namespace HoSoSo.Infrastructure.Identity;

/// <summary>
/// BE-12, BE-13. Đọc người dùng và phân công từ CSDL. Phân công của một người được nhớ 60 giây
/// để mỗi request không phải truy vấn lại; đổi phân công có hiệu lực chậm nhất sau 60 giây.
/// </summary>
internal sealed class IdentityService(HoSoDbContext db, IMemoryCache cache, IClock clock) : IIdentityService
{
    private static readonly TimeSpan AssignmentTtl = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan ReferenceTtl = TimeSpan.FromMinutes(5);

    public async Task<LoginUser?> FindByUsernameAsync(string username, CancellationToken cancellationToken) =>
        await db.Read<User>().Where(u => u.Username == username)
            .Select(u => new LoginUser(u.Id, u.Username, u.DisplayName, u.Active, u.IsDemo)).SingleOrDefaultAsync(cancellationToken);

    public async Task<LoginUser?> FindByExternalSubjectAsync(string subject, CancellationToken cancellationToken) =>
        await db.Read<User>().Where(u => u.ExternalAuthSubject == subject)
            .Select(u => new LoginUser(u.Id, u.Username, u.DisplayName, u.Active, u.IsDemo)).SingleOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<LoginUser>> ListDemoUsersAsync(CancellationToken cancellationToken) =>
        await db.Read<User>().Where(u => u.IsDemo && u.Active).OrderBy(u => u.Username)
            .Select(u => new LoginUser(u.Id, u.Username, u.DisplayName, u.Active, u.IsDemo)).ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<ActiveAssignment>> ListAssignmentsAsync(Guid userId, CancellationToken cancellationToken) =>
        (await cache.GetOrCreateAsync($"assignments:{userId}", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = AssignmentTtl;
            return await LoadAssignmentsAsync(userId, cancellationToken);
        }))!;

    private async Task<IReadOnlyList<ActiveAssignment>> LoadAssignmentsAsync(Guid userId, CancellationToken ct)
    {
        var now = clock.UtcNow;
        if (!await db.Read<User>().AnyAsync(u => u.Id == userId && u.Active, ct)) return [];

        var permissionsByRole = await RolePermissionsAsync(ct);
        var (organizations, departments) = await NamesAsync(ct);

        var own = await db.Read<UserRole>()
            .Where(r => r.UserId == userId && r.ValidFrom <= now && (r.ValidUntil == null || r.ValidUntil > now))
            .OrderBy(r => r.ValidFrom).ThenBy(r => r.RoleCode).ToListAsync(ct);

        var result = own.Select(r => new ActiveAssignment(
            r.Id.ToString(), r.RoleCode, r.OrganizationCode, Name(organizations, r.OrganizationCode),
            r.DepartmentCode, Name(departments, r.DepartmentCode), r.IsDeputy, null,
            permissionsByRole.GetValueOrDefault(r.RoleCode) ?? new HashSet<string>())).ToList();

        // Ủy quyền: người nhận chỉ có phần giao của quyền vai trò gốc, và chỉ khi người ủy quyền còn hoạt động.
        var delegated = await (
            from d in db.Read<Delegation>()
            join r in db.Read<UserRole>() on d.FromUserRoleId equals r.Id
            join u in db.Read<User>() on r.UserId equals u.Id
            where d.ToUserId == userId && d.RevokedAt == null && d.ValidFrom <= now && d.ValidUntil > now
                  && u.Active && r.ValidFrom <= now && (r.ValidUntil == null || r.ValidUntil > now)
            select new { d.Id, d.PermissionCodes, d.ValidUntil, r.RoleCode, r.OrganizationCode, r.DepartmentCode }).ToListAsync(ct);

        foreach (var d in delegated)
        {
            var granted = (permissionsByRole.GetValueOrDefault(d.RoleCode) ?? new HashSet<string>())
                .Intersect(d.PermissionCodes, StringComparer.Ordinal).ToHashSet(StringComparer.Ordinal);
            result.Add(new ActiveAssignment($"d:{d.Id}", d.RoleCode, d.OrganizationCode, Name(organizations, d.OrganizationCode),
                d.DepartmentCode, Name(departments, d.DepartmentCode), false, d.ValidUntil, granted));
        }
        return result;
    }

    private static string? Name(Dictionary<string, string> names, string? code) =>
        code is not null && names.TryGetValue(code, out var name) ? name : null;

    private Task<Dictionary<string, HashSet<string>>> RolePermissionsAsync(CancellationToken ct) =>
        cache.GetOrCreateAsync("role-permissions", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = ReferenceTtl;
            var rows = await db.Read<RolePermission>().ToListAsync(ct);
            return rows.GroupBy(r => r.RoleCode)
                .ToDictionary(g => g.Key, g => g.Select(r => r.PermissionCode).ToHashSet(StringComparer.Ordinal), StringComparer.Ordinal);
        })!;

    private Task<(Dictionary<string, string>, Dictionary<string, string>)> NamesAsync(CancellationToken ct) =>
        cache.GetOrCreateAsync("org-dept-names", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = ReferenceTtl;
            var orgs = await db.Read<Organization>().ToDictionaryAsync(o => o.Code, o => o.Name, ct);
            var deps = await db.Read<Department>().ToDictionaryAsync(d => d.Code, d => d.Name, ct);
            return (orgs, deps);
        })!;

    public void Invalidate(Guid userId) => cache.Remove($"assignments:{userId}");

    public async Task RecordLoginAsync(Guid userId, string? clientIp, string correlationId, CancellationToken cancellationToken)
    {
        await db.Set<User>().Where(u => u.Id == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.LastLoginAt, clock.UtcNow), cancellationToken);
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO hoso.access_events(user_id, action, object_type, object_id, client_ip, correlation_id) VALUES ({userId}, 'login', 'user', {userId}, {clientIp}::inet, {correlationId})",
            cancellationToken);
    }
}
