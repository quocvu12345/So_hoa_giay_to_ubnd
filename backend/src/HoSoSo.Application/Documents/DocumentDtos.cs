namespace HoSoSo.Application.Documents;

public sealed record FileInfoDto(Guid Id, string Name, string MediaType, long ByteSize, int? PageCount, string Sha256);
/// <summary>
/// BE-113. Một phiên bản tệp của giấy tờ. <c>Kind</c>: original (bản quét hoặc bản gốc), replacement (bản gốc thay thế, VersionNo &gt; 1),
/// derivative (bản dẫn xuất: PDF có lớp chữ, biên bản), signed (bản có chữ ký số). <c>IsCurrent</c>: phiên bản mới nhất còn nội dung của cùng thành phần và loại.
/// <c>Disposed</c>: đã hủy theo đề nghị được duyệt, còn dòng metadata nhưng không còn nội dung. Không có khóa kho hay đường dẫn trên máy.
/// </summary>
public sealed record FileVersionDto(
    Guid Id, string ComponentKey, int VersionNo, string Role, string Kind, string Name, string MediaType, long ByteSize, int? PageCount, string Sha256,
    DateTimeOffset? UploadedAt, string? UploadedByName, bool Disposed, bool IsCurrent);
public sealed record ClassificationDto(string WorkGroupCode, string WorkGroupTitle, string? DocumentTypeCode, string? DocumentTypeName, string Status);
public sealed record DossierRef(Guid Id, string Code, string Title, string Status);

public sealed record DocumentDetail(
    Guid Id, string Title, string DocumentForm, string? DocumentNumber, DateOnly? IssuedOn, string Origin, string IntakeStatus,
    string ReviewStatus, string MetadataStatus, uint Version, FileInfoDto? File, ClassificationDto? Classification, IReadOnlyList<DossierRef> Dossiers, Guid? MetadataReviewedBy = null, DateTimeOffset? MetadataReviewedAt = null, string MetadataReviewNote = "", string? MetadataReviewedByName = null,
    IReadOnlyList<FileVersionDto>? Files = null);

public sealed record ReviewSuggestion(
    long Id, string? WorkGroupCode, string? WorkGroupTitle, string? DocumentTypeCode, string? DocumentTypeName, string DocumentForm,
    string Title, string Reason, string Quote, bool EvidenceVerified, bool MixedDocuments, string? Decision, string ModelKey);

/// <summary>
/// Một trường cần đối chiếu: giá trị AI gợi ý, trích dẫn nguồn, giá trị người dùng đã nhập và lý do cần chú ý.
/// SourceRegion (BE-114): vùng chứa trích dẫn trên trang để làm nổi khi bấm trường; null nếu engine không biết vùng.
/// Confidence: 0..1 do engine ước, null nếu không có (không phải xác suất đúng đã hiệu chỉnh).
/// </summary>
public sealed record ReviewField(
    string FieldCode, string Label, int Position, string ValueType, bool Required,
    string? SuggestedValue, string? SuggestedQuote, IReadOnlyList<int> SourcePages, bool QuoteVerified,
    string? Value, bool NeedsReview, bool Verified, string? Attention,
    SourceRegionDto? SourceRegion = null, decimal? Confidence = null);

/// <summary>
/// BE-119. Một trường đã đối chiếu, cho người chỉ xem. Không kèm giá trị AI gợi ý hay trích dẫn thô: chỉ giá trị đang lưu,
/// nguồn gốc, và cờ EditedFromAi: AI đã gợi ý một giá trị mà người dùng đổi hoặc xóa. AI để trống rồi người dùng tự điền thì không tính (Origin = manual).
/// </summary>
public sealed record DocumentFieldView(
    string FieldCode, string Label, int Position, string ValueType, string? Value, bool Verified, string Origin, bool EditedFromAi,
    string? VerifiedByName, DateTimeOffset? VerifiedAt, int? SourcePage, SourceRegionDto? SourceRegion);

/// <summary>Trường của giấy tờ theo loại ĐÃ XÁC NHẬN (chưa xác nhận loại thì danh sách rỗng: chưa có gợi ý AI nào được lộ ra cho người chỉ xem).</summary>
public sealed record DocumentFieldsData(
    Guid DocumentId, ClassificationDto? Classification, string ReviewStatus, string? ReviewedByName, DateTimeOffset? ReviewedAt,
    IReadOnlyList<DocumentFieldView> Fields);

public sealed record ReviewJob(Guid Id, string Status, string? Stage, int ProcessedPages, int? PageCount, string? Error);

public sealed record ReviewData(DocumentDetail Document, ReviewSuggestion? Suggestion, IReadOnlyList<ReviewField> Fields, ReviewJob? Job, bool CanEdit, string? LockedReason);

public sealed record ClassifyRequest(string WorkGroupCode, string DocumentTypeCode);
public sealed record FieldEdit(string FieldCode, string? Value, bool Verify);
public sealed record EditFieldsRequest(IReadOnlyList<FieldEdit> Fields);

/// <summary>Người dùng đã kiểm tra thông tin đầu văn bản; Version chống ghi đè bản người khác vừa sửa.</summary>
public sealed record ReviewMetadataRequest(uint Version, string Title, string DocumentForm, string? DocumentNumber, DateOnly? IssuedOn, string? Note);
