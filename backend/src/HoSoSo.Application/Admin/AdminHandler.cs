using System.Text.RegularExpressions;
using FluentValidation;
using HoSoSo.Application.Common;
using HoSoSo.Application.Dossiers;
using HoSoSo.Domain.Entities;
using HoSoSo.Domain.Identity;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Admin;

/// <summary>
/// BE-34. Quản trị người dùng, phân công có thời hạn (kèm căn cứ) và ủy quyền. Chỉ quyền admin.users.
/// Mọi thay đổi có hiệu lực ngay (xóa bộ nhớ phân công của người bị ảnh hưởng) và được ghi vết bằng trigger audit_change.
/// Hai điều luôn giữ: không khóa/kết thúc phân công của quản trị cuối cùng, và quản trị không tự khóa mình.
/// </summary>
public sealed class AdminHandler(IHoSoDb db, ICurrentUser user, IClock clock, IIdentityService identity)
{
    public static readonly TimeSpan MaxDelegation = TimeSpan.FromDays(90);

    /// <param name="expiring">true: chỉ người có phân công đang hiệu lực hết trong <see cref="ExpiringWithinDays"/> ngày tới (BE-121).</param>
    public async Task<IReadOnlyList<AdminUserListItem>> ListUsersAsync(string? q, bool? active, CancellationToken ct, bool expiring = false)
    {
        var users = db.Read<User>();
        if (active is { } a) users = users.Where(u => u.Active == a);
        if (expiring)
        {
            var now = clock.UtcNow;
            var soon = now.AddDays(ExpiringWithinDays);
            users = users.Where(u => db.Read<UserRole>().Any(r => r.UserId == u.Id && r.ValidFrom <= now && r.ValidUntil > now && r.ValidUntil <= soon));
        }
        if (q is { Length: > 1 } text)
            users = users.Where(u => HoSoDbContextFunctions.Fold(u.Username + " " + u.DisplayName).Contains(HoSoDbContextFunctions.Fold(text)));
        var rows = await users.OrderBy(u => u.Username).Take(500).ToListAsync(ct);
        return await ToListItemsAsync(rows, ct);
    }

    /// <summary>Các vai trò và quyền của từng vai trò (đọc từ CSDL, không chép tay).</summary>
    public async Task<IReadOnlyList<RoleInfo>> RolesAsync(CancellationToken ct)
    {
        var roles = await db.Read<Role>().OrderBy(r => r.Code).ToListAsync(ct);
        var descriptions = await db.Read<Permission>().ToDictionaryAsync(p => p.Code, p => p.Description, ct);
        var granted = (await db.Read<RolePermission>().Select(p => new { p.RoleCode, p.PermissionCode }).ToListAsync(ct)).ToLookup(p => p.RoleCode, p => p.PermissionCode);
        return roles.Select(r => new RoleInfo(r.Code, r.Name, r.ScopeKind,
            granted[r.Code].Order().Select(c => new PermissionInfo(c, descriptions.GetValueOrDefault(c, ""))).ToList())).ToList();
    }

    public async Task<AdminUserDetail> GetUserAsync(Guid id, CancellationToken ct)
    {
        var u = await db.Read<User>().SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw AppException.NotFound("người dùng");
        var item = (await ToListItemsAsync([u], ct)).Single();
        var now = clock.UtcNow;
        var assignments = (await db.Read<UserRole>().Where(r => r.UserId == id).OrderByDescending(r => r.ValidFrom).ToListAsync(ct))
            .Select(r => ToDto(r, now)).ToList();
        var delegations = await (from d in db.Read<Delegation>()
                                 join r in db.Read<UserRole>() on d.FromUserRoleId equals r.Id
                                 join t in db.Read<User>() on d.ToUserId equals t.Id
                                 where r.UserId == id || d.ToUserId == id
                                 orderby d.ValidFrom descending
                                 select new { d, r.RoleCode, t.Username }).ToListAsync(ct);
        return new AdminUserDetail(item, u.ExternalAuthSubject, assignments, delegations.Select(x => new AdminDelegationDto(
            x.d.Id, x.d.FromUserRoleId, x.RoleCode, x.d.ToUserId, x.Username, x.d.PermissionCodes, x.d.ValidFrom, x.d.ValidUntil, x.d.Basis, x.d.RevokedAt,
            x.d.RevokedAt is not null ? "revoked" : x.d.ValidUntil <= now ? "ended" : x.d.ValidFrom > now ? "upcoming" : "active")).ToList());
    }

