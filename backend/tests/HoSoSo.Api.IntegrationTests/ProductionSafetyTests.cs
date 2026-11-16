using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using HoSoSo.Api.Configuration;
using HoSoSo.Api.IntegrationTests.Support;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-96: cấu hình chưa an toàn thì Production không khởi động; khóa Data Protection được mã hóa bằng chứng thư khi lưu.</summary>
public sealed class ProductionSafetyTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "hoso-prodsafety-" + Guid.NewGuid().ToString("N"));

    public ProductionSafetyTests() => Directory.CreateDirectory(_directory);
    public void Dispose() { if (Directory.Exists(_directory)) Directory.Delete(_directory, true); }

    private sealed class Env(string name) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = name;
        public string ApplicationName { get; set; } = "test";
        public string ContentRootPath { get; set; } = "/";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    /// <summary>Tạo chứng thư tự ký thử và ghi ra tệp .pfx.</summary>
    private string NewCertificate(string password)
    {
        using var rsa = RSA.Create(2048);
        var request = new CertificateRequest("CN=hoso-thu", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        using var certificate = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddDays(30));
        var path = Path.Combine(_directory, "khoa.pfx");
        File.WriteAllBytes(path, certificate.Export(X509ContentType.Pfx, password));
        return path;
    }

    private Dictionary<string, string?> Good() => new()
    {
        ["Auth:DataProtectionKeysPath"] = Path.Combine(_directory, "keys"),
        ["Auth:DataProtectionCertificatePath"] = NewCertificate("mat-khau"),
        ["Antivirus:Enabled"] = "true",
        ["PdfSandbox:Mode"] = "Process",
    };

    private static ProductionSafety.Result Check(Dictionary<string, string?> values, string environment = "Production") =>
        ProductionSafety.Check(new ConfigurationBuilder().AddInMemoryCollection(values).Build(), new Env(environment));

    [Fact]
    public void Cau_hinh_day_du_va_an_toan_khong_co_loi_hay_canh_bao()
    {
        var result = Check(Good());
        result.Errors.ShouldBeEmpty();
        result.Warnings.ShouldBeEmpty();
    }

    [Fact]
    public void Moi_truong_phat_trien_khong_bi_kiem_tra_Production()
    {
        var result = Check(new Dictionary<string, string?> { ["PdfSandbox:Mode"] = "InProcess" }, "Development");
        result.Errors.ShouldBeEmpty();
        result.Warnings.ShouldBeEmpty();
    }

    [Fact]
    public void Sandbox_InProcess_o_Production_la_loi()
    {
        var values = Good();
        values["PdfSandbox:Mode"] = "InProcess";
        var errors = Check(values).Errors;
        errors.ShouldHaveSingleItem().ShouldContain("PdfSandbox:Mode=InProcess");
    }

    [Fact]
    public void Thieu_thu_muc_khoa_hoac_chua_bao_ve_khoa_la_loi_nhung_xac_nhan_ro_rui_ro_thi_duoc()
    {
        var noKeys = Good();
        noKeys.Remove("Auth:DataProtectionKeysPath");
        Check(noKeys).Errors.ShouldHaveSingleItem().ShouldContain("Auth:DataProtectionKeysPath");

        var noCertificate = Good();
        noCertificate.Remove("Auth:DataProtectionCertificatePath");
        Check(noCertificate).Errors.ShouldHaveSingleItem().ShouldContain("Auth:DataProtectionCertificatePath");

        noCertificate["Auth:AllowUnprotectedDataProtectionKeys"] = "true";
        Check(noCertificate).Errors.ShouldBeEmpty("chủ động chấp nhận rủi ro (đã mã hóa cả ổ đĩa)");

        var missingFile = Good();
        missingFile["Auth:DataProtectionCertificatePath"] = Path.Combine(_directory, "khong-co.pfx");
        Check(missingFile).Errors.ShouldHaveSingleItem().ShouldContain("Không thấy tệp chứng thư");
    }

    [Fact]
    public void S3_qua_http_ra_ngoai_mang_noi_bo_la_loi_con_mang_noi_bo_thi_duoc()
    {
        foreach (var (url, ok) in new[]
        {
            ("http://s3.amazonaws.com", false), ("http://storage.example.com:9000", false), ("http://8.8.8.8:9000", false),
            ("https://s3.amazonaws.com", true), ("http://127.0.0.1:9000", true), ("http://10.1.2.3:9000", true), ("http://192.168.1.10:9000", true),
            ("http://172.20.0.5:9000", true), ("http://minio:9000", true), ("http://minio.noi-bo.local:9000", true), ("http://kho.intranet:9000", true),
        })
        {
            var values = Good();
            values["Storage:Provider"] = "S3";
            values["Storage:S3:ServiceUrl"] = url;
            var errors = Check(values).Errors;
            (errors.Count == 0).ShouldBe(ok, url);
            if (!ok) errors.ShouldHaveSingleItem().ShouldContain("https://");
        }
        var local = Good();
        local["Storage:S3:ServiceUrl"] = "http://storage.example.com";      // Provider=Local: S3 không dùng nên không kiểm
        Check(local).Errors.ShouldBeEmpty();
    }

    [Theory]
    [InlineData("172.15.0.1", false)]
    [InlineData("172.16.0.1", true)]
    [InlineData("172.31.255.255", true)]
    [InlineData("172.32.0.1", false)]
    [InlineData("100.64.0.1", true)]
    [InlineData("100.128.0.1", false)]
    [InlineData("169.254.1.1", true)]
    [InlineData("::1", true)]
    [InlineData("fd12:3456::1", true)]
    [InlineData("2001:4860:4860::8888", false)]
    public void Phan_biet_dia_chi_noi_bo(string host, bool internalHost) => ProductionSafety.IsInternalHost(host).ShouldBe(internalHost);

    [Fact]
    public void Tat_chong_virus_la_canh_bao_hoac_loi_neu_bat_buoc_va_FailOpen_la_canh_bao()
    {
        var values = Good();
        values["Antivirus:Enabled"] = "false";
        var warned = Check(values);
        warned.Errors.ShouldBeEmpty();
        warned.Warnings.ShouldHaveSingleItem().ShouldContain("không được quét mã độc");

        values["Antivirus:RequiredInProduction"] = "true";
        Check(values).Errors.ShouldHaveSingleItem().ShouldContain("Antivirus:RequiredInProduction");

        var open = Good();
        open["Antivirus:FailOpen"] = "true";
        Check(open).Warnings.ShouldHaveSingleItem().ShouldContain("FailOpen");
    }

    [Fact]
    public void Khoa_may_sao_luu_qua_ngan_bi_canh_bao_vi_endpoint_tat_am_tham()
    {
        var values = Good();
        values["Backup:IngestToken"] = "ngan";
        Check(values).Warnings.ShouldHaveSingleItem().ShouldContain("Backup:IngestToken");
        values["Backup:IngestToken"] = new string('k', 32);
        Check(values).Warnings.ShouldBeEmpty();
    }

    [Fact]
    public void Nhieu_loi_cung_luc_duoc_liet_ke_het_de_sua_mot_lan()
    {
        var errors = Check(new Dictionary<string, string?> { ["PdfSandbox:Mode"] = "InProcess" }).Errors;
        errors.Count.ShouldBe(3, "InProcess, thiếu thư mục khóa, chưa bảo vệ khóa");
    }

    // ---- khóa Data Protection mã hóa bằng chứng thư ----

    public sealed class KeyFactory(string keys, string certificate) : DbApiFactory
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseSetting("Auth:DataProtectionKeysPath", keys);
            builder.UseSetting("Auth:DataProtectionCertificatePath", certificate);
            builder.UseSetting("Auth:DataProtectionCertificatePassword", "mat-khau");
        }
    }

    [Fact]
    public async Task Khoa_Data_Protection_luu_tren_dia_da_duoc_ma_hoa_bang_chung_thu_va_cookie_van_dung_duoc()
    {
        var keys = Path.Combine(_directory, "keys");
        await using var factory = new KeyFactory(keys, NewCertificate("mat-khau"));
        await ((IAsyncLifetime)factory).InitializeAsync();
        var http = await factory.LoginAsync("demo_cv_ht");
        (await http.GetAsync("/api/v1/me", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.OK, "cookie mã hóa bằng khóa được bảo vệ vẫn đọc lại được");

        var file = Directory.GetFiles(keys, "key-*.xml").ShouldHaveSingleItem();
        var xml = await File.ReadAllTextAsync(file, TestContext.Current.CancellationToken);
        xml.ShouldContain("encryptedKey");
        xml.ShouldNotContain("<masterKey", Case.Insensitive, "khóa không được nằm trần trong tệp");
    }
}
