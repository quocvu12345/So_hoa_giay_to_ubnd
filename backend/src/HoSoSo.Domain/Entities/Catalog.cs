namespace HoSoSo.Domain.Entities;

public sealed class Department
{
    public required string Code { get; init; }
    public required string Name { get; set; }
    public required string Kind { get; set; }
    public required string AssignmentNote { get; set; }
    public string VerificationStatus { get; set; } = "proposed";
}

public sealed class WorkGroup
{
    public required string Code { get; init; }
    public required string OrganizationCode { get; set; }
    public required string DepartmentCode { get; set; }
    public required string Title { get; set; }
    public required string Responsibility { get; set; }
    public required string FilingRule { get; set; }
    public required string BusinessFields { get; set; }
    public string VerificationStatus { get; set; } = "proposed";
    public bool Active { get; set; } = true;
}

public sealed class DocumentType
{
    public required string Code { get; init; }
    public required string WorkGroupCode { get; set; }
    public required string Name { get; set; }
    public string? DocumentForm { get; set; }
    public bool RequiredInDossier { get; set; }
    public short MinCount { get; set; } = 1;
    public bool Active { get; set; } = true;
}

public sealed class FieldDefinition
{
    public required string Code { get; init; }
    public required string DocumentTypeCode { get; set; }
    public required string Label { get; set; }
    public int Position { get; set; }
    public string ValueType { get; set; } = "text";
    public bool RequiredForReview { get; set; }
    public string? FieldGroup { get; set; }
    public bool IsKeyField { get; set; }
    public string? ValidationPattern { get; set; }
}

public sealed class WorkflowState
{
    public required string Code { get; init; }
    public required string Label { get; set; }
}

public sealed class WorkflowTransition
{
    public required string WorkflowCode { get; init; }
    public required string FromState { get; init; }
    public required string Action { get; init; }
    public required string ActorRole { get; init; }
    public required string ToState { get; set; }
    public bool RequiresVerifiedDocuments { get; set; }
    public bool RequiresNote { get; set; }
}

public sealed class DepartmentScope
{
    public required string DepartmentCode { get; init; }
    public required string OrganizationCode { get; init; }
}

public sealed class RetentionRule
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string WorkGroupCode { get; set; }
    public string? DocumentTypeCode { get; set; }
    public required string RetentionLabel { get; set; }
    public short? RetentionYears { get; set; }
    public string? LegalReference { get; set; }
    public string Status { get; set; } = "proposed";
    public Guid? ProposedBy { get; set; }
    public Guid? ConfirmedBy { get; set; }
    public DateTimeOffset? ConfirmedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class Procedure
{
    public required string Id { get; init; }
    public string? ProcedureCode { get; set; }
    public required string Name { get; set; }
    public string? Domain { get; set; }
    public string? ManagingAgency { get; set; }
    public string? ExecutionLevel { get; set; }
    public string? CompetentAuthority { get; set; }
    public string? Fees { get; set; }
    public string? ReceivingLocation { get; set; }
    public string? MinistryDecision { get; set; }
    public string? HanoiDecision { get; set; }
    public string? WorkflowDecision { get; set; }
    public string? DelegationDecision { get; set; }
    public string? DelegationExpiry { get; set; }
    public string? SourceUrl { get; set; }
    public int? SourcePage { get; set; }
    public string LifecycleStatus { get; set; } = "unverified";
    public DateTimeOffset? CollectedAt { get; set; }
}

public sealed class ProcedureComponent
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string ProcedureId { get; set; }
    public string Section { get; set; } = "";
    public int Position { get; set; }
    public required string Name { get; set; }
    public string? PaperCode { get; set; }
    public short OriginalQuantity { get; set; }
    public short CopyQuantity { get; set; }
    public bool RequiredAsPublished { get; set; }
    public bool HasElectronicForm { get; set; }
}

public sealed class FormTemplate
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Kind { get; set; }
    public required string Filename { get; set; }
    public required string Sha256 { get; set; }
    public long ByteSize { get; set; }
    public string MediaType { get; set; } = "application/octet-stream";
    public string? StorageKey { get; set; }
    public string? SourceUrl { get; set; }
    public string? VersionLabel { get; set; }
    public Guid? SupersededBy { get; set; }
}

public sealed class ProcedureComponentTemplate
{
    public Guid ComponentId { get; init; }
    public Guid TemplateId { get; init; }
}

public sealed class ProcedureLifecycleEvent
{
    public long Id { get; set; }
    public required string ProcedureCode { get; set; }
    public required string Status { get; set; }
    public required string Label { get; set; }
    public string Note { get; set; } = "";
    public string Evidence { get; set; } = "[]";
    public DateOnly? EffectiveFrom { get; set; }
    public DateOnly? ReviewedOn { get; set; }
}

public sealed class ProcedureTemplate
{
    public required string ProcedureId { get; init; }
    public Guid TemplateId { get; init; }
}