    public async Task<AdminUserDetail> CreateUserAsync(CreateUserRequest r, CancellationToken ct)
    {
        var entity = new User
        {
            Username = r.Username.Trim().ToLowerInvariant(), DisplayName = r.DisplayName.Trim(),
            Email = string.IsNullOrWhiteSpace(r.Email) ? null : r.Email.Trim(),
            ExternalAuthSubject = string.IsNullOrWhiteSpace(r.ExternalAuthSubject) ? null : r.ExternalAuthSubject.Trim(),
        };
        db.Set<User>().Add(entity);
        await db.SaveChangesAsync(ct);   // trùng tên đăng nhập / mã danh tính: unique violation → 409 duplicate_value
        return await GetUserAsync(entity.Id, ct);
    }

    public async Task<AdminUserDetail> UpdateUserAsync(Guid id, UpdateUserRequest r, CancellationToken ct)
    {
        var u = await db.Set<User>().SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw AppException.NotFound("người dùng");
        if (r.Active == false && u.Active)
        {
            if (id == user.RequireUserId()) throw AppException.Conflict("Không thể tự khóa tài khoản của chính mình.");
            await EnsureAnotherAdminAsync(id, ct, "Không thể khóa quản trị cuối cùng: hệ thống sẽ không còn ai quản trị được người dùng.");
        }
        if (r.DisplayName is not null) u.DisplayName = r.DisplayName.Trim();
        if (r.Email is not null) u.Email = r.Email.Trim().Length == 0 ? null : r.Email.Trim();
        if (r.ExternalAuthSubject is not null) u.ExternalAuthSubject = r.ExternalAuthSubject.Trim().Length == 0 ? null : r.ExternalAuthSubject.Trim();
        var locking = r.Active == false && u.Active;
        if (r.Active is { } active) u.Active = active;
        await db.SaveChangesAsync(ct);
        identity.Invalidate(id);
        // Khóa tài khoản thì mọi phiên đang mở bị thu hồi ngay (cookie cũ nhận 401 ở request kế tiếp).
        if (locking)
        {
            await RevokeSessionsAsync(id, "account_locked", ct);
            await RevokeExportsAsync(id, null, "Tài khoản bị khóa.", ct);
        }
        return await GetUserAsync(id, ct);
    }

    /// <summary>Buộc đăng xuất mọi phiên của một người (thiết bị bị mất, nghi ngờ lộ cookie). Trả số phiên đã thu hồi.</summary>
    public async Task<int> RevokeUserSessionsAsync(Guid id, CancellationToken ct)
    {
        if (!await db.Read<User>().AnyAsync(u => u.Id == id, ct)) throw AppException.NotFound("người dùng");
        return await RevokeSessionsAsync(id, "admin_revoked", ct);
    }

    private Task<int> RevokeExportsAsync(Guid userId, string? assignment, string reason, CancellationToken ct) =>
        db.Database.ExecuteSqlInterpolatedAsync($"SELECT hoso.revoke_exports({userId}, {assignment}, {reason})", ct);

    private Task<int> RevokeSessionsAsync(Guid id, string reason, CancellationToken ct) =>
        db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE hoso.auth_sessions SET revoked_at = now(), revoked_reason = {reason} WHERE user_id = {id} AND revoked_at IS NULL", ct);

