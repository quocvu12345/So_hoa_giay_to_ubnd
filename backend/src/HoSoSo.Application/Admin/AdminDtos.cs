namespace HoSoSo.Application.Admin;

/// <summary>
/// BE-121 (FE-42): <c>ExpiringAssignments</c> = số phân công đang hiệu lực sẽ hết trong <see cref="AdminHandler.ExpiringWithinDays"/> ngày tới
/// (chip vàng); <c>NextAssignmentEndsAt</c> = ngày hết sớm nhất trong các phân công đang hiệu lực có hạn.
/// </summary>
public sealed record AdminUserListItem(Guid Id, string Username, string DisplayName, string? Email, bool Active, bool IsDemo,
    DateTimeOffset? LastLoginAt, int ActiveAssignments, IReadOnlyList<string> Roles, int ExpiringAssignments = 0, DateTimeOffset? NextAssignmentEndsAt = null);

/// <summary>State: active | upcoming | ended. <c>EndsSoon</c>: đang hiệu lực và hết trong 7 ngày tới (BE-121).</summary>
public sealed record AdminAssignmentDto(Guid Id, string Role, string? OrganizationCode, string? DepartmentCode,
    DateTimeOffset ValidFrom, DateTimeOffset? ValidUntil, string Basis, bool IsDeputy, string State, bool EndsSoon = false);

public sealed record AdminDelegationDto(Guid Id, Guid FromAssignmentId, string FromRole, Guid ToUserId, string ToUsername,
    IReadOnlyList<string> PermissionCodes, DateTimeOffset ValidFrom, DateTimeOffset ValidUntil, string Basis, DateTimeOffset? RevokedAt, string State);

public sealed record AdminUserDetail(AdminUserListItem User, string? ExternalAuthSubject,
    IReadOnlyList<AdminAssignmentDto> Assignments, IReadOnlyList<AdminDelegationDto> Delegations);

public sealed record CreateUserRequest(string Username, string DisplayName, string? Email, string? ExternalAuthSubject);
public sealed record UpdateUserRequest(string? DisplayName, string? Email, bool? Active, string? ExternalAuthSubject);
public sealed record CreateAssignmentRequest(Guid UserId, string RoleCode, string? OrganizationCode, string? DepartmentCode,
    DateTimeOffset? ValidFrom, DateTimeOffset? ValidUntil, string Basis, bool? IsDeputy);
public sealed record CreateDelegationRequest(Guid FromAssignmentId, Guid ToUserId, IReadOnlyList<string> PermissionCodes,
    DateTimeOffset? ValidFrom, DateTimeOffset ValidUntil, string Basis);

/// <summary>BE-127 (FE-42). Một vai trò kèm quyền (mã và mô tả) theo bảng role_permissions: nguồn để màn ủy quyền chỉ cho chọn phần quyền người ủy quyền thật sự có.</summary>
public sealed record RoleInfo(string Code, string Name, string ScopeKind, IReadOnlyList<PermissionInfo> Permissions);
public sealed record PermissionInfo(string Code, string Description);
