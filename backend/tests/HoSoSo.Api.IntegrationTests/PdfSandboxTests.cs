using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Application.Common;
using HoSoSo.Application.Documents;
using HoSoSo.Infrastructure.Pdf;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using UglyToad.PdfPig.Writer;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>
/// BE-93: xử lý PDF chạy trong tiến trình con có hạn giờ, bộ nhớ, dung lượng kết quả, môi trường đã lọc. Các ca "độc hại" thay tiến trình con bằng lệnh
/// cố ý treo, ngốn RAM, xả dữ liệu (PdfSandbox:Command), vì không có PDF thật nào đáng tin để tái hiện đúng các lỗi đó.
/// </summary>
public sealed class PdfSandboxTests
{
    private static byte[] PdfWithPages(int pages)
    {
        var builder = new PdfDocumentBuilder();
        var font = builder.AddStandard14Font(UglyToad.PdfPig.Fonts.Standard14Fonts.Standard14Font.Helvetica);
        for (var i = 1; i <= pages; i++)
        {
            var page = builder.AddPage(UglyToad.PdfPig.Content.PageSize.A4);
            page.AddText($"Trang {i}", 14, new UglyToad.PdfPig.Core.PdfPoint(72, 700), font);
        }
        return builder.Build();
    }

    private static (SandboxedPdfTools Tools, SandboxedPreviewRenderer Renderer, PdfSandboxRunner Runner) Create(Action<PdfSandboxOptions>? configure = null, int maxPages = 500)
    {
        var options = new PdfSandboxOptions { TimeoutSeconds = 20 };
        configure?.Invoke(options);
        var runner = new PdfSandboxRunner(Options.Create(options), NullLogger<PdfSandboxRunner>.Instance);
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Limits:MaxPdfPages"] = maxPages.ToString() }).Build();
        return (new SandboxedPdfTools(runner, configuration), new SandboxedPreviewRenderer(runner), runner);
    }

    private static Stream Stream(byte[] bytes) => new MemoryStream(bytes);

    // ---- chức năng thật qua tiến trình con ----

    [Fact]
    public void Dem_trang_cat_trang_va_dung_anh_chay_dung_qua_tien_trinh_con()
    {
        var (tools, renderer, runner) = Create();
        using var _ = runner;
        var pdf = PdfWithPages(3);

        tools.CountPages(Stream(pdf)).ShouldBe(3);
        var cut = tools.ExtractPages(Stream(pdf), 2, 3);
        tools.CountPages(Stream(cut)).ShouldBe(2, "PDF cắt ra là một PDF đọc được, đúng 2 trang");
        var image = renderer.RenderWebp(Stream(pdf), 1, 320);
        System.Text.Encoding.ASCII.GetString(image, 0, 4).ShouldBe("RIFF");
        System.Text.Encoding.ASCII.GetString(image, 8, 4).ShouldBe("WEBP");
        tools.ReadSignatures(Stream(pdf)).ShouldBeEmpty("PDF không có chữ ký số");
    }

    [Fact]
    public void Loi_cua_tep_duoc_phan_biet_hong_voi_vuot_gioi_han()
    {
        var (tools, renderer, runner) = Create(maxPages: 2);
        using var _ = runner;
        Should.Throw<PdfLimitExceededException>(() => tools.CountPages(Stream(PdfWithPages(3)))).Message.ShouldContain("3 trang");
        tools.CountPages(Stream(PdfWithPages(2))).ShouldBe(2, "đúng bằng giới hạn thì nhận");

        var broken = Should.Throw<InvalidPdfException>(() => tools.CountPages(Stream("không phải PDF"u8.ToArray())));
        broken.ShouldNotBeOfType<PdfLimitExceededException>("tệp hỏng khác tệp vượt giới hạn: nơi gọi xử lý khác nhau");
        Should.Throw<InvalidPdfException>(() => renderer.RenderWebp(Stream(PdfWithPages(1)), 9, 300)).Message.ShouldContain("không có trang này");
        Should.Throw<InvalidPdfException>(() => tools.ExtractPages(Stream(PdfWithPages(2)), 2, 9));
    }

