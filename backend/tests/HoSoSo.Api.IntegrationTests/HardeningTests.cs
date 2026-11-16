using System.Text.Json;
using HoSoSo.Api.Configuration;
using HoSoSo.Application.Common;
using HoSoSo.Infrastructure;
using HoSoSo.Infrastructure.Auditing;
using HoSoSo.Infrastructure.Storage;
using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Npgsql;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-02, BE-11, BE-16, BE-19, BE-21: cấu hình sai thì dừng rõ ràng; giới hạn; OpenAPI; dọn tệp tạm; mất CSDL không làm hỏng request. Không cần CSDL.</summary>
public sealed class HardeningTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private sealed class FakeEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Production";
        public string ApplicationName { get; set; } = "test";
        public string ContentRootPath { get; set; } = Path.GetTempPath();
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = new Microsoft.Extensions.FileProviders.NullFileProvider();
    }

    private static IConfiguration Config(params (string Key, string? Value)[] values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values.Select(v => new KeyValuePair<string, string?>(v.Key, v.Value))).Build();

    private static T Resolve<T>(IConfiguration configuration) where T : class
    {
        var services = new ServiceCollection();
        HoSoSo.Api.Security.SecuritySetup.AddHoSoSecurity(services, configuration, new FakeEnvironment());
        return services.BuildServiceProvider().GetRequiredService<IOptions<T>>().Value;
    }

    [Fact]
    public void Oidc_thieu_Authority_thi_bao_loi_tieng_Viet_chi_ro_khoa()
    {
        var error = Should.Throw<OptionsValidationException>(() => Resolve<HoSoSo.Api.Security.AuthOptions>(Config(("Auth:Mode", "Oidc"), ("Auth:Authority", ""), ("Auth:ClientId", "hoso-web"))));
        error.Message.ShouldContain("Auth:Authority");
        Should.Throw<OptionsValidationException>(() => Resolve<HoSoSo.Api.Security.AuthOptions>(Config(("Auth:Mode", "Oidc"), ("Auth:Authority", "https://sso.local/realms/hoso"), ("Auth:ClientId", ""))));
        Should.Throw<OptionsValidationException>(() => Resolve<HoSoSo.Api.Security.AuthOptions>(Config(("Auth:Mode", "Khac"))));
        Should.Throw<OptionsValidationException>(() => Resolve<HoSoSo.Api.Security.AuthOptions>(Config(("Auth:Mode", "Oidc"), ("Auth:Authority", "https://x"), ("Auth:ClientId", "a"), ("Auth:SecureCookie", "false"))))
            .Message.ShouldContain("__Host-");
        // Cấu hình đúng thì qua.
        Resolve<HoSoSo.Api.Security.AuthOptions>(Config(("Auth:Mode", "Oidc"), ("Auth:Authority", "https://sso.local/realms/hoso"), ("Auth:ClientId", "hoso-web"))).ClientId.ShouldBe("hoso-web");
    }

    [Fact]
    public void Gioi_han_va_DSN_sai_thi_khong_khoi_dong()
    {
        Should.Throw<OptionsValidationException>(() => Resolve<LimitsOptions>(Config(("Auth:Mode", "Oidc"), ("Auth:Authority", "https://sso"), ("Auth:ClientId", "a"), ("Limits:RequestsPerMinute", "1")))).Message.ShouldContain("Limits:RequestsPerMinute");
        Should.Throw<OptionsValidationException>(() => Resolve<LimitsOptions>(Config(("Auth:Mode", "Oidc"), ("Auth:Authority", "https://sso"), ("Auth:ClientId", "a"), ("Limits:UploadMaxBytes", "5")))).Message.ShouldContain("Limits:UploadMaxBytes");
        Should.Throw<OptionsValidationException>(() => Resolve<ErrorTrackingOptions>(Config(("Auth:Mode", "Oidc"), ("Auth:Authority", "https://sso"), ("Auth:ClientId", "a"), ("ErrorTracking:Dsn", "khong-phai-url")))).Message.ShouldContain("ErrorTracking:Dsn");
        Resolve<ErrorTrackingOptions>(Config(("Auth:Mode", "Oidc"), ("Auth:Authority", "https://sso"), ("Auth:ClientId", "a"), ("ErrorTracking:Dsn", ""))).IsValid.ShouldBeTrue();
    }

    [Fact]
    public void Thieu_chuoi_ket_noi_thi_dung_voi_huong_dan_bang_tieng_Viet()
    {
        var error = Should.Throw<InvalidOperationException>(() => new ServiceCollection().AddHoSoInfrastructure(Config(("ConnectionStrings:HoSo", " "))));
        error.Message.ShouldContain("ConnectionStrings:HoSo");
        error.Message.ShouldContain("ConnectionStrings__HoSo");
    }

    [Fact]
    public void Proxy_tin_cay_lay_tu_cau_hinh_va_khong_con_tin_mac_dinh_khi_da_khai_bao()
    {
        var services = new ServiceCollection();
        HoSoSo.Api.Security.SecuritySetup.AddHoSoSecurity(services, Config(("Auth:Mode", "Dev"), ("ForwardedHeaders:KnownProxies:0", "203.0.113.9"), ("ForwardedHeaders:KnownNetworks:0", "10.20.0.0/16")), new FakeEnvironment { EnvironmentName = "Development" });
        var options = services.BuildServiceProvider().GetRequiredService<IOptions<ForwardedHeadersOptions>>().Value;
        options.KnownProxies.ShouldBe([IPAddress.Parse("203.0.113.9")]);
        options.KnownIPNetworks.Count.ShouldBe(1);
        options.KnownProxies.ShouldNotContain(IPAddress.Loopback);
    }

    [Fact]
    public async Task Qua_so_lan_goi_trong_mot_phut_thi_429()
    {
        await using var limited = factory.WithWebHostBuilder(b => b.UseSetting("Limits:RequestsPerMinute", "10"));
        var http = limited.CreateClient();
        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 16; i++) statuses.Add((await http.GetAsync("/api/v1/me", TestContext.Current.CancellationToken)).StatusCode);
        statuses.Count(s => s == HttpStatusCode.Unauthorized).ShouldBe(10);
        statuses.Count(s => s == HttpStatusCode.TooManyRequests).ShouldBe(6);
    }

    [Fact]
    public async Task OpenAPI_khai_bao_loi_chung_cho_moi_thao_tac_tru_dang_nhap()
    {
        var doc = JsonDocument.Parse(await factory.CreateClient().GetStringAsync("/openapi/v1.json", TestContext.Current.CancellationToken)).RootElement;
        var paths = doc.GetProperty("paths");
        var transition = paths.GetProperty("/api/v1/dossiers/{id}/transitions").GetProperty("post").GetProperty("responses");
        foreach (var code in new[] { "400", "401", "403", "404", "409", "422", "429" }) transition.TryGetProperty(code, out _).ShouldBeTrue($"thiếu {code}");
        transition.GetProperty("409").GetProperty("description").GetString()!.ShouldContain("concurrency_conflict");
        paths.GetProperty("/api/v1/auth/login").GetProperty("get").GetProperty("responses").TryGetProperty("401", out _).ShouldBeFalse("đăng nhập không cần khai báo 401");
        var me = paths.GetProperty("/api/v1/me").GetProperty("get").GetProperty("responses");
        me.TryGetProperty("404", out _).ShouldBeFalse();
        me.TryGetProperty("401", out _).ShouldBeTrue();
    }

    [Fact]
    public void Don_tep_tai_len_do_dang_cu_hon_mot_ngay_va_khong_dong_toi_tep_chinh_thuc()
    {
        var root = Path.Combine(Path.GetTempPath(), "hoso-clean-" + Guid.NewGuid().ToString("N"));
        try
        {
            var storage = new LocalFileStorage(Options.Create(new StorageOptions { Root = root }), new FakeEnvironment());
            Directory.CreateDirectory(Path.Combine(root, "tmp"));
            Directory.CreateDirectory(Path.Combine(root, "blobs", "ab", "cd"));
            var old = Path.Combine(root, "tmp", "cu.part");
            var fresh = Path.Combine(root, "tmp", "moi.part");
            var blob = Path.Combine(root, "blobs", "ab", "cd", new string('a', 64));
            foreach (var f in new[] { old, fresh, blob }) File.WriteAllText(f, "x");
            File.SetLastWriteTimeUtc(old, DateTime.UtcNow.AddDays(-2));
            File.SetLastWriteTimeUtc(blob, DateTime.UtcNow.AddDays(-400));

            storage.CleanTemp(TimeSpan.FromDays(1), DateTimeOffset.UtcNow).ShouldBe(1);
            File.Exists(old).ShouldBeFalse();
            File.Exists(fresh).ShouldBeTrue();
            File.Exists(blob).ShouldBeTrue("tệp chính thức không bao giờ bị dọn");
        }
        finally { if (Directory.Exists(root)) Directory.Delete(root, true); }
    }

    [Fact]
    public async Task Mat_CSDL_khi_ghi_nhat_ky_truy_cap_thi_khong_nem_loi_va_dem_so_dong_mat()
    {
        var queue = new AccessEventQueue();
        await using var dead = NpgsqlDataSource.Create("Host=127.0.0.1;Port=1;Database=none;Timeout=1;Command Timeout=1");
        var configuration = new Microsoft.Extensions.Configuration.ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["AccessLog:RetryDelaysMs:0"] = "50", ["AccessLog:RetryDelaysMs:1"] = "50" }).Build();
        var writer = new AccessEventWriter(queue, dead, configuration, NullLogger<AccessEventWriter>.Instance);
        await writer.StartAsync(TestContext.Current.CancellationToken);
        for (var i = 0; i < 3; i++) queue.Enqueue(new AccessEventRecord(Guid.NewGuid(), "view", "dossier", Guid.NewGuid(), "127.0.0.1", "c", DateTimeOffset.UtcNow));
        await queue.DrainAsync(TimeSpan.FromSeconds(15));
        queue.Failed.ShouldBe(3, "ba dòng bị mất (sau khi đã thử lại) được đếm để cảnh báo, request người dùng không bị ảnh hưởng");
        queue.LastLossAt.ShouldNotBeNull();
        await writer.StopAsync(TestContext.Current.CancellationToken);
    }
}
