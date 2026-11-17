namespace HoSoSo.Domain.Entities;

public sealed class StorageLocation
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid? ParentId { get; set; }
    public required string Kind { get; init; }
    public required string Code { get; init; }
    public required string Name { get; set; }
    public required string OrganizationCode { get; init; }
    public required string QrPayload { get; init; }
    public string? CapacityNote { get; set; }
    public bool Active { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class DossierLocationMove
{
    public long Id { get; set; }
    public Guid DossierId { get; set; }
    public Guid? FromLocationId { get; set; }
    public Guid? ToLocationId { get; set; }
    public Guid? MovedBy { get; set; }
    public DateTimeOffset MovedAt { get; set; }
    public string Note { get; set; } = "";
}

public static class LoanStatus
{
    public const string Requested = "requested";
    public const string Approved = "approved";
    public const string Lent = "lent";
    public const string Returned = "returned";
    public const string Rejected = "rejected";
    public const string Overdue = "overdue";
}

public sealed class Loan
{
    public uint Version { get; set; }
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid DossierId { get; set; }
    public Guid BorrowerId { get; set; }
    public required string Purpose { get; set; }
    public string Status { get; set; } = LoanStatus.Requested;
    public DateTimeOffset RequestedAt { get; set; }
    public Guid? ApprovedBy { get; set; }
    public DateTimeOffset? ApprovedAt { get; set; }
    public DateOnly? DueOn { get; set; }
    public DateTimeOffset? LentAt { get; set; }
    public DateTimeOffset? ReturnedAt { get; set; }
    public string ConditionNote { get; set; } = "";
    public string DecisionNote { get; set; } = "";
}

public sealed class ArchiveSubmission
{
    public uint Version { get; set; }
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Code { get; set; }
    public required string OrganizationCode { get; set; }
    public string Status { get; set; } = "draft";
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public Guid? SubmittedBy { get; set; }
    public DateTimeOffset? SubmittedAt { get; set; }
    public Guid? ReceivedBy { get; set; }
    public DateTimeOffset? ReceivedAt { get; set; }
    public Guid? MinutesDocumentId { get; set; }
    public string Note { get; set; } = "";
    public string ReturnNote { get; set; } = "";
}

public sealed class ArchiveSubmissionItem
{
    public Guid SubmissionId { get; init; }
    public Guid DossierId { get; init; }
    public int PageCount { get; set; }
    public string CheckResult { get; set; } = "ok";
    public string Note { get; set; } = "";
}

public sealed class ExportPackage
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid RequestedBy { get; set; }
    public string Scope { get; set; } = "{}";
    public string Format { get; set; } = "zip_pdf_json";
    public string Status { get; set; } = "queued";
    public int TotalItems { get; set; }
    public int ProcessedItems { get; set; }
    public string? StorageKey { get; set; }
    public string? ManifestSha256 { get; set; }
    public long? ByteSize { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ReadyAt { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? HeartbeatAt { get; set; }
    /// <summary>Mã phân công đã dùng khi tạo gói (user_roles.id hoặc "d:{delegationId}"); tải gói phải dùng đúng phân công này (BE-91).</summary>
    public string? RequestedAssignment { get; set; }
}

public sealed class DisposalRequest
{
    public int FilesDisposed { get; set; }
    public int DocumentsKept { get; set; }
    public uint Version { get; set; }
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid DossierId { get; set; }
    public Guid RetentionRuleId { get; set; }
    public required string Reason { get; set; }
    public string Status { get; set; } = "requested";
    public Guid RequestedBy { get; set; }
    public DateTimeOffset RequestedAt { get; set; }
    public Guid? DecidedBy { get; set; }
    public Guid? DecisionDocumentId { get; set; }
    public string DecisionNote { get; set; } = "";
    public DateTimeOffset? DecidedAt { get; set; }
    public Guid? ExecutedBy { get; set; }
    public DateTimeOffset? ExecutedAt { get; set; }
}

/// <summary>Danh sách xóa bền vững; worker chỉ hoàn tất sau khi xóa hoặc xác nhận nội dung còn được dùng chung.</summary>
public sealed class DisposalBlobDeletion
{
    public Guid RequestId { get; set; }
    public required string StorageKey { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public bool Deleted { get; set; }
    public int Attempts { get; set; }
    public DateTimeOffset NextAttemptAt { get; set; }
    public string? LastError { get; set; }
}
