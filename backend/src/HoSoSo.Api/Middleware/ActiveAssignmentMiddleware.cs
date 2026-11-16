using System.Security.Claims;
using HoSoSo.Api.Security;
using HoSoSo.Application.Common;
using Microsoft.Extensions.Options;

namespace HoSoSo.Api.Middleware;

/// <summary>
/// BE-13. Sau khi xác thực, chọn phân công đang dùng cho request này:
///   - header X-Assignment-Id (Next đặt từ cookie hoso_assignment): phải là phân công còn hiệu lực của chính người dùng, hoặc ủy quyền còn hiệu lực;
///   - không có header: dùng phân công mặc định (đầu danh sách).
/// Gắn vai trò, đơn vị và quyền của phân công đó vào claims. Id của người khác hoặc đã hết hạn trả 403.
/// </summary>
public sealed class ActiveAssignmentMiddleware(RequestDelegate next, IOptions<AuthOptions> authOptions)
{
    public const string HeaderName = "X-Assignment-Id";

    public async Task InvokeAsync(HttpContext context, IIdentityService identity)
    {
        if (context.User.Identity?.IsAuthenticated != true || !context.Request.Path.StartsWithSegments("/api"))
        {
            await next(context);
            return;
        }

        if (!Guid.TryParse(context.User.FindFirstValue(HoSoClaims.Subject), out var userId))
        {
            // Cookie cũ không còn đúng định dạng: coi như chưa đăng nhập.
            await Results.Problem(statusCode: 401, title: "Phiên đăng nhập hết hạn", detail: "Đăng nhập lại để tiếp tục.",
                type: $"https://hoso.local/errors/{ErrorCodes.Unauthenticated}").ExecuteAsync(context);
            return;
        }

        var assignments = await identity.ListAssignmentsAsync(userId, context.RequestAborted);
        var requested = context.Request.Headers[HeaderName].FirstOrDefault();
        var active = string.IsNullOrWhiteSpace(requested)
            ? assignments.FirstOrDefault()
            : assignments.FirstOrDefault(a => string.Equals(a.Id, requested, StringComparison.OrdinalIgnoreCase));

        if (!string.IsNullOrWhiteSpace(requested) && active is null)
        {
            await Results.Problem(statusCode: 403, title: "Phân công không dùng được",
                detail: "Phân công này không còn hiệu lực hoặc không phải của bạn. Chọn lại phân công ở góc trên bên phải.",
                type: "https://hoso.local/errors/assignment_not_allowed").ExecuteAsync(context);
            return;
        }

        // BE-95. Phân công đặc quyền (quản trị, lãnh đạo, văn thư) chỉ dùng được khi phiên đã qua xác thực nhiều lớp. Phiên chưa qua MFA vẫn xem được /me
        // (để giao diện biết phải đăng nhập lại có MFA) và đăng xuất/đăng nhập; mọi thứ khác bị từ chối, và quyền của phân công đó KHÔNG được gắn vào phiên.
        var needsStepUp = active is not null && authOptions.Value.RoleNeedsMfa(active.Role) && !context.User.HasClaim(HoSoClaims.Mfa, "1");
        if (needsStepUp && !IsStepUpAllowedPath(context.Request.Path))
        {
            await Results.Problem(statusCode: 403, title: "Cần xác thực hai lớp",
                detail: $"Phân công \"{active!.Role}\" chỉ dùng được khi đăng nhập có xác thực hai lớp (MFA). Đăng nhập lại có MFA rồi thử lại, hoặc chọn phân công khác.",
                type: "https://hoso.local/errors/mfa_required",
                extensions: new Dictionary<string, object?> { ["stepUp"] = "/api/v1/auth/login?mfa=true" }).ExecuteAsync(context);
            return;
        }

        if (active is not null)
        {
            var claims = new List<Claim>
            {
                new(HoSoClaims.Role, active.Role),
                new(HoSoClaims.Assignment, active.Id),
            };
            if (needsStepUp) claims.Add(new Claim(HoSoClaims.MfaRequired, "1"));
            if (active.OrganizationCode is not null) claims.Add(new Claim(HoSoClaims.Organization, active.OrganizationCode));
            if (active.DepartmentCode is not null) claims.Add(new Claim(HoSoClaims.Department, active.DepartmentCode));
            if (!needsStepUp) claims.AddRange(active.Permissions.Select(p => new Claim(HoSoClaims.Permission, p)));
            context.User.AddIdentity(new ClaimsIdentity(claims));
        }
        await next(context);
    }

    /// <summary>Các đường dẫn dùng được khi phiên chưa qua MFA: báo trạng thái (/me), đăng nhập/đăng xuất, kiểm tra sống.</summary>
    private static bool IsStepUpAllowedPath(PathString path) =>
        path.StartsWithSegments("/api/v1/me") || path.StartsWithSegments("/api/v1/auth");
}
