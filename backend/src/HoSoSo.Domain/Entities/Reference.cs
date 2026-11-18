namespace HoSoSo.Domain.Entities;

// Bảng tham chiếu và nhật ký còn lại (BE-06, BE-07). Trước đây đọc/ghi bằng SQL; có entity để dùng EF khi cần và để test ghi–đọc từng bảng.

/// <summary>Vai trò (employee, manager, clerk, ...). <c>ScopeKind</c>: assigned, department, organization, technical.</summary>
public sealed class Role
{
    public required string Code { get; init; }
    public required string Name { get; set; }
    public required string ScopeKind { get; set; }
}

public sealed class Permission
{
    public required string Code { get; init; }
    public required string Description { get; set; }
}

/// <summary>Nguồn gốc văn bản công khai: địa chỉ đã tải, thời điểm và mã băm phản hồi để kiểm chứng lại sau.</summary>
public sealed class Source
{
    public required string Id { get; init; }
    public required string Publisher { get; set; }
    public required string Url { get; set; }
    public required string ResolvedUrl { get; set; }
    public DateTimeOffset RetrievedAt { get; set; }
    public required string ResponseSha256 { get; set; }
    public required string VerificationNote { get; set; }
}

public sealed class WorkflowDefinition
{
    public required string Code { get; init; }
    public required string Name { get; set; }
    public required string Description { get; set; }
}

/// <summary>Tên gọi của cơ quan theo từng thời kỳ (sáp nhập, đổi tên); giấy tờ cũ vẫn đối chiếu được với tên lúc ban hành.</summary>
public sealed class OrganizationName
{
    public long Id { get; set; }
    public required string OrganizationCode { get; set; }
    public required string Name { get; set; }
    public DateOnly? ValidFrom { get; set; }
    public DateOnly? ValidUntil { get; set; }
    public string Basis { get; set; } = "";
}

/// <summary>Loại giấy tờ theo danh mục thủ tục. <c>Names</c> là mảng JSON các tên gọi khác.</summary>
public sealed class PaperType
{
    public required string Code { get; init; }
    public required string CanonicalName { get; set; }
    public string Names { get; set; } = "[]";
}

/// <summary>Thủ tục thuộc đơn vị nào xử lý; <c>VerificationStatus</c>: proposed hoặc confirmed.</summary>
public sealed class ProcedureDepartment
{
    public required string ProcedureId { get; init; }
    public required string DepartmentCode { get; init; }
    public required string OrganizationCode { get; init; }
    public string VerificationStatus { get; set; } = "proposed";
}

/// <summary>Tọa độ một trường trên biểu mẫu. <c>Bbox</c> là JSON (hộp bao quanh).</summary>
public sealed class FormTemplateField
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid TemplateId { get; set; }
    public required string FieldKey { get; set; }
    public required string Label { get; set; }
    public int Page { get; set; } = 1;
    public string? Bbox { get; set; }
    public string InputType { get; set; } = "text";
    public string? Role { get; set; }
}

/// <summary>Bộ đếm cấp mã hồ sơ theo cơ quan và năm. Chỉ hàm <c>hoso.next_dossier_code</c> được tăng; không sửa tay.</summary>
public sealed class DossierCodeSequence
{
    public required string OrganizationCode { get; init; }
    public int Year { get; init; }
    public int LastValue { get; set; }
}

/// <summary>Cho một người xem/tải/in một hồ sơ hoặc giấy tờ hạn chế trong thời hạn, có lý do (từ 10 ký tự). Thu hồi bằng <c>RevokedAt</c>, không xóa.</summary>
public sealed class DocumentAccessGrant
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid? DossierId { get; set; }
    public Guid? DocumentId { get; set; }
    public Guid GranteeUserId { get; set; }
    public required string Access { get; set; }
    public DateTimeOffset ValidUntil { get; set; }
    public required string Reason { get; set; }
    public Guid GrantedBy { get; set; }
    public DateTimeOffset GrantedAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
}

/// <summary>Đánh dấu bảng chỉ thêm: CSDL chặn sửa và xóa bằng trigger, và <c>HoSoDbContext</c> từ chối lưu thay đổi sửa/xóa trước khi gửi đi.</summary>
public interface IAppendOnly;

/// <summary>Ai xem, tải, in, xuất, tìm gì. Phân vùng theo tháng nên khóa là (Id, HappenedAt).</summary>
public sealed class AccessEvent : IAppendOnly
{
    public long Id { get; set; }
    public Guid? UserId { get; set; }
    public Guid? UserRoleId { get; set; }
    public required string Action { get; set; }
    public string? ObjectType { get; set; }
    public Guid? ObjectId { get; set; }
    public System.Net.IPAddress? ClientIp { get; set; }
    public string? CorrelationId { get; set; }
    /// <summary>Mã phân công đang dùng (user_roles.id hoặc "d:{delegationId}"). <c>UserRoleId</c> chỉ có với phân công riêng.</summary>
    public string? Assignment { get; set; }
    public DateTimeOffset HappenedAt { get; set; }
}

/// <summary>
/// BE-117. Một Mã lỗi đã trả cho người dùng, để quản trị tra ra request và người. Ghi ở nền bằng <c>ErrorEventRecorder</c> (không qua EF); EF chỉ đọc.
/// Không có nội dung request, chuỗi truy vấn hay thông điệp ngoại lệ.
/// </summary>
public sealed class ErrorEvent : IAppendOnly
{
    public long Id { get; set; }
    public required string ErrorId { get; set; }
    public string? CorrelationId { get; set; }
    public short Status { get; set; }
    public required string ErrorCode { get; set; }
    public required string Method { get; set; }
    public required string Path { get; set; }
    public Guid? UserId { get; set; }
    public string? Assignment { get; set; }
    public DateTimeOffset HappenedAt { get; set; }
}

/// <summary>Nhật ký thay đổi do trigger ghi. <c>OldRow</c>/<c>NewRow</c> là JSON của dòng; có thể chứa dữ liệu cá nhân nên API quản trị chỉ trả tên cột đã đổi.</summary>
public sealed class AuditEvent : IAppendOnly
{
    public long Id { get; set; }
    public required string TableName { get; set; }
    public required string Operation { get; set; }
    public required string DatabaseUser { get; set; }
    public string? ActorSubject { get; set; }
    public string? OldRow { get; set; }
    public string? NewRow { get; set; }
    public DateTimeOffset HappenedAt { get; set; }
}

/// <summary>
/// Phiên đăng nhập phía máy chủ (BE-12). <c>Ticket</c> là vé xác thực đã tuần tự hóa (có id_token, không có access/refresh token), chỉ <c>PostgresTicketStore</c> đọc;
/// mọi chỗ khác chỉ nên xem trạng thái (người dùng, thời hạn, thu hồi). Thu hồi bằng <c>RevokedAt</c>, không xóa.
/// </summary>
public sealed class AuthSession
{
    public required string Id { get; init; }
    public Guid UserId { get; set; }
    public required byte[] Ticket { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset RenewedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public string? RevokedReason { get; set; }
}
