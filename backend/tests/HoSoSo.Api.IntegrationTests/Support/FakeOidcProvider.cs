using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace HoSoSo.Api.IntegrationTests.Support;

/// <summary>
/// Nhà cung cấp OIDC giả chạy thật trên cổng cục bộ, theo đúng giao thức Authorization Code + PKCE (discovery, JWKS, authorize, token, end_session).
/// Dùng để chạy luồng đăng nhập thật của API khi không có Keycloak. Nó KHÔNG thay Keycloak: chỉ chứng minh API xử lý đúng giao thức và đúng cấu hình của nó.
/// </summary>
public sealed class FakeOidcProvider : IAsyncDisposable
{
    public const string ClientId = "hoso-web";
    public const string ClientSecret = "bi-mat-thu-nghiem-0123456789";

    /// <summary>Cách IdP "làm hỏng" id_token để kiểm tra API từ chối.</summary>
    public enum Tamper { None, WrongNonce, WrongAudience, WrongIssuer, Expired, SignedWithOtherKey, NoSubject }

    private sealed record Grant(string Subject, string Nonce, string Challenge, string RedirectUri, string ClientId);

    private readonly WebApplication _app;
    private readonly RSA _key = RSA.Create(2048);
    private readonly RSA _otherKey = RSA.Create(2048);
    private readonly ConcurrentDictionary<string, Grant> _codes = new();

    /// <summary>Người dùng (claim sub) mà lần đăng nhập kế tiếp sẽ trả về.</summary>
    public string NextSubject { get; set; } = "idp-sub-mac-dinh";
    /// <summary>Phương thức xác thực (claim amr) và mức (claim acr) của lần đăng nhập kế tiếp; null = không có claim.</summary>
    public string[]? NextAmr { get; set; }
    public string? NextAcr { get; set; }
    /// <summary>id_token vừa phát gần nhất, để đối chiếu với id_token_hint API gửi lại khi đăng xuất.</summary>
    public string? LastIdToken { get; private set; }
    public Tamper NextTamper { get; set; }

    /// <summary>Các lần gọi token endpoint bị từ chối vì PKCE hoặc bí mật client sai.</summary>
    public ConcurrentQueue<string> Rejections { get; } = new();
    /// <summary>Mọi yêu cầu authorize nhận được (để kiểm tra API gửi PKCE S256, state, nonce, scope).</summary>
    public ConcurrentQueue<IReadOnlyDictionary<string, string>> AuthorizeRequests { get; } = new();
    public ConcurrentQueue<IReadOnlyDictionary<string, string>> LogoutRequests { get; } = new();

    public string BaseUrl { get; private set; } = "";

    public FakeOidcProvider()
    {
        var builder = WebApplication.CreateSlimBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");   // cổng ngẫu nhiên do hệ điều hành cấp
        builder.Logging.ClearProviders();
        _app = builder.Build();
        MapEndpoints();
    }

    public async Task StartAsync()
    {
        await _app.StartAsync();
        BaseUrl = _app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single().TrimEnd('/');
    }

    private static string Base64Url(byte[] bytes) => Base64UrlEncoder.Encode(bytes);

    private string Jwks()
    {
        var p = _key.ExportParameters(false);
        return JsonSerializer.Serialize(new { keys = new[] { new { kty = "RSA", use = "sig", alg = "RS256", kid = "khoa-thu-1", n = Base64Url(p.Modulus!), e = Base64Url(p.Exponent!) } } });
    }

    private string IdToken(Grant grant)
    {
        var now = DateTime.UtcNow;
        var claims = new Dictionary<string, object>
        {
            ["iss"] = NextTamper == Tamper.WrongIssuer ? "https://ke-gia-mao.example" : BaseUrl,
            ["aud"] = NextTamper == Tamper.WrongAudience ? "ung-dung-khac" : grant.ClientId,
            ["nonce"] = NextTamper == Tamper.WrongNonce ? "nonce-khac" : grant.Nonce,
            ["preferred_username"] = "nguoi.dung",
            ["name"] = "Người dùng thử",
        };
        if (NextTamper != Tamper.NoSubject) claims["sub"] = grant.Subject;
        if (NextAmr is not null) claims["amr"] = NextAmr;
        if (NextAcr is not null) claims["acr"] = NextAcr;
        var descriptor = new SecurityTokenDescriptor
        {
            Claims = claims,
            IssuedAt = now,
            NotBefore = NextTamper == Tamper.Expired ? now.AddHours(-3) : now,
            Expires = NextTamper == Tamper.Expired ? now.AddHours(-2) : now.AddMinutes(5),
            SigningCredentials = new SigningCredentials(
                new RsaSecurityKey(NextTamper == Tamper.SignedWithOtherKey ? _otherKey : _key) { KeyId = "khoa-thu-1" }, SecurityAlgorithms.RsaSha256),
        };
        return LastIdToken = new JsonWebTokenHandler().CreateToken(descriptor);
    }

