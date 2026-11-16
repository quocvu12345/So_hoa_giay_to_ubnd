namespace HoSoSo.Application.Common;

/// <summary>
/// Người dùng của request hiện tại cùng phân công đang dùng (header X-Assignment-Id).
/// Mọi use case lấy người thao tác từ đây, không bao giờ nhận id người dùng từ client.
/// </summary>
public interface ICurrentUser
{
    bool IsAuthenticated { get; }
    /// <summary>users.id dạng chuỗi (claim "sub" sau khi đăng nhập); ghi vào audit_events.actor_subject.</summary>
    string? Subject { get; }
    Guid? UserId { get; }
    string? Username { get; }
    string? DisplayName { get; }
    /// <summary>user_roles.id của phân công đang dùng, hoặc "d:{delegationId}" khi dùng quyền được ủy.</summary>
    string? ActiveAssignmentId { get; }
    string? Role { get; }
    string? OrganizationCode { get; }
    string? DepartmentCode { get; }
    IReadOnlyCollection<string> Permissions { get; }
    string CorrelationId { get; }
    bool Has(string permission);
}

public static class CurrentUserExtensions
{
    /// <summary>Id người dùng, hoặc 401 nếu chưa đăng nhập.</summary>
    public static Guid RequireUserId(this ICurrentUser user) =>
        user.UserId ?? throw new AppException(401, ErrorCodes.Unauthenticated, "Bạn cần đăng nhập để tiếp tục.");

    public static string RequireRole(this ICurrentUser user) =>
        user.Role ?? throw new AppException(403, ErrorCodes.Forbidden, "Tài khoản chưa có phân công đang hiệu lực.");

    /// <summary>
    /// Mã phân công đang dùng (user_roles.id hoặc "d:{delegationId}"). Phạm vi hồ sơ luôn tính theo ĐÚNG phân công này (hoso.scope_matches),
    /// không theo vai trò chung, để quyền và phạm vi của hai phân công khác nhau không trộn lẫn.
    /// </summary>
    public static string RequireAssignment(this ICurrentUser user) =>
        user.ActiveAssignmentId ?? throw new AppException(403, ErrorCodes.Forbidden, "Tài khoản chưa có phân công đang hiệu lực.");
}
