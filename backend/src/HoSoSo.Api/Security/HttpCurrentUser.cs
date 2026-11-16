using System.Security.Claims;
using HoSoSo.Application.Common;

namespace HoSoSo.Api.Security;

/// <summary>Đọc người dùng và phân công đang dùng từ claim do ActiveAssignmentMiddleware gắn cho request.</summary>
internal sealed class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;
    public string? Subject => Principal?.FindFirstValue(HoSoClaims.Subject);
    public Guid? UserId => Guid.TryParse(Subject, out var id) ? id : null;
    public string? Username => Principal?.FindFirstValue(HoSoClaims.Username);
    public string? DisplayName => Principal?.FindFirstValue(HoSoClaims.DisplayName);
    public string? ActiveAssignmentId => Principal?.FindFirstValue(HoSoClaims.Assignment);
    public string? Role => Principal?.FindFirstValue(HoSoClaims.Role);
    public string? OrganizationCode => Principal?.FindFirstValue(HoSoClaims.Organization);
    public string? DepartmentCode => Principal?.FindFirstValue(HoSoClaims.Department);
    public IReadOnlyCollection<string> Permissions =>
        Principal?.FindAll(HoSoClaims.Permission).Select(c => c.Value).Distinct(StringComparer.Ordinal).ToArray() ?? [];
    public string CorrelationId => accessor.HttpContext?.TraceIdentifier ?? "background";
    public bool Has(string permission) => Principal?.HasClaim(HoSoClaims.Permission, permission) == true;
}

/// <summary>BE-16, BE-94: nhật ký truy cập kèm IP, mã tương quan và phân công đang dùng. <see cref="Record"/> không chặn request; <see cref="RecordDurableAsync"/> ghi ngay hoặc từ chối.</summary>
internal sealed class HttpAccessLog(ICurrentUser user, IHttpContextAccessor accessor, HoSoSo.Infrastructure.Auditing.AccessEventQueue queue, IClock clock,
    Npgsql.NpgsqlDataSource dataSource, ILogger<HttpAccessLog> logger) : IAccessLog
{
    private string? ClientIp => accessor.HttpContext?.Connection.RemoteIpAddress?.ToString();

    public void Record(string action, string objectType, Guid? objectId) =>
        queue.Enqueue(new HoSoSo.Infrastructure.Auditing.AccessEventRecord(
            user.UserId, action, objectType, objectId, ClientIp, user.CorrelationId, clock.UtcNow, user.ActiveAssignmentId));

    public async Task RecordDurableAsync(string action, string objectType, Guid? objectId, CancellationToken cancellationToken)
    {
        try
        {
            await using var command = dataSource.CreateCommand(
                "INSERT INTO hoso.access_events(user_id, user_role_id, assignment, action, object_type, object_id, client_ip, correlation_id, happened_at) " +
                "VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8, $9)");
            command.Parameters.AddWithValue(user.UserId is { } id ? id : DBNull.Value);
            command.Parameters.AddWithValue(Guid.TryParse(user.ActiveAssignmentId, out var role) ? role : DBNull.Value);
            command.Parameters.AddWithValue((object?)user.ActiveAssignmentId ?? DBNull.Value);
            command.Parameters.AddWithValue(action);
            command.Parameters.AddWithValue(objectType);
            command.Parameters.AddWithValue(objectId is { } oid ? oid : DBNull.Value);
            command.Parameters.AddWithValue((object?)ClientIp ?? DBNull.Value);
            command.Parameters.AddWithValue(user.CorrelationId);
            command.Parameters.AddWithValue(clock.UtcNow.UtcDateTime);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // Không trả nội dung mà không có dấu vết ai đã lấy.
            logger.LogError(exception, "access_log_durable_failed {Action} {ObjectType}", action, objectType);
            throw new AppException(503, "audit_unavailable", "Hệ thống chưa ghi được nhật ký truy cập nên chưa trả nội dung. Thử lại sau ít phút; nếu vẫn lỗi, báo quản trị.");
        }
    }
}
