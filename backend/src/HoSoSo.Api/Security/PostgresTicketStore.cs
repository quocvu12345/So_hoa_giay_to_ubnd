using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
using HoSoSo.Application.Common;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using NpgsqlTypes;

namespace HoSoSo.Api.Security;

/// <summary>
/// BE-12. Lưu vé xác thực trong bảng <c>auth_sessions</c> thay vì nhét vào cookie. Cookie chỉ mang khóa phiên ngẫu nhiên (256 bit),
/// nên (1) cookie nhỏ, không lộ claim hay id_token cho trình duyệt; (2) thu hồi được ngay: đăng xuất, khóa tài khoản, hoặc quản trị
/// buộc đăng xuất đặt <c>revoked_at</c> và request kế tiếp mang cookie cũ nhận 401, thay vì còn hiệu lực tới hết hạn cookie.
/// Mỗi request đọc một dòng theo khóa chính; gia hạn trượt chỉ ghi khi middleware cookie yêu cầu (quá nửa thời hạn).
/// </summary>
internal sealed class PostgresTicketStore(NpgsqlDataSource dataSource, IClock clock) : ITicketStore
{
    private static readonly TimeSpan FallbackLifetime = TimeSpan.FromHours(8);

    public async Task<string> StoreAsync(AuthenticationTicket ticket)
    {
        var userId = UserIdOf(ticket);
        var key = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));
        await using var command = dataSource.CreateCommand("INSERT INTO hoso.auth_sessions(id, user_id, ticket, expires_at) VALUES ($1, $2, $3, $4)");
        command.Parameters.AddWithValue(key);
        command.Parameters.AddWithValue(userId);
        command.Parameters.Add(new NpgsqlParameter { Value = TicketSerializer.Default.Serialize(ticket), NpgsqlDbType = NpgsqlDbType.Bytea });
        command.Parameters.AddWithValue(ExpiresOf(ticket).UtcDateTime);
        await command.ExecuteNonQueryAsync();
        return key;
    }

    public async Task RenewAsync(string key, AuthenticationTicket ticket)
    {
        await using var command = dataSource.CreateCommand(
            "UPDATE hoso.auth_sessions SET ticket = $2, expires_at = $3, renewed_at = now() WHERE id = $1 AND revoked_at IS NULL");
        command.Parameters.AddWithValue(key);
        command.Parameters.Add(new NpgsqlParameter { Value = TicketSerializer.Default.Serialize(ticket), NpgsqlDbType = NpgsqlDbType.Bytea });
        command.Parameters.AddWithValue(ExpiresOf(ticket).UtcDateTime);
        await command.ExecuteNonQueryAsync();
    }

    public async Task<AuthenticationTicket?> RetrieveAsync(string key)
    {
        await using var command = dataSource.CreateCommand(
            "SELECT s.ticket FROM hoso.auth_sessions s JOIN hoso.users u ON u.id = s.user_id " +
            "WHERE s.id = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.active");
        command.Parameters.AddWithValue(key);
        return await command.ExecuteScalarAsync() is byte[] bytes ? TicketSerializer.Default.Deserialize(bytes) : null;
    }

    public async Task RemoveAsync(string key)
    {
        await using var command = dataSource.CreateCommand(
            "UPDATE hoso.auth_sessions SET revoked_at = now(), revoked_reason = 'logout' WHERE id = $1 AND revoked_at IS NULL");
        command.Parameters.AddWithValue(key);
        await command.ExecuteNonQueryAsync();
    }

    private static Guid UserIdOf(AuthenticationTicket ticket) =>
        Guid.TryParse(ticket.Principal.FindFirstValue(HoSoClaims.Subject), out var id)
            ? id
            : throw new InvalidOperationException("Vé đăng nhập không có mã người dùng (claim sub); không lưu được phiên.");

    private DateTimeOffset ExpiresOf(AuthenticationTicket ticket) => ticket.Properties.ExpiresUtc ?? clock.UtcNow.Add(FallbackLifetime);
}
