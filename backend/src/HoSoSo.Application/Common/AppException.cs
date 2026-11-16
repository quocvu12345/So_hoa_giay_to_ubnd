namespace HoSoSo.Application.Common;

/// <summary>
/// Lỗi nghiệp vụ có mã và mã HTTP rõ ràng; GlobalExceptionHandler chuyển thành ProblemDetails.
/// Thông điệp viết cho người dùng: nói sai gì và cách sửa.
/// </summary>
public class AppException(int status, string code, string message, object? details = null) : Exception(message)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
    public object? Details { get; } = details;

    public static AppException NotFound(string what) => new(404, ErrorCodes.NotFound, $"Không tìm thấy {what} hoặc {what} không thuộc phạm vi của bạn.");
    public static AppException OutOfScope() => new(403, ErrorCodes.OutOfScope, "Hồ sơ này không thuộc phạm vi phân công đang dùng.");
    public static AppException Conflict(string message) => new(409, ErrorCodes.WorkflowConflict, message);
}

/// <summary>Mã lỗi thống nhất giữa API và frontend (docs/02-kien-truc-server.md mục 6).</summary>
public static class ErrorCodes
{
    public const string ValidationFailed = "validation_failed";
    public const string Unauthenticated = "unauthenticated";
    public const string OutOfScope = "out_of_scope";
    public const string Forbidden = "forbidden";
    public const string NotFound = "not_found";
    public const string WorkflowConflict = "workflow_conflict";
    public const string ConcurrencyConflict = "concurrency_conflict";
    public const string DuplicateFile = "duplicate_file";
    public const string DossierIncomplete = "dossier_incomplete";
    public const string NoteRequired = "note_required";
    public const string CsrfFailed = "csrf_failed";
    public const string NotImplemented = "not_implemented";
    public const string Internal = "internal_error";
}
