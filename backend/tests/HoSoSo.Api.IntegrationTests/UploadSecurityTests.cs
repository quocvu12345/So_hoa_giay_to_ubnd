using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Application.Intake;
using HoSoSo.Infrastructure.Antivirus;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using UglyToad.PdfPig.Writer;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>SEC-05: quét virus (ClamAV qua giao thức clamd) và giới hạn số trang khi tải PDF lên.</summary>
public sealed class UploadSecurityTests(UploadSecurityTests.SecurityFactory api) : IClassFixture<UploadSecurityTests.SecurityFactory>
{
    public sealed class SecurityFactory : DbApiFactory
    {
        public FakeClamd Clamd { get; } = new();

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseSetting("Antivirus:Enabled", "true");
            builder.UseSetting("Antivirus:Host", "127.0.0.1");
            builder.UseSetting("Antivirus:Port", Clamd.Port.ToString());
            builder.UseSetting("Antivirus:TimeoutSeconds", "5");
            builder.UseSetting("Limits:MaxPdfPages", "10");
        }

        public override async ValueTask DisposeAsync()
        {
            await base.DisposeAsync();
            await Clamd.DisposeAsync();
        }
    }

    private static byte[] PdfWithPages(int pages)
    {
        var builder = new PdfDocumentBuilder();
        for (var i = 0; i < pages; i++) builder.AddPage(UglyToad.PdfPig.Content.PageSize.A4);
        return builder.Build();
    }

    /// <summary>PDF giả đủ đầu tệp %PDF-, có thể kèm một chuỗi thử; không đọc được bằng trình đọc PDF (như nhiều tệp trong các test khác).</summary>
    private static byte[] FakePdf(string payload, int padding = 0) =>
        Encoding.Latin1.GetBytes($"%PDF-1.4\n% {payload}\n{new string('x', padding)}\n%%EOF\n");

    private static async Task<HttpResponseMessage> UploadAsync(HttpClient http, byte[] bytes, string name = "tai-lieu.pdf")
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", name);
        return await http.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken);
    }

    private Task<long> RowsAsync(string sha) => api.ScalarAsync<long>("SELECT count(*) FROM hoso.files WHERE sha256 = $1", sha);
    private static string Sha(byte[] bytes) => Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(bytes));

    [Fact]
    public async Task Tep_sach_duoc_quet_dung_giao_thuc_clamd_roi_moi_nhan()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var scans = api.Clamd.Scans;
        var bytes = FakePdf(Guid.NewGuid().ToString("N"), padding: 300_000);
        var response = await UploadAsync(http, bytes);
        response.StatusCode.ShouldBe(HttpStatusCode.Created);

        api.Clamd.Scans.ShouldBe(scans + 1, "mỗi lần tải lên quét đúng một lần");
        api.Clamd.LastBytes.ShouldBe(bytes.Length, "clamd nhận đủ từng byte của tệp");
        api.Clamd.LastChunks.ShouldBeGreaterThan(3, "tệp 300 KB được chia thành nhiều đoạn 64 KB, không nạp một lần");
        api.Clamd.ProtocolViolations.ShouldBeEmpty();
        (await RowsAsync(Sha(bytes))).ShouldBe(1);
    }

    [Fact]
    public async Task Tep_EICAR_bi_chan_422_khong_luu_gi_va_noi_ro_ten_mau()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var documentsBefore = await api.ScalarAsync<long>("SELECT count(*) FROM hoso.documents");
        var bytes = FakePdf(FakeClamd.EicarMarker);
        var response = await UploadAsync(http, bytes);

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await response.ProblemCodeAsync()).ShouldBe("file_infected");
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("Win.Test.EICAR_HDB-1");
        (await RowsAsync(Sha(bytes))).ShouldBe(0);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.documents")).ShouldBe(documentsBefore, "chưa tạo giấy tờ nào");
        Directory.Exists(Path.Combine(api.StorageRoot, "blobs")).ShouldBeFalse("tệp độc hại không được ghi vào kho");
    }

    [Fact]
    public async Task May_quet_loi_hoac_het_gio_thi_chan_theo_mac_dinh_va_cho_qua_khi_bat_FailOpen()
    {
        // Cổng không có ai lắng nghe: không kết nối được.
        var closed = new System.Net.Sockets.TcpListener(System.Net.IPAddress.Loopback, 0);
        closed.Start();
        var closedPort = ((System.Net.IPEndPoint)closed.LocalEndpoint).Port;
        closed.Stop();

        await using var failClosed = api.WithWebHostBuilder(b => b.UseSetting("Antivirus:Port", closedPort.ToString()));
        var http = await Login(failClosed);
        var bytes = FakePdf(Guid.NewGuid().ToString("N"));
        var blocked = await UploadAsync(http, bytes);
        blocked.StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable);
        (await blocked.ProblemCodeAsync()).ShouldBe("scanner_unavailable");
        (await RowsAsync(Sha(bytes))).ShouldBe(0, "không quét được thì không lưu");

        await using var failOpen = api.WithWebHostBuilder(b =>
        {
            b.UseSetting("Antivirus:Port", closedPort.ToString());
            b.UseSetting("Antivirus:FailOpen", "true");
        });
        (await UploadAsync(await Login(failOpen), bytes)).StatusCode.ShouldBe(HttpStatusCode.Created);

        // Máy quét treo: chờ đúng hạn rồi chặn, không treo theo.
        api.Clamd.Hang = true;
        try
        {
            await using var slow = api.WithWebHostBuilder(b => b.UseSetting("Antivirus:TimeoutSeconds", "1"));
            var clock = Stopwatch.StartNew();
            var timedOut = await UploadAsync(await Login(slow), FakePdf(Guid.NewGuid().ToString("N")));
            timedOut.StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable);
            clock.Elapsed.ShouldBeLessThan(TimeSpan.FromSeconds(8));
        }
        finally { api.Clamd.Hang = false; }
    }

    private static async Task<HttpClient> Login(Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> factory)
    {
        var http = factory.CreateClient(new() { AllowAutoRedirect = false, HandleCookies = true });
        (await http.GetAsync("/api/v1/auth/dev-login?username=demo_cv_ht", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Redirect);
        http.DefaultRequestHeaders.Add("X-CSRF", "1");
        return http;
    }

    [Fact]
    public async Task Clamd_bao_vuot_gioi_han_do_dai_thi_tinh_la_may_quet_loi_va_chan()
    {
        api.Clamd.StreamMaxLength = 1000;
        try
        {
            var http = await api.LoginAsync("demo_cv_ht");
            var response = await UploadAsync(http, FakePdf(Guid.NewGuid().ToString("N"), padding: 5000));
            response.StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable, "tệp lớn hơn StreamMaxLength của clamd phải chặn, không coi là sạch");
        }
        finally { api.Clamd.StreamMaxLength = 0; }
    }

    [Fact]
    public async Task PDF_nhieu_trang_hon_gioi_han_bi_tu_choi_va_PDF_hop_le_duoc_ghi_so_trang()
    {
        var http = await api.LoginAsync("demo_cv_ht");

        var tooMany = PdfWithPages(12);                       // giới hạn của factory này là 10 trang
        var rejected = await UploadAsync(http, tooMany);
        rejected.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await rejected.ProblemCodeAsync()).ShouldBe("pdf_too_large");
        (await rejected.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("12 trang");
        (await RowsAsync(Sha(tooMany))).ShouldBe(0);

        var fine = PdfWithPages(5);
        (await UploadAsync(http, fine)).StatusCode.ShouldBe(HttpStatusCode.Created);
        (await api.ScalarAsync<int>("SELECT page_count FROM hoso.files WHERE sha256 = $1", Sha(fine))).ShouldBe(5, "số trang được ghi ngay lúc tải lên");

        // Đúng bằng giới hạn thì nhận.
        (await UploadAsync(http, PdfWithPages(10))).StatusCode.ShouldBe(HttpStatusCode.Created);

        // PDF không đọc được bằng trình đọc (hỏng, mã hóa...) vẫn được nhận như trước; worker AI sẽ báo lỗi có ngữ cảnh.
        var unreadable = FakePdf(Guid.NewGuid().ToString("N"));
        (await UploadAsync(http, unreadable)).StatusCode.ShouldBe(HttpStatusCode.Created);
        (await api.ScalarAsync<int?>("SELECT page_count FROM hoso.files WHERE sha256 = $1", Sha(unreadable))).ShouldBeNull();
    }

    [Theory]
    [InlineData("stream: OK", true, null, null)]
    [InlineData("OK", true, null, null)]
    [InlineData("stream: Win.Test.EICAR_HDB-1 FOUND", false, "Win.Test.EICAR_HDB-1", null)]
    [InlineData("stream: Pdf.Exploit.CVE_2010-0188-1 FOUND", false, "Pdf.Exploit.CVE_2010-0188-1", null)]
    public void Doc_ket_qua_clamd_dung(string reply, bool clean, string? signature, string? error)
    {
        var result = ClamAvScanner.Parse(reply);
        (result.Clean, result.Signature, result.Error).ShouldBe((clean, signature, error));
    }

    [Theory]
    [InlineData("INSTREAM size limit exceeded. ERROR")]
    [InlineData("stream: Unknown ERROR")]
    [InlineData("")]
    public void Tra_loi_la_hoac_rong_la_may_quet_loi_chu_khong_phai_sach(string reply)
    {
        var result = ClamAvScanner.Parse(reply);
        result.Clean.ShouldBeFalse();
        result.Unavailable.ShouldBeTrue();
    }

    [Fact]
    public void Mac_dinh_tat_quet_virus_de_khong_phu_thuoc_ClamAV_chua_cai()
    {
        // Cấu hình mặc định (không đặt Antivirus:*) là tắt, và không quét được thì không nhận.
        new AntivirusOptions().Enabled.ShouldBeFalse();
        new AntivirusOptions().FailOpen.ShouldBeFalse("mặc định an toàn: không quét được thì không nhận");
        api.Services.GetRequiredService<IVirusScanner>().Enabled.ShouldBeTrue("factory này bật quét để test");
    }
}
