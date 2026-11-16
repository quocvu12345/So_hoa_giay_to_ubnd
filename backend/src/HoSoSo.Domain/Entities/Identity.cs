namespace HoSoSo.Domain.Entities;

public sealed class User
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Username { get; set; }
    public required string DisplayName { get; set; }
    public string? Email { get; set; }
    public string? ExternalAuthSubject { get; set; }
    public bool IsDemo { get; set; }
    public bool Active { get; set; } = true;
    public DateTimeOffset? LastLoginAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class UserRole
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public required string RoleCode { get; set; }
    public string? OrganizationCode { get; set; }
    public string? DepartmentCode { get; set; }
    public DateTimeOffset ValidFrom { get; set; }
    public DateTimeOffset? ValidUntil { get; set; }
    public required string AssignmentBasis { get; set; }
    public bool IsDeputy { get; set; }
}

public sealed class Delegation
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid FromUserRoleId { get; set; }
    public Guid ToUserId { get; set; }
    public required string[] PermissionCodes { get; set; }
    public DateTimeOffset ValidFrom { get; set; }
    public DateTimeOffset ValidUntil { get; set; }
    public required string Basis { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
}

public sealed class RolePermission
{
    public required string RoleCode { get; init; }
    public required string PermissionCode { get; init; }
}
