namespace HoSoSo.Application.Common;

/// <summary>Một phân công đang hiệu lực của người dùng: vai trò, phạm vi và quyền kèm theo.</summary>
public sealed record ActiveAssignment(
    string Id,
    string Role,
    string? OrganizationCode,
    string? OrganizationName,
    string? DepartmentCode,
    string? DepartmentName,
    bool IsDeputy,
    DateTimeOffset? DelegatedUntil,
    IReadOnlySet<string> Permissions);

public sealed record LoginUser(Guid Id, string Username, string DisplayName, bool Active, bool IsDemo);

/// <summary>Tra cứu người dùng và phân công (BE-12, BE-13). Kết quả phân công được nhớ 60 giây.</summary>
public interface IIdentityService
{
    Task<LoginUser?> FindByUsernameAsync(string username, CancellationToken cancellationToken);
    Task<LoginUser?> FindByExternalSubjectAsync(string subject, CancellationToken cancellationToken);
    Task<IReadOnlyList<LoginUser>> ListDemoUsersAsync(CancellationToken cancellationToken);
    /// <summary>Các phân công còn hiệu lực (của chính mình và được ủy quyền). Phần tử đầu là mặc định.</summary>
    Task<IReadOnlyList<ActiveAssignment>> ListAssignmentsAsync(Guid userId, CancellationToken cancellationToken);
    /// <summary>Bỏ phân công đang nhớ của người dùng để thay đổi của quản trị có hiệu lực ngay (không chờ 60 giây).</summary>
    void Invalidate(Guid userId);
    Task RecordLoginAsync(Guid userId, string? clientIp, string correlationId, CancellationToken cancellationToken);
}

/// <summary>
/// Nhật ký truy cập (BE-16, BE-94). Hai mức:
/// <see cref="Record"/> không chặn request (xếp hàng, ghi lô nền, thử lại khi CSDL lỗi, đếm và cảnh báo khi mất dòng): dùng cho xem danh sách, tìm kiếm.
/// <see cref="RecordDurableAsync"/> ghi ĐỒNG BỘ trước khi trả nội dung: dùng khi đưa nội dung giấy tờ ra khỏi hệ thống (xem tệp, tải, xuất gói, hồ sơ hạn chế).
/// Không ghi được thì ném 503 `audit_unavailable`, tức là không trả nội dung mà không có dấu vết.
/// </summary>
public interface IAccessLog
{
    void Record(string action, string objectType, Guid? objectId);
    Task RecordDurableAsync(string action, string objectType, Guid? objectId, CancellationToken cancellationToken);
}