    private void MapEndpoints()
    {
        _app.MapGet("/.well-known/openid-configuration", () => Results.Json(new
        {
            issuer = BaseUrl,
            authorization_endpoint = BaseUrl + "/authorize",
            token_endpoint = BaseUrl + "/token",
            jwks_uri = BaseUrl + "/jwks",
            end_session_endpoint = BaseUrl + "/logout",
            response_types_supported = new[] { "code" },
            subject_types_supported = new[] { "public" },
            id_token_signing_alg_values_supported = new[] { "RS256" },
            code_challenge_methods_supported = new[] { "S256" },
            token_endpoint_auth_methods_supported = new[] { "client_secret_post", "client_secret_basic" },
        }));
        _app.MapGet("/jwks", () => Results.Content(Jwks(), "application/json"));

        _app.MapGet("/authorize", (HttpRequest request) =>
        {
            var q = request.Query.ToDictionary(x => x.Key, x => x.Value.ToString());
            AuthorizeRequests.Enqueue(q);
            if (q.GetValueOrDefault("response_type") != "code" || q.GetValueOrDefault("client_id") != ClientId) return Results.BadRequest("yêu cầu authorize không hợp lệ");
            var code = Base64Url(RandomNumberGenerator.GetBytes(24));
            _codes[code] = new Grant(NextSubject, q.GetValueOrDefault("nonce") ?? "", q.GetValueOrDefault("code_challenge") ?? "", q.GetValueOrDefault("redirect_uri") ?? "", ClientId);
            var redirect = q["redirect_uri"] + (q["redirect_uri"].Contains('?') ? "&" : "?") + $"code={code}&state={Uri.EscapeDataString(q.GetValueOrDefault("state") ?? "")}";
            return Results.Redirect(redirect);
        });

        _app.MapPost("/token", async (HttpRequest request) =>
        {
            var form = await request.ReadFormAsync();
            string Reject(string reason) { Rejections.Enqueue(reason); return reason; }

            var (clientId, secret) = (form["client_id"].ToString(), form["client_secret"].ToString());
            if (request.Headers.Authorization.ToString() is { Length: > 6 } basic && basic.StartsWith("Basic ", StringComparison.Ordinal))
            {
                var pair = Encoding.UTF8.GetString(Convert.FromBase64String(basic[6..])).Split(':', 2);
                (clientId, secret) = (Uri.UnescapeDataString(pair[0]), pair.Length > 1 ? Uri.UnescapeDataString(pair[1]) : "");
            }
            if (clientId != ClientId || secret != ClientSecret) return Results.Json(new { error = "invalid_client", error_description = Reject("sai bí mật client") }, statusCode: 401);
            if (form["grant_type"] != "authorization_code" || !_codes.TryRemove(form["code"].ToString(), out var grant))
                return Results.Json(new { error = "invalid_grant", error_description = Reject("mã đổi token không có hoặc đã dùng") }, statusCode: 400);
            if (form["redirect_uri"].ToString() != grant.RedirectUri)
                return Results.Json(new { error = "invalid_grant", error_description = Reject("redirect_uri không khớp") }, statusCode: 400);
            var verifier = form["code_verifier"].ToString();
            if (verifier.Length == 0 || Base64Url(SHA256.HashData(Encoding.ASCII.GetBytes(verifier))) != grant.Challenge)
                return Results.Json(new { error = "invalid_grant", error_description = Reject("PKCE: code_verifier không khớp code_challenge") }, statusCode: 400);

            return Results.Json(new { access_token = "khong-dung-toi", token_type = "Bearer", expires_in = 300, id_token = IdToken(grant) });
        });

        _app.MapGet("/logout", (HttpRequest request) =>
        {
            var q = request.Query.ToDictionary(x => x.Key, x => x.Value.ToString());
            LogoutRequests.Enqueue(q);
            // Như Keycloak: quay về post_logout_redirect_uri và trả lại nguyên state nhận được.
            if (!q.TryGetValue("post_logout_redirect_uri", out var back) || back.Length == 0) return Results.Ok("đã đăng xuất");
            return Results.Redirect(q.TryGetValue("state", out var state) ? $"{back}{(back.Contains('?') ? "&" : "?")}state={Uri.EscapeDataString(state)}" : back);
        });
    }

    public async ValueTask DisposeAsync()
    {
        await _app.StopAsync();
        await _app.DisposeAsync();
        _key.Dispose();
        _otherKey.Dispose();
    }
}
