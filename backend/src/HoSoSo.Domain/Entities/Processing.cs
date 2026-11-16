namespace HoSoSo.Domain.Entities;

public static class JobStatus
{
    public const string Queued = "queued";
    public const string Running = "running";
    public const string Completed = "completed";
    public const string Failed = "failed";
    public const string Cancelled = "cancelled";
}

public sealed class ScanBatch
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Code { get; set; }
    public required string OrganizationCode { get; set; }
    public string? DepartmentCode { get; set; }
    public string? HandedOverBy { get; set; }
    public Guid ReceivedBy { get; set; }
    public string? BoxLabel { get; set; }
    public int? ExpectedSheetCount { get; set; }
    public int ScannedPageCount { get; set; }
    public string Status { get; set; } = "open";
    public string Note { get; set; } = "";
    public DateTimeOffset OpenedAt { get; set; }
    public DateTimeOffset? ClosedAt { get; set; }
}

public sealed class PageImage
{
    public Guid FileId { get; init; }
    public int PageNo { get; init; }
    public string[] QualityFlags { get; set; } = [];
    public string QualityStatus { get; set; } = "ok";
    /// <summary>Khóa kho tệp của ảnh WebP xem trước (BE-43); rỗng khi chưa ai xem trang này.</summary>
    public string? PreviewStorageKey { get; set; }
}

public sealed class OcrJob
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid FileId { get; set; }
    public string Provider { get; set; } = "hoso-ai-worker";
    public string ModelVersion { get; set; } = "unspecified";
    public string JobType { get; set; } = "read_classify";
    /// <summary>jsonb dạng chuỗi: correlation_id, classify, force_ocr, pages, target_job_id.</summary>
    public string Options { get; set; } = "{}";
    public string Status { get; set; } = JobStatus.Queued;
    public string? Stage { get; set; }
    public int? PageCount { get; set; }
    public int ProcessedPages { get; set; }
    public short Priority { get; set; } = 5;
    public short Attempt { get; set; }
    public Guid? RequestedBy { get; set; }
    public string? LockedBy { get; set; }
    public DateTimeOffset? HeartbeatAt { get; set; }
    public string Warnings { get; set; } = "[]";
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? FinishedAt { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class OcrPage
{
    public Guid JobId { get; init; }
    public int PageNo { get; init; }
    public string Method { get; set; } = "ocr";
    public string Text { get; set; } = "";
    public string Status { get; set; } = "completed";
    public decimal ElapsedSeconds { get; set; }
}

public sealed class AiSuggestion
{
    public long Id { get; set; }
    public Guid JobId { get; set; }
    public Guid DocumentId { get; set; }
    public string? WorkGroupCode { get; set; }
    public string? DocumentTypeCode { get; set; }
    public string DocumentForm { get; set; } = "";
    public string Title { get; set; } = "";
    public string Reason { get; set; } = "";
    public string Quote { get; set; } = "";
    public bool EvidenceVerified { get; set; }
    public bool MixedDocuments { get; set; }
    public required string ModelKey { get; set; }
    public string? Decision { get; set; }
    public Guid? DecidedBy { get; set; }
    public DateTimeOffset? DecidedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class AiFieldSuggestion
{
    public long Id { get; set; }
    public long SuggestionId { get; set; }
    public required string FieldDefinitionCode { get; set; }
    public string Value { get; set; } = "";
    public string Quote { get; set; } = "";
    public int[] SourcePages { get; set; } = [];
    public bool QuoteVerified { get; set; }
    public decimal? Confidence { get; set; }
}

public sealed class Notification
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public required string Kind { get; set; }
    public required string Title { get; set; }
    public string Body { get; set; } = "";
    public string? Link { get; set; }
    public Guid? DossierId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ReadAt { get; set; }
}

public sealed class OutboxMessage
{
    public long Id { get; set; }
    public required string Type { get; set; }
    public string Payload { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset NextAttemptAt { get; set; }
    public DateTimeOffset? ProcessedAt { get; set; }
    public short Attempts { get; set; }
    public string? LastError { get; set; }
}

public sealed class QualityIssue
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid? ScanBatchId { get; set; }
    public Guid? DocumentId { get; set; }
    public Guid? FileId { get; set; }
    public int? PageNo { get; set; }
    public required string IssueType { get; set; }
    public string Severity { get; set; } = "medium";
    public string Description { get; set; } = "";
    public string Status { get; set; } = "open";
    public Guid? RaisedBy { get; set; }
    public DateTimeOffset RaisedAt { get; set; }
    public Guid? ResolvedBy { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
}