    // ---- tiến trình con độc hại ----

    [Fact]
    public void Tien_trinh_con_treo_bi_giet_dung_han_va_he_thong_van_chay_tiep()
    {
        var (tools, _, runner) = Create(o => { o.TimeoutSeconds = 1; o.Command = "/bin/sh -c 'sleep 60' --"; });
        using var _ = runner;
        var clock = Stopwatch.StartNew();
        var exception = Should.Throw<PdfLimitExceededException>(() => tools.CountPages(Stream(PdfWithPages(1))));
        clock.Elapsed.ShouldBeLessThan(TimeSpan.FromSeconds(10), "bị giết sau 1 giây, không chờ đủ 60 giây");
        exception.Message.ShouldContain("quá 1 giây");

        // Sau sự cố, một yêu cầu bình thường (bộ chạy khác, lệnh mặc định) vẫn xử lý được: không có gì kẹt lại.
        var (healthy, _, runner2) = Create();
        using var __ = runner2;
        healthy.CountPages(Stream(PdfWithPages(2))).ShouldBe(2);
    }

    [Fact]
    public void Tien_trinh_con_an_qua_nhieu_bo_nho_bi_giet()
    {
        Assert.SkipUnless(File.Exists("/usr/bin/python3") || File.Exists("/opt/homebrew/bin/python3") || File.Exists("/usr/local/bin/python3"), "cần python3 để mô phỏng tiến trình ngốn RAM");
        var (tools, _, runner) = Create(o => { o.MaxMemoryMb = 200; o.TimeoutSeconds = 30; o.Command = "python3 -c \"import time; b = b'x' * (700 * 1024 * 1024); time.sleep(60)\""; });
        using var _ = runner;
        var clock = Stopwatch.StartNew();
        var exception = Should.Throw<PdfLimitExceededException>(() => tools.CountPages(Stream(PdfWithPages(1))));
        exception.Message.ShouldContain("bộ nhớ");
        clock.Elapsed.ShouldBeLessThan(TimeSpan.FromSeconds(20));
    }

    [Fact]
    public void Tien_trinh_con_xa_du_lieu_vo_han_bi_giet_khi_vuot_dung_luong_ket_qua()
    {
        var (tools, _, runner) = Create(o => { o.MaxOutputMb = 1; o.Command = "/bin/sh -c yes --"; });
        using var _ = runner;
        var exception = Should.Throw<PdfLimitExceededException>(() => tools.ExtractPages(Stream(PdfWithPages(1)), 1, 1));
        exception.Message.ShouldContain("kết quả quá lớn");
    }

    [Fact]
    public void Tien_trinh_con_khong_thua_huong_bi_mat_trong_moi_truong_cua_API()
    {
        var secrets = new Dictionary<string, string>
        {
            ["Backup__IngestToken"] = "bi-mat-khoa-may-canary-1111",
            ["ConnectionStrings__HoSo"] = "Host=x;Password=bi-mat-csdl-canary-2222",
            ["Auth__ClientSecret"] = "bi-mat-oidc-canary-3333",
            ["Storage__S3__SecretKey"] = "bi-mat-s3-canary-4444",
        };
        foreach (var (name, value) in secrets) Environment.SetEnvironmentVariable(name, value);
        try
        {
            // `env` in toàn bộ môi trường của tiến trình con ra stdout; thoát mã 0 nên bộ chạy trả đúng nội dung đó.
            var (_, renderer, runner) = Create(o => o.Command = "/bin/sh -c env --");
            using var _ = runner;
            var printed = System.Text.Encoding.UTF8.GetString(renderer.RenderWebp(Stream(PdfWithPages(1)), 1, 100));
            printed.ShouldContain("PATH=", customMessage: "biến cần thiết vẫn được giữ");
            foreach (var value in secrets.Values) printed.ShouldNotContain(value);
            printed.ShouldNotContain("Auth__ClientSecret");
        }
        finally { foreach (var name in secrets.Keys) Environment.SetEnvironmentVariable(name, null); }
    }