    public async Task<AdminAssignmentDto> CreateAssignmentAsync(CreateAssignmentRequest r, CancellationToken ct)
    {
        if (!await db.Read<User>().AnyAsync(u => u.Id == r.UserId, ct)) throw AppException.NotFound("người dùng");
        var errors = RoleShapeErrors(r.RoleCode, r.OrganizationCode, r.DepartmentCode);
        var from = r.ValidFrom ?? clock.UtcNow;
        if (r.ValidUntil is { } until && until <= from) errors["validUntil"] = ["Ngày hết hạn phải sau ngày bắt đầu."];
        if (errors.Count > 0) throw new ValidationFailedException(errors);

        var entity = new UserRole
        {
            UserId = r.UserId, RoleCode = r.RoleCode, OrganizationCode = r.OrganizationCode, DepartmentCode = r.DepartmentCode,
            ValidFrom = from, ValidUntil = r.ValidUntil, AssignmentBasis = r.Basis.Trim(), IsDeputy = r.IsDeputy ?? false,
        };
        db.Set<UserRole>().Add(entity);
        await db.SaveChangesAsync(ct);    // đơn vị không thuộc cơ quan: foreign key → 422
        identity.Invalidate(r.UserId);
        return ToDto(entity, clock.UtcNow);
    }

    public async Task<AdminAssignmentDto> EndAssignmentAsync(Guid id, CancellationToken ct)
    {
        var role = await db.Set<UserRole>().SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw AppException.NotFound("phân công");
        var now = clock.UtcNow;
        if (role.ValidUntil is { } until && until <= now) throw AppException.Conflict("Phân công này đã kết thúc.");
        if (role.ValidFrom > now) throw AppException.Conflict("Phân công chưa bắt đầu. Tạo lại với thời gian đúng thay vì kết thúc.");
        if (role.RoleCode == RoleCode.TechnicalAdmin)
            await EnsureAnotherAdminAsync(role.UserId, ct, "Không thể kết thúc phân công quản trị cuối cùng.", excludeRole: role.Id);
        // Hết hiệu lực kể từ giây sau để ràng buộc valid_until > valid_from luôn đúng với phân công vừa tạo.
        role.ValidUntil = now > role.ValidFrom ? now : role.ValidFrom.AddSeconds(1);
        await db.SaveChangesAsync(ct);
        identity.Invalidate(role.UserId);
        // Gói xuất tạo bằng phân công này không còn tải được (BE-91).
        await RevokeExportsAsync(role.UserId, role.Id.ToString(), "Phân công đã kết thúc.", ct);
        return ToDto(role, now);
    }

    public async Task<AdminDelegationDto> CreateDelegationAsync(CreateDelegationRequest r, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var source = await (from role in db.Read<UserRole>()
                            join owner in db.Read<User>() on role.UserId equals owner.Id
                            where role.Id == r.FromAssignmentId
                            select new { role, owner }).SingleOrDefaultAsync(ct) ?? throw AppException.NotFound("phân công của người ủy quyền");
        var to = await db.Read<User>().SingleOrDefaultAsync(u => u.Id == r.ToUserId && u.Active, ct)
            ?? throw new ValidationFailedException(new Dictionary<string, string[]> { ["toUserId"] = ["Người nhận ủy quyền không tồn tại hoặc đã bị khóa."] });
        var from = r.ValidFrom ?? now;
        var errors = new Dictionary<string, string[]>();
        if (to.Id == source.role.UserId) errors["toUserId"] = ["Không thể ủy quyền cho chính mình."];
        if (source.role.ValidUntil is { } roleEnd && roleEnd <= now) errors["fromAssignmentId"] = ["Phân công của người ủy quyền đã hết hiệu lực."];
        if (r.ValidUntil <= from) errors["validUntil"] = ["Ngày hết hạn phải sau ngày bắt đầu."];
        else if (r.ValidUntil - from > MaxDelegation) errors["validUntil"] = [$"Ủy quyền tối đa {MaxDelegation.TotalDays:0} ngày; cần kéo dài thì tạo ủy quyền mới."];
        var granted = (await db.Read<RolePermission>().Where(p => p.RoleCode == source.role.RoleCode).Select(p => p.PermissionCode).ToListAsync(ct)).ToHashSet();
        var beyond = r.PermissionCodes.Where(c => !granted.Contains(c)).ToList();
        if (beyond.Count > 0) errors["permissionCodes"] = [$"Vai trò {source.role.RoleCode} không có quyền: {string.Join(", ", beyond)}. Chỉ ủy quyền được phần mình đang có."];
        if (errors.Count > 0) throw new ValidationFailedException(errors);

        var entity = new Delegation
        {
            FromUserRoleId = source.role.Id, ToUserId = to.Id, PermissionCodes = r.PermissionCodes.Distinct().ToArray(),
            ValidFrom = from, ValidUntil = r.ValidUntil, Basis = r.Basis.Trim(), CreatedBy = user.RequireUserId(),
        };
        db.Set<Delegation>().Add(entity);
        await db.SaveChangesAsync(ct);
        identity.Invalidate(to.Id);
        identity.Invalidate(source.role.UserId);
        return new AdminDelegationDto(entity.Id, entity.FromUserRoleId, source.role.RoleCode, to.Id, to.Username, entity.PermissionCodes,
            entity.ValidFrom, entity.ValidUntil, entity.Basis, null, from > now ? "upcoming" : "active");
    }

