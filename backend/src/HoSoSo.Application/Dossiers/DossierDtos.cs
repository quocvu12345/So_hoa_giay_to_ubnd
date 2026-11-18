namespace HoSoSo.Application.Dossiers;

public sealed record DossierListItem(
    Guid Id, string Code, string Title, string Status, string StatusLabel,
    string WorkGroupCode, string WorkGroupTitle, string DepartmentCode,
    string? AssigneeName, DateOnly? DueOn, DateTimeOffset UpdatedAt,
    int DocumentCount, int VerifiedCount, uint Version);

public sealed record DossierDocumentItem(
    Guid DocumentId, int Position, string Title, string DocumentForm, string? DocumentNumber, DateOnly? IssuedOn,
    string? Direction, string RelationKind, string ReviewStatus, string IntakeStatus, int PendingFields, Guid? ProcedureComponentId = null, string MetadataStatus = "unverified");

public sealed record DossierDetail(
    Guid Id, string Code, string Title, string Status, string StatusLabel, string WorkflowCode,
    string OrganizationCode, string DepartmentCode, string WorkGroupCode, string WorkGroupTitle,
    string AccessLevel, string Notes, string? PhysicalLocation, string? CreatorOrganizationName,
    Guid? AssigneeId, string? AssigneeName, DateOnly? DueOn, int Year,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, DateTimeOffset? ArchivedAt, uint Version,
    IReadOnlyList<DossierDocumentItem> Documents, Completeness Completeness, string? ProcedureId = null, string? ProcedureName = null, DossierRetention? Retention = null);

/// <summary>
/// BE-130. Thời hạn bảo quản áp cho hồ sơ. <c>Status</c>: <c>confirmed</c> (có quy tắc ĐÃ xác nhận, kèm <c>Label</c>, <c>Years</c>, căn cứ pháp lý) |
/// <c>proposed</c> (nhóm chỉ có đề xuất, chưa có hiệu lực) | <c>ambiguous</c> (nhóm có nhiều quy tắc đã xác nhận mà hồ sơ chưa gán quy tắc nào: không đoán) | <c>none</c>.
/// <c>EligibleSince</c> chỉ có khi đã lưu trữ và có số năm; <c>Eligible</c>: đã đủ hạn để đề nghị hủy.
/// </summary>
public sealed record DossierRetention(string Status, string? Label, short? Years, string? LegalReference, DateTimeOffset? EligibleSince, bool Eligible);

public sealed record Completeness(int ComponentCount, int VerifiedCount, int PendingFieldCount, bool Ready, IReadOnlyList<string> Reasons);

/// <summary>Một giấy tờ trong hồ sơ. <c>ComponentId</c> là thành phần thủ tục mà giấy tờ này đáp ứng (nếu đã gán).</summary>
public sealed record ChecklistItem(Guid DocumentId, string Title, string State, int PendingFields, bool Classified, Guid? ComponentId = null);

/// <summary>
/// Một thành phần hồ sơ của thủ tục. <c>State</c>: <c>ok</c> (có giấy tờ và tất cả đã đối chiếu), <c>pending</c> (có giấy tờ nhưng còn cái chưa đối chiếu),
/// <c>missing</c> (chưa có giấy tờ nào). <c>Required</c> theo bản công bố; mục không bắt buộc chỉ mang tính nhắc.
/// </summary>
public sealed record ChecklistComponent(
    Guid ComponentId, string Section, int Position, string Name, bool Required, int OriginalQuantity, int CopyQuantity, bool HasElectronicForm,
    string State, IReadOnlyList<Guid> DocumentIds, string Todo);

/// <summary>Tóm tắt theo thủ tục. <c>Enforced</c> = cơ quan đã bật cài đặt <c>dossier.enforce_procedure_components</c>: thiếu thành phần bắt buộc thì khóa các bước cần giấy tờ đã đối chiếu; chưa bật thì chỉ cảnh báo.</summary>
public sealed record ProcedureCompleteness(int RequiredCount, int RequiredOk, int RequiredPending, int RequiredMissing, bool AllRequiredOk, string? Warning, bool Enforced = false);

