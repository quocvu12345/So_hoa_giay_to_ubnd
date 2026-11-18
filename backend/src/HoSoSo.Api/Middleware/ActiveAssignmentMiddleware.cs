using System.Security.Claims;
using HoSoSo.Api.Security;
using HoSoSo.Application.Common;
using Microsoft.Extensions.Options;

namespace HoSoSo.Api.Middleware;

/// <summary>
/// BE-13, BE-118. Sau khi xác thực, chọn phân công đang dùng cho request này:
///   - header X-Assignment-Id (Next đặt từ cookie hoso_assignment; trình duyệt đặt qua fetch): LỰA CHỌN TƯỜNG MINH, phải là phân công còn hiệu lực
///     của chính người dùng, hoặc ủy quyền còn hiệu lực; sai thì 403;
///   - không có header, request ĐỌC (chỉ GET; mọi endpoint của API là GET hoặc ghi, không có HEAD): dùng cookie hoso_assignment. Đây là cách duy nhất cho &lt;img&gt;, EventSource và liên kết tải tệp
///     (không đặt được header). Cookie chỉ là gợi ý ngầm: giá trị sai hoặc cũ (hết hạn, thu hồi, của người đăng nhập trước trên cùng máy,
///     của người khác) bị BỎ QUA và dùng phân công mặc định, không 403, vì không có lựa chọn nào của người dùng đang bị từ chối. Không bao giờ
///     chọn được phân công không thuộc người dùng: cùng một phép kiểm với header, nên giá trị cookie bị giả cũng không nâng được quyền;
///   - request GHI không bao giờ lấy phân công từ cookie (giữ nguyên: hành động thay đổi dữ liệu phải nêu rõ dùng phân công nào);
///   - không có gì: phân công mặc định (đầu danh sách).
/// Gắn vai trò, đơn vị và quyền của phân công đó vào claims.
/// </summary>
public sealed class ActiveAssignmentMiddleware(RequestDelegate next, IOptions<AuthOptions> authOptions, ILogger<ActiveAssignmentMiddleware> logger)
{
    public const string HeaderName = "X-Assignment-Id";

    /// <summary>Cookie httpOnly do Next đặt khi người dùng đổi phân công (frontend/src/lib/env.ts ASSIGNMENT_COOKIE).</summary>
    public const string CookieName = "hoso_assignment";

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
        var fromCookie = false;
        if (string.IsNullOrWhiteSpace(requested) && IsReadOnly(context.Request.Method)
            && context.Request.Cookies.TryGetValue(CookieName, out var cookie) && !string.IsNullOrWhiteSpace(cookie))
        {
            requested = cookie;
            fromCookie = true;
        }
        var active = string.IsNullOrWhiteSpace(requested)
            ? assignments.FirstOrDefault()
            : assignments.FirstOrDefault(a => string.Equals(a.Id, requested, StringComparison.OrdinalIgnoreCase));

        if (fromCookie && active is null)
        {
            logger.LogDebug("assignment_cookie_ignored");      // không ghi giá trị cookie: có thể là mã phân công của người khác
            active = assignments.FirstOrDefault();
        }
        else if (!string.IsNullOrWhiteSpace(requested) && active is null)
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

    private static bool IsReadOnly(string method) => HttpMethods.IsGet(method);

    /// <summary>Các đường dẫn dùng được khi phiên chưa qua MFA: báo trạng thái (/me), đăng nhập/đăng xuất, kiểm tra sống.</summary>
    private static bool IsStepUpAllowedPath(PathString path) =>
        path.StartsWithSegments("/api/v1/me") || path.StartsWithSegments("/api/v1/auth");
}