    public async Task RevokeDelegationAsync(Guid id, CancellationToken ct)
    {
        var d = await db.Set<Delegation>().SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw AppException.NotFound("ủy quyền");
        if (d.RevokedAt is not null) throw AppException.Conflict("Ủy quyền này đã được thu hồi.");
        d.RevokedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        identity.Invalidate(d.ToUserId);
        await RevokeExportsAsync(d.ToUserId, $"d:{d.Id}", "Ủy quyền đã bị thu hồi.", ct);
    }

    // ---- nội bộ ----
    /// <summary>Hình dạng hợp lệ của phân công theo vai trò (khớp CHECK của user_roles) kèm thông điệp rõ ràng.</summary>
    internal static Dictionary<string, string[]> RoleShapeErrors(string role, string? organization, string? department)
    {
        var errors = new Dictionary<string, string[]>();
        if (!RoleCode.All.Contains(role)) { errors["roleCode"] = ["Vai trò không hợp lệ."]; return errors; }
        switch (role)
        {
            case RoleCode.TechnicalAdmin:
                if (organization is not null || department is not null) errors["organizationCode"] = ["Quản trị kỹ thuật không gắn cơ quan hay đơn vị."];
                break;
            case RoleCode.Employee or RoleCode.Manager:
                if (organization is null) errors["organizationCode"] = ["Chuyên viên và trưởng phòng cần chọn cơ quan."];
                if (department is null) errors["departmentCode"] = ["Chuyên viên và trưởng phòng cần chọn đơn vị (phòng/Ban)."];
                break;
            default:
                if (organization is null) errors["organizationCode"] = ["Vai trò này cần chọn cơ quan."];
                break;
        }
        return errors;
    }

    private async Task EnsureAnotherAdminAsync(Guid userId, CancellationToken ct, string message, Guid? excludeRole = null)
    {
        var now = clock.UtcNow;
        var others = await (from r in db.Read<UserRole>()
                            join u in db.Read<User>() on r.UserId equals u.Id
                            where r.RoleCode == RoleCode.TechnicalAdmin && u.Active && r.Id != excludeRole
                                  && (r.UserId != userId || excludeRole != null) && r.ValidFrom <= now && (r.ValidUntil == null || r.ValidUntil > now)
                            select r.UserId).Distinct().CountAsync(ct);
        // Khi khóa người dùng: đếm admin khác họ. Khi kết thúc một phân công: đếm mọi phân công admin còn lại (kể cả của chính người đó).
        if (others == 0) throw AppException.Conflict(message);
    }

