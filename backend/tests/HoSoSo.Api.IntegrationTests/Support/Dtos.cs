namespace HoSoSo.Api.IntegrationTests.Support;

// Bản sao tối thiểu của JSON mà API trả về, chỉ giữ những trường test dùng.
public sealed record PageDto<T>(List<T> Items, string? NextCursor);
public sealed record DossierItem(Guid Id, string Code, string Title, string Status, string StatusLabel, string DepartmentCode, string? AssigneeName, int DocumentCount, uint Version);
public sealed record DocumentItem(Guid DocumentId, int Position, string Title, string RelationKind, string? Direction);
public sealed record CompletenessDto(int ComponentCount, int VerifiedCount, int PendingFieldCount, bool Ready, List<string> Reasons);
public sealed record DossierDetailDto(Guid Id, string Code, string Title, string Status, string StatusLabel, string OrganizationCode, string DepartmentCode,
    string AccessLevel, Guid? AssigneeId, string? AssigneeName, uint Version, List<DocumentItem> Documents, CompletenessDto Completeness);
public sealed record ActionDto(string Action, string Label, bool RequiresNote, bool Primary, bool Enabled, string? DisabledReason, string ToState);
public sealed record TransitionDto(string Status, string StatusLabel);
public sealed record HistoryDto(string Action, string ActionLabel, string? FromState, string ToState, string Note, string ActorName, string ActorRole);
public sealed record QueueItemDto(Guid DossierId, string Code, string Status);
public sealed record WorkspaceDto(Dictionary<string, List<QueueItemDto>> Queues);
public sealed record SummaryDto(Dictionary<string, int> Counts, int Inbox, int UnreadNotifications);
public sealed record WorkGroupDto(string Code, string OrganizationCode, string DepartmentCode, string Title, int DocumentTypeCount);
public sealed record FieldDto(string Code, string Label, int Position);
public sealed record DocumentTypeDto(string Code, string Name, List<FieldDto> Fields);

public sealed record UploadDto(Guid DocumentId, Guid FileId, Guid JobId, string FileName, long ByteSize);
public sealed record InboxDto(Guid DocumentId, Guid FileId, string FileName, string Stage, int? QueuePosition, string? Progress, string? Suggestion, int AttentionCount, Guid? JobId, string IntakeStatus, string? QueueKind = null);
public sealed record JobDto(Guid Id, string Status, string? Stage, int ProcessedPages, int? PageCount, int? QueuePosition, string? Error, string? QueueKind = null, int? EtaSeconds = null);
public sealed record ReviewFieldDto(string FieldCode, string Label, string? SuggestedValue, bool QuoteVerified, string? Value, bool NeedsReview, bool Verified, string? Attention);
public sealed record ReviewSuggestionDto(string? WorkGroupCode, string? DocumentTypeCode, string DocumentForm, string Title, bool EvidenceVerified, string? Decision);
public sealed record ReviewDocumentDto(Guid Id, string Title, string DocumentForm, string IntakeStatus, string ReviewStatus, ClassificationDto? Classification);
public sealed record ClassificationDto(string WorkGroupCode, string? DocumentTypeCode, string Status);
public sealed record ReviewDto(ReviewDocumentDto Document, ReviewSuggestionDto? Suggestion, List<ReviewFieldDto> Fields, bool CanEdit, string? LockedReason);
