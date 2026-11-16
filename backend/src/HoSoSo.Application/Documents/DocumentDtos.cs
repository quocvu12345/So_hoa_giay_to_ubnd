namespace HoSoSo.Application.Documents;

public sealed record FileInfoDto(Guid Id, string Name, string MediaType, long ByteSize, int? PageCount, string Sha256);
public sealed record ClassificationDto(string WorkGroupCode, string WorkGroupTitle, string? DocumentTypeCode, string? DocumentTypeName, string Status);
public sealed record DossierRef(Guid Id, string Code, string Title, string Status);

public sealed record DocumentDetail(
    Guid Id, string Title, string DocumentForm, string? DocumentNumber, DateOnly? IssuedOn, string Origin, string IntakeStatus,
    string ReviewStatus, string MetadataStatus, uint Version, FileInfoDto? File, ClassificationDto? Classification, IReadOnlyList<DossierRef> Dossiers);

public sealed record ReviewSuggestion(
    long Id, string? WorkGroupCode, string? WorkGroupTitle, string? DocumentTypeCode, string? DocumentTypeName, string DocumentForm,
    string Title, string Reason, string Quote, bool EvidenceVerified, bool MixedDocuments, string? Decision, string ModelKey);

/// <summary>Một trường cần đối chiếu: giá trị AI gợi ý, trích dẫn nguồn, giá trị người dùng đã nhập và lý do cần chú ý.</summary>
public sealed record ReviewField(
    string FieldCode, string Label, int Position, string ValueType, bool Required,
    string? SuggestedValue, string? SuggestedQuote, IReadOnlyList<int> SourcePages, bool QuoteVerified,
    string? Value, bool NeedsReview, bool Verified, string? Attention);

public sealed record ReviewJob(Guid Id, string Status, string? Stage, int ProcessedPages, int? PageCount, string? Error);

public sealed record ReviewData(DocumentDetail Document, ReviewSuggestion? Suggestion, IReadOnlyList<ReviewField> Fields, ReviewJob? Job, bool CanEdit, string? LockedReason);

public sealed record ClassifyRequest(string WorkGroupCode, string DocumentTypeCode);
public sealed record FieldEdit(string FieldCode, string? Value, bool Verify);
public sealed record EditFieldsRequest(IReadOnlyList<FieldEdit> Fields);
