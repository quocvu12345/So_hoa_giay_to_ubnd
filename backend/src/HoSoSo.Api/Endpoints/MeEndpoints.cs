using HoSoSo.Application.Common;
using HoSoSo.Domain.Identity;

namespace HoSoSo.Api.Endpoints;

public sealed record SessionUserDto(string Id, string Username, string DisplayName);

public sealed record AssignmentDto(
    string Id, string Role, string RoleName,
    string? OrganizationCode, string? OrganizationName,
    string? DepartmentCode, string? DepartmentName,
    DateTimeOffset? DelegatedUntil);

/// <summary>Khớp kiểu Session trong frontend/src/lib/auth/types.ts.</summary>
public sealed record MeResponse(
    SessionUserDto User,
    IReadOnlyList<AssignmentDto> Assignments,
    AssignmentDto ActiveAssignment,
    IReadOnlyCollection<string> Permissions,
    bool IsMock,
    bool MfaRequired = false);

internal static class MeEndpoints
{
    private static readonly Dictionary<string, string> RoleNames = new(StringComparer.Ordinal)
    {
        [RoleCode.Employee] = "Chuyên viên",
        [RoleCode.Clerk] = "Văn thư / lưu trữ",
        [RoleCode.Manager] = "Trưởng phòng / Trưởng Ban",
        [RoleCode.Chair] = "Chủ tịch UBND",
        [RoleCode.Council] = "Lãnh đạo HĐND",
        [RoleCode.TechnicalAdmin] = "Quản trị kỹ thuật",
    };

    public static RouteGroupBuilder MapMeEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/me", async (HttpContext http, ICurrentUser user, IIdentityService identity, CancellationToken cancellationToken) =>
        {
            var assignments = (await identity.ListAssignmentsAsync(user.RequireUserId(), cancellationToken))
                .Select(a => new AssignmentDto(a.Id, a.Role, RoleNames.GetValueOrDefault(a.Role, a.Role),
                    a.OrganizationCode, a.OrganizationName, a.DepartmentCode, a.DepartmentName, a.DelegatedUntil))
                .ToList();
            var active = assignments.FirstOrDefault(a => a.Id == user.ActiveAssignmentId);
            if (active is null)
            {
                throw new AppException(403, "no_assignment", "Tài khoản chưa có phân công đang hiệu lực. Liên hệ quản trị để được phân công.");
            }
            return TypedResults.Ok(new MeResponse(
                new SessionUserDto(user.Subject ?? "", user.Username ?? "", user.DisplayName ?? user.Username ?? ""),
                assignments, active, user.Permissions, IsMock: false, MfaRequired: http.User.HasClaim(HoSoClaims.MfaRequired, "1")));
        })
        .WithTags("Tài khoản")
        .WithSummary("Người dùng hiện tại, các phân công còn hiệu lực và quyền của phân công đang dùng");
        return api;
    }
}
