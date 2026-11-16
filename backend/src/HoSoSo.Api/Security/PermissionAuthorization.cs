using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace HoSoSo.Api.Security;

/// <summary>Cần ít nhất một trong các quyền.</summary>
public sealed record PermissionRequirement(IReadOnlyList<string> AnyOf) : IAuthorizationRequirement;

/// <summary>Policy động dạng "perm:dossier.read|dossier.prepare", không phải khai báo trước từng policy.</summary>
public sealed class PermissionPolicyProvider(IOptions<AuthorizationOptions> options) : DefaultAuthorizationPolicyProvider(options)
{
    public const string Prefix = "perm:";

    public override async Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (!policyName.StartsWith(Prefix, StringComparison.Ordinal))
        {
            return await base.GetPolicyAsync(policyName);
        }
        var permissions = policyName[Prefix.Length..].Split('|', StringSplitOptions.RemoveEmptyEntries);
        return new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .AddRequirements(new PermissionRequirement(permissions))
            .Build();
    }
}

public sealed class PermissionHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        if (requirement.AnyOf.Any(p => context.User.HasClaim(HoSoClaims.Permission, p)))
        {
            context.Succeed(requirement);
        }
        return Task.CompletedTask;
    }
}

public static class PermissionEndpointExtensions
{
    /// <summary>Kiểm tra quyền theo vai trò. Phạm vi từng bản ghi vẫn phải kiểm tra trong use case (IScopeFilter, BE-15).</summary>
    public static TBuilder RequirePermission<TBuilder>(this TBuilder builder, params string[] anyOf)
        where TBuilder : IEndpointConventionBuilder =>
        builder.RequireAuthorization(PermissionPolicyProvider.Prefix + string.Join('|', anyOf));
}
