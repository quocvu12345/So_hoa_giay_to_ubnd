using System.Security.Claims;
using System.Threading.RateLimiting;
using HoSoSo.Application.Common;
using HoSoSo.Domain.Identity;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;

namespace HoSoSo.Api.Security;

/// <summary>
/// API .NET là nơi giữ phiên (docs/05-bao-mat.md): đăng nhập OIDC, cookie httpOnly,
/// token của IdP không bao giờ ra trình duyệt hay Next.js.
/// </summary>
public static class SecuritySetup
{
    public const string UploadPolicy = "upload";
    public const string OpsPolicy = "ops";
    public const string AiExtractPolicy = "ai-extract";

    public static IServiceCollection AddHoSoSecurity(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        var auth = configuration.GetSection("Auth").Get<AuthOptions>() ?? new AuthOptions();
        if (auth.IsDev && !environment.IsDevelopment())
        {
            throw new InvalidOperationException("Auth:Mode=Dev chỉ dùng được khi ASPNETCORE_ENVIRONMENT=Development.");
        }
        services.AddOptions<AuthOptions>().Bind(configuration.GetSection("Auth"))
            .Validate(o => o.IsDev || string.Equals(o.Mode, "Oidc", StringComparison.OrdinalIgnoreCase), "Auth:Mode chỉ nhận Oidc hoặc Dev.")
            .Validate(o => o.IsDev || (!string.IsNullOrWhiteSpace(o.Authority) && !string.IsNullOrWhiteSpace(o.ClientId)),
                "Auth:Mode=Oidc cần Auth:Authority (địa chỉ máy chủ danh tính) và Auth:ClientId. Đặt ClientSecret bằng biến môi trường HoSo__Auth__ClientSecret.")
            .Validate(o => o.SessionHours is >= 1 and <= 72, "Auth:SessionHours phải từ 1 đến 72 giờ.")
            .Validate(o => !string.IsNullOrWhiteSpace(o.CookieName), "Auth:CookieName không được để trống.")
            .Validate(o => !o.CookieName.StartsWith("__Host-", StringComparison.Ordinal) || o.SecureCookie, "Cookie __Host- bắt buộc Auth:SecureCookie=true.")
            .ValidateOnStart();
        services.AddOptions<HoSoSo.Api.Configuration.LimitsOptions>().Bind(configuration.GetSection("Limits")).ValidateDataAnnotations().ValidateOnStart();
        services.AddOptions<HoSoSo.Api.Configuration.ErrorTrackingOptions>().Bind(configuration.GetSection("ErrorTracking"))
            .Validate(o => o.IsValid, "ErrorTracking:Dsn phải là địa chỉ http/https hợp lệ hoặc để trống.").ValidateOnStart();

        var authentication = services
            .AddAuthentication(options =>
            {
                options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
                // Request API chưa đăng nhập phải nhận 401 (cookie không chuyển hướng, xem OnRedirectToLogin bên dưới) để frontend tự chuyển
                // tới trang đăng nhập. Chỉ /auth/login mới thách thức OIDC (Results.Challenge chỉ rõ scheme), nên không đặt OIDC làm mặc định.
                options.DefaultChallengeScheme = CookieAuthenticationDefaults.AuthenticationScheme;
            })
            .AddCookie(options =>
            {
                options.Cookie.Name = auth.CookieName;
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Lax;
                options.Cookie.Path = "/";
                options.Cookie.SecurePolicy = auth.SecureCookie ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
                options.ExpireTimeSpan = TimeSpan.FromHours(auth.SessionHours);
                options.SlidingExpiration = true;
                // API không chuyển hướng; trả mã trạng thái để frontend tự xử lý.
                options.Events.OnRedirectToLogin = context => { context.Response.StatusCode = StatusCodes.Status401Unauthorized; return Task.CompletedTask; };
                options.Events.OnRedirectToAccessDenied = context => { context.Response.StatusCode = StatusCodes.Status403Forbidden; return Task.CompletedTask; };
                // Vé xác thực lưu trong bảng auth_sessions (PostgresTicketStore, gắn ở dưới): cookie chỉ có khóa phiên, thu hồi được ngay.
            });
        services.AddSingleton<ITicketStore, PostgresTicketStore>();
        services.AddOptions<CookieAuthenticationOptions>(CookieAuthenticationDefaults.AuthenticationScheme)
            .Configure<ITicketStore>((options, store) => options.SessionStore = store);
        if (!string.IsNullOrWhiteSpace(auth.DataProtectionKeysPath))
        {
            var protection = services.AddDataProtection().SetApplicationName("hoso").PersistKeysToFileSystem(new DirectoryInfo(auth.DataProtectionKeysPath));
            // BE-96: khóa lưu trên đĩa được mã hóa bằng chứng thư (không nằm trần dạng XML).
            if (!string.IsNullOrWhiteSpace(auth.DataProtectionCertificatePath))
            {
                protection.ProtectKeysWithCertificate(System.Security.Cryptography.X509Certificates.X509CertificateLoader.LoadPkcs12FromFile(
                    auth.DataProtectionCertificatePath, string.IsNullOrEmpty(auth.DataProtectionCertificatePassword) ? null : auth.DataProtectionCertificatePassword));
            }
        }

        if (!auth.IsDev)
        {
            authentication.AddOpenIdConnect(options =>
            {
                options.Authority = auth.Authority;
                options.ClientId = auth.ClientId;
                options.ClientSecret = auth.ClientSecret;
                options.ResponseType = OpenIdConnectResponseType.Code;
                options.UsePkce = true;
                options.CallbackPath = "/api/v1/auth/callback";
                options.SignedOutCallbackPath = "/api/v1/auth/signed-out";
                options.MapInboundClaims = false;
                options.SaveTokens = false;       // không lưu access/refresh token; chỉ giữ id_token (xem OnTokenValidated) để gửi id_token_hint khi đăng xuất
                options.GetClaimsFromUserInfoEndpoint = false;
                options.RequireHttpsMetadata = !environment.IsDevelopment();
                options.Scope.Clear();
                options.Scope.Add("openid");
                options.Scope.Add("profile");
                options.Events.OnTokenValidated = async context =>
                {
                    // Người dùng phải do quản trị tạo sẵn trong CSDL (users.external_auth_subject); đăng nhập được Keycloak không đủ.
                    var identity = context.HttpContext.RequestServices.GetRequiredService<IIdentityService>();
                    var external = context.Principal?.FindFirstValue("sub");
                    var user = external is null ? null : await identity.FindByExternalSubjectAsync(external, context.HttpContext.RequestAborted);
                    if (user is not { Active: true })
                    {
                        context.Fail("Tài khoản chưa được cấp quyền sử dụng hệ thống hoặc đã bị khóa.");
                        return;
                    }
                    var mfa = context.HttpContext.RequestServices.GetRequiredService<IOptions<AuthOptions>>().Value.HasMfa(context.Principal!);
                    var claims = new List<Claim>
                    {
                        new(HoSoClaims.Subject, user.Id.ToString()),
                        new(HoSoClaims.Username, user.Username),
                        new(HoSoClaims.DisplayName, user.DisplayName),
                    };
                    if (mfa) claims.Add(new Claim(HoSoClaims.Mfa, "1"));     // BE-95: phiên đã qua xác thực nhiều lớp theo id_token của nhà cung cấp danh tính
                    context.Principal = new ClaimsPrincipal(new ClaimsIdentity(claims, "oidc", HoSoClaims.Username, HoSoClaims.Role));
                    // id_token nằm trong vé phía máy chủ (không ra trình duyệt); cần để Keycloak nhận ra phiên khi đăng xuất mà không hỏi lại.
                    if (context.TokenEndpointResponse?.IdToken is { Length: > 0 } idToken)
                        context.Properties?.StoreTokens([new AuthenticationToken { Name = "id_token", Value = idToken }]);
                    await identity.RecordLoginAsync(user.Id, context.HttpContext.Connection.RemoteIpAddress?.ToString(),
                        context.HttpContext.TraceIdentifier, context.HttpContext.RequestAborted);
                };
                // BE-95: đăng nhập lại để nâng mức xác thực (/auth/login?mfa=true) gửi acr_values cho nhà cung cấp danh tính.
                options.Events.OnRedirectToIdentityProvider = context =>
                {
                    if (context.Properties.Items.ContainsKey("hoso_step_up") && !string.IsNullOrWhiteSpace(auth.MfaAcrRequest))
                        context.ProtocolMessage.AcrValues = auth.MfaAcrRequest;
                    return Task.CompletedTask;
                };
                options.Events.OnRemoteFailure = context =>
                {
                    context.Response.Redirect("/dang-nhap?loi=khong-co-quyen");
                    context.HandleResponse();
                    return Task.CompletedTask;
                };
            });
        }

        services.AddAuthorization(options =>
        {
            // Mặc định mọi endpoint cần đăng nhập; endpoint công khai phải ghi rõ AllowAnonymous.
            options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();
        });
        services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
        services.AddSingleton<IAuthorizationHandler, PermissionHandler>();
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, HttpCurrentUser>();
        services.AddScoped<IAccessLog, HttpAccessLog>();

        var requestsPerMinute = configuration.GetValue("Limits:RequestsPerMinute", 300);   // đã kiểm giá trị ở LimitsOptions
        var opsPerMinute = Math.Max(1, configuration.GetValue("Limits:OpsRequestsPerMinute", 20));
        var aiExtractPerMinute = Math.Max(1, configuration.GetValue("Limits:AiExtractPerMinute", 20));
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    context.User.FindFirstValue(HoSoClaims.Subject) ?? context.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = requestsPerMinute, Window = TimeSpan.FromMinutes(1) }));
            // Endpoint khóa máy: 20 lần mỗi phút mỗi địa chỉ, để dò khóa không khả thi (script sao lưu chỉ gọi vài lần mỗi ngày).
            options.AddPolicy(OpsPolicy, context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = opsPerMinute, Window = TimeSpan.FromMinutes(1) }));
            // "Trích xuất ngay" (BE-98): mỗi người tối đa 20 lần mỗi phút, đủ cho thao tác tay, chặn vòng lặp bấm liên tục làm ngập hàng đợi.
            options.AddPolicy(AiExtractPolicy, context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    context.User.FindFirstValue(HoSoClaims.Subject) ?? context.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = aiExtractPerMinute, Window = TimeSpan.FromMinutes(1) }));
            // Mỗi người tối đa 3 tệp tải lên cùng lúc, thêm tối đa 10 tệp chờ.
            options.AddPolicy(UploadPolicy, context =>
                RateLimitPartition.GetConcurrencyLimiter(
                    context.User.FindFirstValue(HoSoClaims.Subject) ?? "anonymous",
                    _ => new ConcurrencyLimiterOptions { PermitLimit = 3, QueueLimit = 10 }));
        });

        var forwarded = configuration.GetSection("ForwardedHeaders").Get<HoSoSo.Api.Configuration.ForwardedHeadersSettings>() ?? new();
        services.Configure<ForwardedHeadersOptions>(options =>
        {
            // Chạy sau Caddy/Nginx: lấy đúng scheme https và IP người dùng. Mặc định chỉ tin proxy trên chính máy (loopback);
            // đặt ForwardedHeaders:KnownProxies / KnownNetworks đúng địa chỉ reverse proxy của cơ quan. Không tin proxy lạ.
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            if (forwarded.KnownProxies.Length > 0 || forwarded.KnownNetworks.Length > 0)
            {
                options.KnownProxies.Clear();
                options.KnownIPNetworks.Clear();
                foreach (var proxy in forwarded.KnownProxies) options.KnownProxies.Add(System.Net.IPAddress.Parse(proxy));
                foreach (var network in forwarded.KnownNetworks) options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(network));
            }
        });
        return services;
    }
}
