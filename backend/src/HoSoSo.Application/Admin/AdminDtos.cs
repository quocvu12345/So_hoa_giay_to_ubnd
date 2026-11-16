namespace HoSoSo.Application.Admin;

public sealed record AdminUserListItem(Guid Id, string Username, string DisplayName, string? Email, bool Active, bool IsDemo,
    DateTimeOffset? LastLoginAt, int ActiveAssignments, IReadOnlyList<string> Roles);

/// <summary>State: active | upcoming | ended.</summary>
public sealed record AdminAssignmentDto(Guid Id, string Role, string? OrganizationCode, string? DepartmentCode,
    DateTimeOffset ValidFrom, DateTimeOffset? ValidUntil, string Basis, bool IsDeputy, string State);

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
