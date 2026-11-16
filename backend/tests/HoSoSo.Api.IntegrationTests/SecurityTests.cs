using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>Các kiểm tra không cần CSDL: chạy trên ApiFactory.</summary>
public sealed class SecurityTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private HttpClient Client() => factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    [Fact]
    public async Task Health_live_khong_can_dang_nhap()
    {
        var response = await Client().GetAsync("/health/live", TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Chua_dang_nhap_thi_401_va_co_ma_tuong_quan()
    {
        var response = await Client().GetAsync("/api/v1/me", TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        response.Headers.Contains("X-Correlation-Id").ShouldBeTrue();
    }

    [Fact]
    public async Task Ghi_du_lieu_khong_co_X_CSRF_thi_403()
    {
        var response = await Client().PostAsync("/api/v1/dossiers", JsonContent.Create(new { }), TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Health_ready_503_khi_khong_noi_duoc_CSDL()
    {
        var response = await Client().GetAsync("/health/ready", TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable);
    }
}
