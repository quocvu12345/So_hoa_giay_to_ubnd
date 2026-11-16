using System.Security.Cryptography;
using HoSoSo.Application.Common;
using HoSoSo.Domain.Common;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Sentry;

namespace HoSoSo.Api.Errors;

/// <summary>
/// Một chỗ duy nhất chuyển exception thành ProblemDetails (docs/06-log-va-giam-sat.md):
/// - Lỗi nghiệp vụ (4xx): ghi Warning, trả thông điệp rõ cho người dùng.
/// - Lỗi hệ thống (5xx): ghi Error kèm stack, gửi GlitchTip nếu bật, người dùng chỉ thấy Mã lỗi.
/// Mọi phản hồi lỗi có errorId (mã ngắn để người dùng báo) và correlationId.
/// </summary>
internal sealed class GlobalExceptionHandler(IProblemDetailsService problemDetails, ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        var (status, code, title, detail) = Map(exception);
        var errorId = Convert.ToHexString(RandomNumberGenerator.GetBytes(4));

        if (status >= 500)
        {
            // DETAIL của PostgreSQL chứa giá trị dữ liệu ("Key (email)=(a@b.c) already exists"): log và GlitchTip chỉ nhận bản đã lược.
            var loggable = Scrubbed(exception);
            logger.LogError(loggable, "unhandled_exception {ErrorId} {ErrorCode} {Path}", errorId, code, context.Request.Path.Value);
            if (SentrySdk.IsEnabled)
            {
                SentrySdk.CaptureException(loggable, scope =>
                {
                    scope.SetTag("error_id", errorId);
                    scope.SetTag("correlation_id", context.TraceIdentifier);
                });
            }
        }
        else
        {
            logger.LogWarning("request_rejected {ErrorId} {ErrorCode} {Status} {Path}", errorId, code, status, context.Request.Path.Value);
        }

        context.Response.StatusCode = status;
        var problem = new ProblemDetails
        {
            Status = status,
            Type = $"https://hoso.local/errors/{code}",
            Title = title,
            Detail = detail,
        };
        problem.Extensions["errorId"] = errorId;
        if (exception is ValidationFailedException validation)
        {
            problem.Extensions["errors"] = validation.Errors;
        }
        else if (exception is AppException { Details: not null } app)
        {
            problem.Extensions["details"] = app.Details;
        }

        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            Exception = exception,
            ProblemDetails = problem,
        });
    }

    /// <summary>
    /// SEC-07. Lỗi có PostgresException bên trong được thay bằng bản chỉ giữ loại lỗi gốc, SQLSTATE, thông điệp (không chứa giá trị), tên bảng, ràng buộc
    /// và dấu vết gọi hàm; bỏ Detail/Where vì chúng ghi nguyên giá trị của dòng dữ liệu.
    /// </summary>
    private static Exception Scrubbed(Exception exception) => InnerPostgres(exception) is { } pg ? new ScrubbedDatabaseException(exception, pg) : exception;

    private sealed class ScrubbedDatabaseException(Exception original, PostgresException pg)
        : Exception($"{original.GetType().Name}: PostgreSQL {pg.SqlState} {pg.MessageText} (table={pg.TableName}, constraint={pg.ConstraintName})")
    {
        public override string? StackTrace => original.StackTrace ?? pg.StackTrace;
    }

    private static PostgresException? InnerPostgres(Exception exception)
    {
        for (var e = exception; e is not null; e = e.InnerException)
        {
            if (e is PostgresException pg) return pg;
        }
        return null;
    }

    private static bool IsTooLarge(Exception exception)
    {
        for (var e = exception; e is not null; e = e.InnerException)
        {
            if (e is BadHttpRequestException { StatusCode: StatusCodes.Status413PayloadTooLarge }) return true;
            if (e.Message.Contains("too large", StringComparison.OrdinalIgnoreCase) || e.Message.Contains("body length limit", StringComparison.OrdinalIgnoreCase)) return true;
        }
        return false;
    }

    private static (int Status, string Code, string Title, string Detail) Map(Exception exception) => exception switch
    {
        AppException app => (app.Status, app.Code, "Không thực hiện được", app.Message),
        DomainException domain => (StatusCodes.Status422UnprocessableEntity, domain.Code, "Không thực hiện được", domain.Message),
        DbUpdateConcurrencyException => (StatusCodes.Status409Conflict, ErrorCodes.ConcurrencyConflict, "Dữ liệu vừa được người khác sửa",
            "Hồ sơ vừa được cập nhật bởi người khác. Tải lại trang để xem bản mới rồi thử lại."),
        // EF bọc lỗi PostgreSQL trong DbUpdateException (insert/update) hoặc InvalidOperationException (truy vấn): lấy lỗi gốc ra để ánh xạ.
        _ when InnerPostgres(exception) is { } pg => MapDatabaseError(pg),
        // Minimal API bọc lỗi "body quá lớn" của Kestrel trong một BadHttpRequestException 400, nên tìm 413 ở cả lỗi bên trong.
        BadHttpRequestException bad when IsTooLarge(bad) => (413, "payload_too_large", "Tệp quá lớn", "Tệp lớn hơn giới hạn cho phép của hệ thống. Nén PDF hoặc chia thành nhiều tệp nhỏ hơn."),
        BadHttpRequestException bad => (bad.StatusCode, ErrorCodes.ValidationFailed, "Yêu cầu không hợp lệ", "Dữ liệu gửi lên không đúng định dạng."),
        OperationCanceledException => (499, "client_closed", "Đã hủy", "Yêu cầu đã bị hủy."),
        _ => (StatusCodes.Status500InternalServerError, ErrorCodes.Internal, "Hệ thống gặp lỗi",
            "Hệ thống đã ghi lại lỗi. Thử lại sau ít phút; nếu vẫn lỗi, gửi Mã lỗi cho quản trị."),
    };

    /// <summary>
    /// BE-09. Hàm SQL ném lỗi nghiệp vụ bằng SQLSTATE riêng (migration 008/019), không so chuỗi thông điệp.
    /// HS001 ngoài phạm vi · HS002 bước không cho phép · HS003 thiếu ghi chú · HS004 chưa đủ/chưa đối chiếu · HS005 xung đột phiên bản · HS006 không thấy.
    /// </summary>
    private static (int, string, string, string) MapDatabaseError(PostgresException pg) => pg.SqlState switch
    {
        "HS001" => (403, ErrorCodes.OutOfScope, "Ngoài phạm vi", "Hồ sơ này không thuộc phạm vi phân công đang dùng."),
        "HS002" => (409, ErrorCodes.WorkflowConflict, "Không đúng bước", "Thao tác này không còn phù hợp với bước hiện tại của hồ sơ. Tải lại trang."),
        "HS003" => (422, ErrorCodes.NoteRequired, "Cần ghi ý kiến", "Thao tác này cần ý kiến từ 10 ký tự trở lên."),
        "HS004" => (422, ErrorCodes.DossierIncomplete, "Hồ sơ chưa đủ", "Hồ sơ còn thành phần thiếu hoặc chưa đối chiếu. Xem danh sách kiểm tra ở tab Tổng quan."),
        "HS005" => (409, ErrorCodes.ConcurrencyConflict, "Dữ liệu vừa được người khác sửa", "Hồ sơ vừa được cập nhật bởi người khác. Tải lại trang để xem bản mới rồi thử lại."),
        "HS006" => (404, ErrorCodes.NotFound, "Không tìm thấy", "Không tìm thấy bản ghi hoặc bản ghi không thuộc phạm vi của bạn."),
        PostgresErrorCodes.UniqueViolation when pg.ConstraintName == "loans_one_active_per_dossier" =>
            (409, "loan_conflict", "Hồ sơ đang được mượn", "Hồ sơ này đã có một khoản mượn khác đang hiệu lực. Chỉ một khoản mượn được duyệt tại một thời điểm."),
        PostgresErrorCodes.UniqueViolation when pg.ConstraintName == "disposal_requests_one_open_per_dossier" =>
            (409, "disposal_conflict", "Đã có đề nghị hủy", "Hồ sơ này đã có một đề nghị hủy đang xử lý."),
        PostgresErrorCodes.UniqueViolation when pg.ConstraintName == "files_scan_sha256_uq" =>
            (409, ErrorCodes.DuplicateFile, "Tệp đã có trong hệ thống", "PDF này đã được tải lên trước đó."),
        PostgresErrorCodes.UniqueViolation => (409, "duplicate_value", "Dữ liệu bị trùng", "Giá trị này đã tồn tại. Kiểm tra lại hoặc dùng bản ghi có sẵn."),
        PostgresErrorCodes.ForeignKeyViolation => (422, ErrorCodes.ValidationFailed, "Tham chiếu không hợp lệ", "Dữ liệu tham chiếu tới mục không tồn tại."),
        PostgresErrorCodes.CheckViolation or PostgresErrorCodes.NotNullViolation or PostgresErrorCodes.RaiseException =>
            (422, ErrorCodes.ValidationFailed, "Không thực hiện được", "Dữ liệu không thỏa quy tắc của hệ thống."),
        _ => (500, ErrorCodes.Internal, "Hệ thống gặp lỗi", "Hệ thống đã ghi lại lỗi. Thử lại sau ít phút; nếu vẫn lỗi, gửi Mã lỗi cho quản trị."),
    };
}

internal static class ErrorHandlingSetup
{
    public static IServiceCollection AddHoSoErrorHandling(this IServiceCollection services)
    {
        services.AddProblemDetails(options =>
        {
            options.CustomizeProblemDetails = context =>
            {
                context.ProblemDetails.Extensions["correlationId"] = context.HttpContext.TraceIdentifier;
                context.ProblemDetails.Instance = null; // không trả đường dẫn nội bộ
            };
        });
        services.AddExceptionHandler<GlobalExceptionHandler>();
        return services;
    }
}
