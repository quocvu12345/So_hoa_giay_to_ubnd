namespace HoSoSo.Domain.Entities;

public static class IntakeStatus
{
    public const string Inbox = "inbox";
    public const string Filed = "filed";
    public const string Discarded = "discarded";
    public const string Split = "split";
}

public sealed class Document
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public string? ExternalKey { get; set; }
    public required string Origin { get; set; }
    public required string Title { get; set; }
    public required string DocumentForm { get; set; }
    public string? DocumentNumber { get; set; }
    public DateOnly? IssuedOn { get; set; }
    public string? IssuerOrganizationCode { get; set; }
    public string? IssuerName { get; set; }
    public Guid? MetadataReviewedBy { get; set; }
    public DateTimeOffset? MetadataReviewedAt { get; set; }
    public string MetadataReviewNote { get; set; } = "";
    public string MetadataStatus { get; set; } = "unverified";
    public string DataReviewStatus { get; set; } = "pending";
    public Guid? ReviewedBy { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
    public string IntakeStatus { get; set; } = Entities.IntakeStatus.Filed;
    public Guid? UploadedBy { get; set; }
    public DateTimeOffset? DiscardedAt { get; set; }
    public string? SignerName { get; set; }
    public string? RecipientText { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    /// <summary>xmin của PostgreSQL: khóa lạc quan (BE-07).</summary>
    public uint Version { get; set; }
}

public sealed class FileRecord
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid DocumentId { get; set; }
    public string ComponentKey { get; set; } = "main";
    public int VersionNo { get; set; } = 1;
    public required string FileRole { get; set; }
    public required string OriginalName { get; set; }
    public required string MediaType { get; set; }
    public long ByteSize { get; set; }
    public required string Sha256 { get; set; }
    public int? PageCount { get; set; }
    public string? StorageKey { get; set; }
    public Guid? ScanBatchId { get; set; }
    public Guid? UploadedBy { get; set; }
    public DateTimeOffset? UploadedAt { get; set; }
    /// <summary>Đã hủy theo đề nghị hủy được phê duyệt: còn dòng metadata nhưng không còn nội dung.</summary>
    public DateTimeOffset? DisposedAt { get; set; }
}

public sealed class DocumentClassification
{
    public Guid DocumentId { get; init; }
    public required string WorkGroupCode { get; init; }
    public string? DocumentTypeCode { get; set; }
    public string ClassificationStatus { get; set; } = "proposed";
    public required string Basis { get; set; }
}

public sealed class DocumentFieldValue
{
    public Guid DocumentId { get; init; }
    public required string FieldDefinitionCode { get; init; }
    public string? ValueText { get; set; }
    public string? ValueNormalized { get; set; }
    public required string ValueOrigin { get; set; }
    public decimal? Confidence { get; set; }
    public Guid? SourceFileId { get; set; }
    public int? SourcePage { get; set; }
    /// <summary>Sao từ gợi ý AI khi chấp nhận (jsonb, cùng hình dạng với ai_field_suggestions.source_region).</summary>
    public string? SourceRegion { get; set; }
    public bool NeedsReview { get; set; } = true;
    public Guid? VerifiedBy { get; set; }
    public DateTimeOffset? VerifiedAt { get; set; }
    public long? AiFieldSuggestionId { get; set; }
    public uint Version { get; set; }
}

public sealed class DocumentRelation
{
    public Guid FromDocumentId { get; init; }
    public Guid ToDocumentId { get; init; }
    public required string Relation { get; init; }
    public string Note { get; set; } = "";
    public Guid? CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class DocumentSegment
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid SourceDocumentId { get; set; }
    public Guid SourceFileId { get; set; }
    public int PageFrom { get; set; }
    public int PageTo { get; set; }
    public Guid? TargetDocumentId { get; set; }
    public required string ProposedBy { get; set; }
    public string Status { get; set; } = "proposed";
    public Guid? ConfirmedBy { get; set; }
    public DateTimeOffset? ConfirmedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class FileSignature
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid FileId { get; set; }
    public string? SignerName { get; set; }
    public string? CertificateSerial { get; set; }
    public string? CertificateIssuer { get; set; }
    public DateTimeOffset? SignedAt { get; set; }
    public required string VerificationStatus { get; set; }
    public required string VerifierVersion { get; set; }
    public DateTimeOffset VerifiedAt { get; set; }
    public string Details { get; set; } = "{}";
}