    private async Task<IReadOnlyList<AdminUserListItem>> ToListItemsAsync(IReadOnlyList<User> users, CancellationToken ct)
    {
        var ids = users.Select(u => u.Id).ToList();
        var now = clock.UtcNow;
        var roles = await db.Read<UserRole>().Where(r => ids.Contains(r.UserId) && r.ValidFrom <= now && (r.ValidUntil == null || r.ValidUntil > now))
            .Select(r => new { r.UserId, r.RoleCode, r.ValidUntil }).ToListAsync(ct);
        var soon = now.AddDays(ExpiringWithinDays);
        return users.Select(u =>
        {
            var mine = roles.Where(r => r.UserId == u.Id).ToList();
            return new AdminUserListItem(u.Id, u.Username, u.DisplayName, u.Email, u.Active, u.IsDemo, u.LastLoginAt, mine.Count,
                mine.Select(r => r.RoleCode).Distinct().Order().ToList(),
                mine.Count(r => r.ValidUntil <= soon), mine.Where(r => r.ValidUntil is not null).Min(r => r.ValidUntil));
        }).ToList();
    }

    /// <summary>Phân công hết trong số ngày này được coi là "sắp hết hạn" (FE-42: chip vàng).</summary>
    public const int ExpiringWithinDays = 7;

    private static AdminAssignmentDto ToDto(UserRole r, DateTimeOffset now)
    {
        var state = r.ValidUntil is { } until && until <= now ? "ended" : r.ValidFrom > now ? "upcoming" : "active";
        return new(r.Id, r.RoleCode, r.OrganizationCode, r.DepartmentCode, r.ValidFrom, r.ValidUntil, r.AssignmentBasis, r.IsDeputy, state,
            state == "active" && r.ValidUntil <= now.AddDays(ExpiringWithinDays));
    }
}

public sealed partial class CreateUserValidator : AbstractValidator<CreateUserRequest>
{
    [GeneratedRegex("^[a-z0-9][a-z0-9._-]{2,49}$")]
    private static partial Regex Username();

    public CreateUserValidator()
    {
        RuleFor(x => x.Username).Must(v => v is not null && Username().IsMatch(v.Trim().ToLowerInvariant()))
            .WithMessage("Tên đăng nhập 3–50 ký tự gồm chữ thường không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.");
        RuleFor(x => x.DisplayName).NotEmpty().WithMessage("Nhập họ tên hiển thị.").MaximumLength(200).WithMessage("Họ tên tối đa 200 ký tự.");
        RuleFor(x => x.Email).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email)).WithMessage("Email không hợp lệ.");
        RuleFor(x => x.ExternalAuthSubject).MaximumLength(200).WithMessage("Mã danh tính tối đa 200 ký tự.");
    }
}

public sealed class UpdateUserValidator : AbstractValidator<UpdateUserRequest>
{
    public UpdateUserValidator()
    {
        RuleFor(x => x.DisplayName).NotEmpty().MaximumLength(200).When(x => x.DisplayName is not null).WithMessage("Họ tên từ 1 đến 200 ký tự.");
        RuleFor(x => x.Email).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email)).WithMessage("Email không hợp lệ.");
    }
}

public sealed class CreateAssignmentValidator : AbstractValidator<CreateAssignmentRequest>
{
    public CreateAssignmentValidator()
    {
        RuleFor(x => x.UserId).NotEmpty().WithMessage("Chọn người dùng.");
        RuleFor(x => x.RoleCode).NotEmpty().WithMessage("Chọn vai trò.");
        RuleFor(x => x.Basis).Must(v => v is not null && v.Trim().Length >= 10).WithMessage("Ghi căn cứ phân công (số quyết định, văn bản) từ 10 ký tự.");
    }
}

public sealed class CreateDelegationValidator : AbstractValidator<CreateDelegationRequest>
{
    public CreateDelegationValidator()
    {
        RuleFor(x => x.FromAssignmentId).NotEmpty().WithMessage("Chọn phân công của người ủy quyền.");
        RuleFor(x => x.ToUserId).NotEmpty().WithMessage("Chọn người nhận ủy quyền.");
        RuleFor(x => x.PermissionCodes).NotEmpty().WithMessage("Chọn ít nhất một quyền được ủy.");
        RuleFor(x => x.Basis).Must(v => v is not null && v.Trim().Length >= 10).WithMessage("Ghi căn cứ ủy quyền từ 10 ký tự.");
    }
}
