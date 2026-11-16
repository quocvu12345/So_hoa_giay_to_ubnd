namespace HoSoSo.Domain.Entities;

public sealed class Dossier
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Code { get; set; }
    public string Origin { get; set; } = "internal";
    public required string Title { get; set; }
    public int Year { get; set; }
    public required string OrganizationCode { get; set; }
    public required string DepartmentCode { get; set; }
    public required string WorkGroupCode { get; set; }
    public string WorkflowCode { get; set; } = "in_progress";
    public string? CreatorOrganizationName { get; set; }
    public string? PhysicalLocation { get; set; }
    public Guid? AssigneeId { get; set; }
    public string Status { get; set; } = "draft";
    public DateOnly? InternalDueOn { get; set; }
    public string AccessLevel { get; set; } = "internal";
    public string Notes { get; set; } = "";
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? ArchivedAt { get; set; }
    public DateOnly? OpenedOn { get; set; }
    public DateOnly? ClosedOn { get; set; }
    public Guid? StorageLocationId { get; set; }
    public Guid? RetentionRuleId { get; set; }
    public string? ProcedureId { get; set; }
    public uint Version { get; set; }
}

public sealed class DossierDocument
{
    public Guid DossierId { get; init; }
    public Guid DocumentId { get; init; }
    public int Position { get; set; }
    public string? Direction { get; set; }
    public string RelationKind { get; set; } = "component";
    /// <summary>Thành phần của thủ tục (procedure_components) mà giấy tờ này đáp ứng; chỉ đặt khi hồ sơ có thủ tục.</summary>
    public Guid? ProcedureComponentId { get; set; }
    public Guid? AddedBy { get; set; }
    public DateTimeOffset AddedAt { get; set; }
}

public sealed class DossierAssignment
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid DossierId { get; set; }
    public Guid UserId { get; set; }
    public required string AssignmentRole { get; set; }
    public DateOnly? DueOn { get; set; }
    public Guid AssignedBy { get; set; }
    public DateTimeOffset AssignedAt { get; set; }
    public DateTimeOffset? EndedAt { get; set; }
    public string Note { get; set; } = "";
}

public sealed class WorkflowEvent : IAppendOnly
{
    public long Id { get; set; }
    public Guid DossierId { get; set; }
    public Guid ActorId { get; set; }
    public required string ActorRole { get; set; }
    public required string Action { get; set; }
    public string? FromState { get; set; }
    public required string ToState { get; set; }
    public required string Note { get; set; }
    public DateTimeOffset HappenedAt { get; set; }
}