public sealed record Checklist(
    Completeness Summary, IReadOnlyList<ChecklistItem> Items,
    string? ProcedureId = null, string? ProcedureName = null, IReadOnlyList<ChecklistComponent>? Components = null, ProcedureCompleteness? Procedure = null);

public sealed record AllowedAction(string Action, string Label, bool RequiresNote, bool Primary, bool Enabled, string? DisabledReason, string ToState, string? Warning = null);

public sealed record HistoryItem(long Id, string Action, string ActionLabel, string? FromState, string ToState, string Note, string ActorName, string ActorRole, DateTimeOffset At);

public sealed record TransitionResult(string Status, string StatusLabel);

public sealed record QueueItem(Guid DossierId, string Code, string Title, string Status, string StatusLabel, DateOnly? DueOn, DateTimeOffset UpdatedAt);
public sealed record Workspace(IReadOnlyDictionary<string, IReadOnlyList<QueueItem>> Queues);
public sealed record WorkspaceSummary(IReadOnlyDictionary<string, int> Counts, int Inbox, int UnreadNotifications);

// Yêu cầu
/// <summary>
/// Bộ lọc danh sách hồ sơ (BE-111). Year: năm hồ sơ; AssigneeId: người chủ trì; Overdue: quá hạn nội bộ; LocationId: vị trí kho và mọi vị trí con.
/// Sort: updated (mặc định, mới nhất trước), code, title, due (chưa có hạn xếp cuối); Dir: asc hoặc desc.
/// Status, WorkGroupCode: một hoặc nhiều giá trị cách nhau dấu phẩy (tối đa 12).
/// </summary>
public sealed record ListDossiersQuery(string? Status, string? Q, string? DepartmentCode, string? WorkGroupCode, bool Mine, string? Cursor, int Limit = 25,
    int? Year = null, Guid? AssigneeId = null, bool Overdue = false, Guid? LocationId = null, string? Sort = null, string? Dir = null);
public sealed record CreateDossierRequest(string Title, string WorkGroupCode, string? WorkflowCode, string? AccessLevel, string? Notes, DateOnly? InternalDueOn, string? CreatorOrganizationName, int? Year, string? ProcedureId = null);
/// <summary><c>ProcedureId</c>: null giữ nguyên, chuỗi rỗng bỏ thủ tục, giá trị khác đổi thủ tục (giấy tờ đã gán thành phần của thủ tục cũ được gỡ gán).</summary>
public sealed record UpdateDossierRequest(uint Version, string? Title, string? Notes, DateOnly? InternalDueOn, string? AccessLevel, string? PhysicalLocation, string? ProcedureId = null);
public sealed record AddDocumentRequest(Guid DocumentId, string? Direction, Guid? ProcedureComponentId = null);
/// <summary><c>ProcedureComponentId</c> gán giấy tờ vào thành phần của thủ tục; <c>ClearProcedureComponent</c> gỡ gán.</summary>
public sealed record DocumentPlacement(Guid DocumentId, int? Position, string? Direction, string? RelationKind, Guid? ProcedureComponentId = null, bool ClearProcedureComponent = false);
public sealed record AssignRequest(Guid UserId, DateOnly? DueOn, string? Note);

/// <summary>
/// BE-110. Một người có thể được giao làm người chủ trì hồ sơ. <c>Holding</c>: số hồ sơ họ đang chủ trì và chưa lưu trữ; <c>Overdue</c>: trong đó số hồ sơ quá hạn nội bộ
/// (hạn trước hôm nay, giờ Việt Nam). <c>IsDeputy</c>: phân công kiêm nhiệm. <c>IsCurrent</c>: đang là người chủ trì hồ sơ này.
/// </summary>
public sealed record AssigneeOption(Guid UserId, string DisplayName, bool IsDeputy, bool IsCurrent, int Holding, int Overdue);
public sealed record TransitionRequest(string Action, string? Note, long? Version);