    [Fact]
    public void Khong_khoi_dong_duoc_tien_trinh_con_thi_bao_503_ro_rang()
    {
        var (tools, _, runner) = Create(o => o.Command = "/khong/co/tep/nay");
        using var _ = runner;
        var exception = Should.Throw<AppException>(() => tools.CountPages(Stream(PdfWithPages(1))));
        (exception.Status, exception.Code).ShouldBe((503, "pdf_sandbox_unavailable"));
    }

    [Theory]
    [InlineData("a b c", new[] { "a", "b", "c" })]
    [InlineData("/bin/sh -c 'sleep 60' --", new[] { "/bin/sh", "-c", "sleep 60", "--" })]
    [InlineData("python3 -c \"import time; time.sleep(1)\"", new[] { "python3", "-c", "import time; time.sleep(1)" })]
    [InlineData("  x   ''  y ", new[] { "x", "", "y" })]
    public void Tach_dong_lenh_hieu_dau_nhay(string command, string[] expected) =>
        PdfSandboxRunner.SplitCommand(command).ShouldBe(expected);

    // ---- qua API ----

    public sealed class SandboxApiFactory : DbApiFactory
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseSetting("PdfSandbox:Mode", "Process");
            builder.UseSetting("PdfSandbox:TimeoutSeconds", "20");
            builder.UseSetting("Limits:MaxPdfPages", "10");
        }
    }

    public sealed class ApiTests(SandboxApiFactory api) : IClassFixture<SandboxApiFactory>
    {
        private static async Task<HttpResponseMessage> UploadAsync(HttpClient http, byte[] bytes)
        {
            var form = new MultipartFormDataContent { { new ByteArrayContent(bytes) { Headers = { ContentType = new MediaTypeHeaderValue("application/pdf") } }, "file", $"{Guid.NewGuid():N}.pdf" } };
            return await http.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken);
        }

        [Fact]
        public async Task Tai_len_xem_trang_va_gioi_han_trang_deu_di_qua_tien_trinh_con()
        {
            var http = await api.LoginAsync("demo_cv_ht");
            var upload = await (await UploadAsync(http, PdfWithPages(4))).ReadAsync<UploadDto>();
            (await api.ScalarAsync<int>("SELECT page_count FROM hoso.files WHERE id = $1", upload.FileId)).ShouldBe(4);

            var preview = await http.GetAsync($"/api/v1/files/{upload.FileId}/pages/2/preview?w=400");
            preview.StatusCode.ShouldBe(HttpStatusCode.OK);
            preview.Content.Headers.ContentType!.MediaType.ShouldBe("image/webp");
            var image = await preview.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
            System.Text.Encoding.ASCII.GetString(image, 8, 4).ShouldBe("WEBP");

            var tooMany = await UploadAsync(http, PdfWithPages(12));
            tooMany.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
            (await tooMany.ProblemCodeAsync()).ShouldBe("pdf_too_large");
        }

        [Fact]
        public async Task PDF_lam_tien_trinh_con_treo_bi_tu_choi_nhanh_va_API_van_khoe()
        {
            await using var hostile = api.WithWebHostBuilder(b =>
            {
                b.UseSetting("PdfSandbox:Command", "/bin/sh -c 'sleep 60' --");
                b.UseSetting("PdfSandbox:TimeoutSeconds", "1");
            });
            var http = hostile.CreateClient(new() { AllowAutoRedirect = false, HandleCookies = true });
            (await http.GetAsync("/api/v1/auth/dev-login?username=demo_cv_ht", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Redirect);
            http.DefaultRequestHeaders.Add("X-CSRF", "1");

            var clock = Stopwatch.StartNew();
            var response = await UploadAsync(http, PdfWithPages(1));
            clock.Elapsed.ShouldBeLessThan(TimeSpan.FromSeconds(15));
            response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
            (await response.ProblemCodeAsync()).ShouldBe("pdf_too_large", "tệp làm bộ xử lý quá giờ bị coi là vượt giới hạn xử lý, không lưu");

            // API vẫn trả lời các request khác trong và sau sự cố.
            (await http.GetAsync("/health/live", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.OK);
            (await http.GetAsync("/api/v1/me", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.OK);
        }
    }
}
