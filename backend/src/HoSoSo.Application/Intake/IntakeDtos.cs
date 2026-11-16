namespace HoSoSo.Application.Intake;

public sealed record CreateBatchRequest(string? OrganizationCode, string? DepartmentCode, string? HandedOverBy, string? BoxLabel, int? ExpectedSheetCount, string? Note);

public sealed record BatchSummary(
    Guid Id, string Code, string OrganizationCode, string? DepartmentCode, string? BoxLabel, string? HandedOverBy,
    int? ExpectedSheetCount, int ScannedPageCount, int FileCount, string Status, DateTimeOffset OpenedAt, DateTimeOffset? ClosedAt, int OpenIssues);

public sealed record BatchFile(Guid DocumentId, Guid FileId, string FileName, int? PageCount, string? JobStatus, DateTimeOffset? UploadedAt);
public sealed record BatchDetail(BatchSummary Batch, IReadOnlyList<BatchFile> Files);

public sealed record UploadResult(Guid DocumentId, Guid FileId, Guid JobId, string FileName, long ByteSize);

/// <summary>Stage: queued | reading | ready | failed | cancelled. Khớp MockInboxItem của frontend.</summary>
public sealed record InboxItem(
    Guid DocumentId, Guid FileId, string FileName, int? PageCount, DateTimeOffset UploadedAt, string Stage,
    int? QueuePosition, string? Progress, string? Suggestion, int AttentionCount, Guid? JobId, string? Error, string IntakeStatus);

public sealed record JobDto(
    Guid Id, Guid DocumentId, Guid FileId, string JobType, string Status, string? Stage, int ProcessedPages, int? PageCount,
    int Attempt, int? QueuePosition, string? Error, IReadOnlyList<string> Warnings,
    DateTimeOffset CreatedAt, DateTimeOffset? StartedAt, DateTimeOffset? FinishedAt);
