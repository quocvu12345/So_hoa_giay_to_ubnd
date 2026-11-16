using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>
/// Chạy API trong bộ nhớ với Auth:Mode=Dev. Các test ở đây không cần PostgreSQL;
/// test cần DB dùng Testcontainers (BE-17).
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("ConnectionStrings:HoSo", "Host=127.0.0.1;Port=1;Database=none;Username=none;Password=none");
        builder.UseSetting("Auth:Mode", "Dev");
        builder.UseSetting("Background:Enabled", "false");
        builder.UseSetting("Auth:CookieName", "hoso_session_test");
        builder.UseSetting("Auth:SecureCookie", "false");
        builder.UseSetting("Auth:PublicOrigin", "http://localhost");
        builder.UseSetting("Storage:Root", Path.Combine(Path.GetTempPath(), "hoso-test-blobs"));
    }
}
