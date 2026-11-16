using HoSoSo.Domain.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>
/// BE-14. Thêm endpoint mà quên RequirePermission thì test đỏ. Với mỗi endpoint cần quyền: có ít nhất một vai trò được phép
/// và ít nhất một vai trò bị chặn (nếu không, quyền đó hoặc vô nghĩa hoặc ai cũng làm được).
/// </summary>
public sealed class PermissionCoverageTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    /// <summary>Chỉ cần đăng nhập; phạm vi do use case kiểm tra (IScopeFilter) hoặc dữ liệu là của chính người dùng.</summary>
    private static readonly string[] AuthenticatedOnly =
    [
        "/api/v1/auth/", "/api/v1/me", "/api/v1/events", "/api/v1/workspace/", "/api/v1/notifications",
        "/api/v1/catalog/", "/api/v1/procedures", "/api/v1/form-templates/", "/api/v1/jobs/",
    ];

    [Fact]
    public void Moi_endpoint_API_deu_co_quyen_hoac_nam_trong_danh_sach_chi_can_dang_nhap()
    {
        var endpoints = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .Where(e => e.RoutePattern.RawText?.StartsWith("/api/v1", StringComparison.Ordinal) == true).ToList();
        endpoints.Count.ShouldBeGreaterThan(60, "quét được hết các endpoint");

        var problems = new List<string>();
        foreach (var endpoint in endpoints)
        {
            var route = endpoint.RoutePattern.RawText!;
            var verbs = string.Join("/", endpoint.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? ["?"]);
            var label = $"{verbs} {route}";
            var policies = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>().Select(a => a.Policy).Where(p => p is not null).ToList();
            var permissionPolicy = policies.FirstOrDefault(p => p!.StartsWith("perm:", StringComparison.Ordinal));
            var anonymous = endpoint.Metadata.GetMetadata<IAllowAnonymous>() is not null;

            if (permissionPolicy is null)
            {
                var allowed = AuthenticatedOnly.Any(prefix => route.StartsWith(prefix, StringComparison.Ordinal) || route == prefix.TrimEnd('/'));
                if (!allowed && !anonymous) problems.Add($"{label}: thiếu RequirePermission và không nằm trong danh sách chỉ-cần-đăng-nhập");
                // Ẩn danh chỉ hợp lệ ở /auth, hoặc ở endpoint cố ý dùng khóa máy (MachineTokenMetadata, do BackupTokenFilter kiểm).
                var machineToken = endpoint.Metadata.GetMetadata<HoSoSo.Api.Endpoints.MachineTokenMetadata>() is not null;
                if (anonymous && !route.StartsWith("/api/v1/auth/", StringComparison.Ordinal) && !machineToken) problems.Add($"{label}: cho phép ẩn danh ngoài /auth");
                if (machineToken && !route.StartsWith("/api/v1/ops/", StringComparison.Ordinal)) problems.Add($"{label}: khóa máy chỉ được dùng dưới /api/v1/ops");
                continue;
            }

            var required = permissionPolicy["perm:".Length..].Split('|');
            var rolesAllowed = RoleCode.All.Where(r => required.Any(DefaultRolePermissions.For(r).Contains)).ToList();
            var rolesBlocked = RoleCode.All.Except(rolesAllowed).ToList();
            if (rolesAllowed.Count == 0) problems.Add($"{label}: không vai trò nào có quyền [{string.Join(", ", required)}]");
            if (rolesBlocked.Count == 0) problems.Add($"{label}: mọi vai trò đều có quyền [{string.Join(", ", required)}], nên kiểm tra quyền vô nghĩa");
        }
        problems.ShouldBeEmpty(string.Join(Environment.NewLine, problems));
    }
}
