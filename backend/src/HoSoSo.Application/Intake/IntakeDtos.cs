namespace HoSoSo.Application.Intake;

public sealed record CreateBatchRequest(string? OrganizationCode, string? DepartmentCode, string? HandedOverBy, string? BoxLabel, int? ExpectedSheetCount, string? Note);

/// <summary>BE-125. Có lý do (từ 10 ký tự) thì các lỗi ảnh còn mở của lô được chấp nhận bỏ qua cùng lúc đóng lô.</summary>
public sealed record CloseBatchRequest(string? AcceptOpenIssuesNote);

public sealed record BatchSummary(
    Guid Id, string Code, string OrganizationCode, string? DepartmentCode, string? BoxLabel, string? HandedOverBy,
    int? ExpectedSheetCount, int ScannedPageCount, int FileCount, string Status, DateTimeOffset OpenedAt, DateTimeOffset? ClosedAt, int OpenIssues);

public sealed record BatchFile(Guid DocumentId, Guid FileId, string FileName, int? PageCount, string? JobStatus, DateTimeOffset? UploadedAt);
public sealed record BatchDetail(BatchSummary Batch, IReadOnlyList<BatchFile> Files);

public sealed record UploadResult(Guid DocumentId, Guid FileId, Guid JobId, string FileName, long ByteSize);
/// <summary>BE-126. <c>Classify</c>: AI có phân loại/trích lại không (chỉ khi giấy tờ còn ở hộp tiếp nhận). <c>ReviewReset</c>: giấy tờ đã xác nhận dữ liệu nên về chờ xác nhận lại.</summary>
public sealed record ReplacementResult(Guid DocumentId, Guid FileId, Guid ReplacedFileId, int VersionNo, Guid JobId, string FileName, long ByteSize, int? PageCount,
    bool Classify, int IssuesClosed, bool ReviewReset);

/// <summary>Stage: queued | reading | ready | failed | cancelled. Khớp MockInboxItem của frontend. QueueKind: priority | interactive | background (BE-97).</summary>
public sealed record InboxItem(
    Guid DocumentId, Guid FileId, string FileName, int? PageCount, DateTimeOffset UploadedAt, string Stage,
    int? QueuePosition, string? Progress, string? Suggestion, int AttentionCount, Guid? JobId, string? Error, string IntakeStatus,
    string? QueueKind = null, int? EtaSeconds = null);

/// <summary>
/// BE-129. Bộ lọc hộp tiếp nhận, áp trên TOÀN BỘ hộp (không chỉ trang đã tải). <c>Read</c>: một hoặc nhiều tình trạng đọc cách nhau dấu phẩy
/// (queued | reading | ready | failed | cancelled, trùng <see cref="InboxItem.Stage"/>); <c>Batch</c>: lô quét của tệp; <c>Group</c>, <c>Type</c>: nhóm hồ sơ và loại giấy tờ
/// của gợi ý AI mới nhất.
/// </summary>
public sealed record InboxFilter(string? Read = null, Guid? Batch = null, string? Group = null, string? Type = null);

/// <summary>BE-129. Số PDF theo tình trạng đọc của một thẻ hộp tiếp nhận, áp cùng lô/nhóm/loại nhưng KHÔNG áp <c>Read</c> (để các nút lọc hiện đúng số).</summary>
public sealed record InboxSummary(int Total, int Queued, int Reading, int Ready, int Failed, int Cancelled);

public sealed record JobDto(
    Guid Id, Guid DocumentId, Guid FileId, string JobType, string Status, string? Stage, int ProcessedPages, int? PageCount,
    int Attempt, int? QueuePosition, string? Error, IReadOnlyList<string> Warnings,
    DateTimeOffset CreatedAt, DateTimeOffset? StartedAt, DateTimeOffset? FinishedAt,
    string QueueKind = QueuePriority.KindBackground, int? EtaSeconds = null);
