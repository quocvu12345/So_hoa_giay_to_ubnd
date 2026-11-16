using System.Security.Cryptography;
using System.Text;
using HoSoSo.Api.Security;
using HoSoSo.Application.Admin;

namespace HoSoSo.Api.Endpoints;

/// <summary>Đánh dấu endpoint cố ý không dùng phiên đăng nhập mà dùng khóa máy (kiểm tra bởi PermissionCoverageTests).</summary>
internal sealed class MachineTokenMetadata;

/// <summary>
/// BE-89. Cho script vận hành (sao lưu) báo kết quả mà không cần đăng nhập bằng trình duyệt.
/// Xác thực bằng header <c>X-Backup-Token</c> so với <c>Backup:IngestToken</c> (đặt bằng biến môi trường <c>Backup__IngestToken</c>, từ 32 ký tự).
/// Chưa cấu hình khóa thì các endpoint này trả 404 như không tồn tại. Cookie phiên không có tác dụng ở đây, nên không cần CSRF và không bị CSRF lợi dụng.
/// </summary>
internal static class OpsEndpoints
{
    public static RouteGroupBuilder MapOpsEndpoints(this RouteGroupBuilder api)
    {
        var ops = api.MapGroup("/ops").WithTags("Script vận hành (khóa máy)")
            .AllowAnonymous().WithMetadata(new MachineTokenMetadata())
            .AddEndpointFilter<BackupTokenFilter>()
            .RequireRateLimiting(SecuritySetup.OpsPolicy);

        ops.MapPost("/backups", async (RecordBackupRequest body, AdminOpsHandler h, CancellationToken ct) => TypedResults.Ok(await h.RecordBackupAsync(body, ct)))
            .WithSummary("Script ghi một lần sao lưu (đang chạy, thành công hoặc lỗi)");
        ops.MapPatch("/backups/{id:guid}", async (Guid id, FinishBackupRequest body, AdminOpsHandler h, CancellationToken ct) => TypedResults.Ok(await h.FinishBackupAsync(id, body, ct)))
            .WithSummary("Script báo kết thúc lần sao lưu đang chạy, hoặc bổ sung dung lượng, nơi lưu, diễn tập khôi phục");
        return api;
    }
}

internal sealed class BackupTokenFilter(IConfiguration configuration, ILogger<BackupTokenFilter> logger) : IEndpointFilter
{
    public const string HeaderName = "X-Backup-Token";
    private const int MinimumLength = 32;

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var expected = configuration["Backup:IngestToken"];
        if (string.IsNullOrEmpty(expected) || expected.Length < MinimumLength) return TypedResults.NotFound();   // chưa bật

        var given = context.HttpContext.Request.Headers[HeaderName].ToString();
        // So sánh băm để thời gian không phụ thuộc vào độ dài hay số ký tự đúng.
        var ok = CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(given)), SHA256.HashData(Encoding.UTF8.GetBytes(expected)));
        if (!ok)
        {
            logger.LogWarning("backup_token_rejected {RemoteIp}", context.HttpContext.Connection.RemoteIpAddress?.ToString());
            return TypedResults.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Khóa máy không đúng",
                detail: "Header X-Backup-Token thiếu hoặc sai.", type: "https://hoso.local/errors/unauthenticated");
        }
        return await next(context);
    }
}
