using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Infrastructure.Storage;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>
/// BE-21: kho tệp S3/MinIO. Chạy khi đặt <c>HOSO_TEST_S3_URL</c> (ví dụ <c>http://127.0.0.1:5099</c>, một máy chủ tương thích S3 cục bộ như MinIO hoặc moto);
/// không đặt thì các test này báo "bỏ qua" chứ không báo đạt giả. Khóa truy cập thử lấy từ HOSO_TEST_S3_ACCESS/HOSO_TEST_S3_SECRET (mặc định test/test).
/// </summary>
public sealed class S3FileStorageTests : IAsyncLifetime
{
    private static readonly string? ServiceUrl = Environment.GetEnvironmentVariable("HOSO_TEST_S3_URL");
    private static readonly string Access = Environment.GetEnvironmentVariable("HOSO_TEST_S3_ACCESS") ?? "test";
    private static readonly string Secret = Environment.GetEnvironmentVariable("HOSO_TEST_S3_SECRET") ?? "test";

    private readonly string _bucket = "hoso-test-" + Guid.NewGuid().ToString("N")[..12];
    private readonly string _temp = Path.Combine(Path.GetTempPath(), "hoso-s3-test-" + Guid.NewGuid().ToString("N"));
    private AmazonS3Client? _raw;

    private sealed class TestEnvironment(string root) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "test";
        public string ContentRootPath { get; set; } = root;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    public async ValueTask InitializeAsync()
    {
        if (ServiceUrl is null) return;
        _raw = new AmazonS3Client(new BasicAWSCredentials(Access, Secret), new AmazonS3Config { ServiceURL = ServiceUrl, ForcePathStyle = true, AuthenticationRegion = "us-east-1" });
        await _raw.PutBucketAsync(_bucket);
    }

    public async ValueTask DisposeAsync()
    {
        if (_raw is not null)
        {
            var listed = await _raw.ListObjectsV2Async(new ListObjectsV2Request { BucketName = _bucket });
            foreach (var o in listed.S3Objects ?? []) await _raw.DeleteObjectAsync(_bucket, o.Key);
            await _raw.DeleteBucketAsync(_bucket);
            _raw.Dispose();
        }
        if (Directory.Exists(_temp)) Directory.Delete(_temp, true);
    }

    private S3FileStorage Storage(string prefix = "") => ServiceUrl is null
        ? throw new InvalidOperationException()
        : new S3FileStorage(Options.Create(new StorageOptions
        {
            Root = _temp, Provider = "S3",
            S3 = new S3Options { ServiceUrl = ServiceUrl, Bucket = _bucket, AccessKey = Access, SecretKey = Secret, Prefix = prefix },
        }), new TestEnvironment(_temp));

    private static void RequireS3() => Assert.SkipUnless(ServiceUrl is not null, "Đặt HOSO_TEST_S3_URL (máy chủ tương thích S3 cục bộ) để chạy test kho S3.");

    private static byte[] RandomBytes(int length)
    {
        var bytes = new byte[length];
        new Random(length).NextBytes(bytes);
        return bytes;
    }

    private static string Sha(byte[] bytes) => Convert.ToHexStringLower(SHA256.HashData(bytes));

    [Fact]
    public async Task Ghi_hai_lan_cung_noi_dung_thi_lan_hai_AlreadyExisted_va_khoa_giong_kho_o_dia()
    {
        RequireS3();
        using var storage = Storage();
        var bytes = RandomBytes(300_000);
        var first = await storage.SaveAsync(new MemoryStream(bytes), TestContext.Current.CancellationToken);
        var second = await storage.SaveAsync(new MemoryStream(bytes), TestContext.Current.CancellationToken);

        first.AlreadyExisted.ShouldBeFalse();
        second.AlreadyExisted.ShouldBeTrue();
        (second.StorageKey, second.ByteSize, second.Sha256).ShouldBe((first.StorageKey, 300_000L, Sha(bytes)));
        first.StorageKey.ShouldBe($"blobs/{Sha(bytes)[..2]}/{Sha(bytes)[2..4]}/{Sha(bytes)}", "cùng quy ước khóa với kho ổ đĩa");
        Directory.GetFiles(Path.Combine(_temp, "tmp")).ShouldBeEmpty("không để lại tệp ghi tạm");
    }

    [Fact]
    public async Task Doc_lai_nguyen_ven_tua_duoc_va_doc_theo_khoang()
    {
        RequireS3();
        using var storage = Storage();
        var bytes = RandomBytes(2_500_000);                // lớn hơn một đoạn đọc (1 MiB) để ép nhiều lần gọi Range
        var stored = await storage.SaveAsync(new MemoryStream(bytes), TestContext.Current.CancellationToken);

        await using var stream = await storage.OpenReadAsync(stored.StorageKey, TestContext.Current.CancellationToken);
        stream.CanSeek.ShouldBeTrue();
        stream.Length.ShouldBe(2_500_000);

        async Task<byte[]> ReadAtAsync(long position, int count)
        {
            stream.Seek(position, SeekOrigin.Begin);
            var buffer = new byte[count];
            await stream.ReadExactlyAsync(buffer, TestContext.Current.CancellationToken);
            return buffer;
        }
        (await ReadAtAsync(1_000_000, 100)).ShouldBe(bytes[1_000_000..1_000_100]);
        (await ReadAtAsync(2_499_900, 100)).ShouldBe(bytes[2_499_900..]);          // sát cuối tệp
        (await ReadAtAsync(0, 64)).ShouldBe(bytes[..64]);                           // quay về đầu
        (await ReadAtAsync(1_048_570, 20)).ShouldBe(bytes[1_048_570..1_048_590]);    // vắt qua ranh giới đoạn

        stream.Seek(-10, SeekOrigin.End).ShouldBe(2_499_990);
        var tail = new byte[50];
        (await stream.ReadAsync(tail, TestContext.Current.CancellationToken)).ShouldBe(10, "chỉ còn 10 byte");
        (await stream.ReadAsync(tail, TestContext.Current.CancellationToken)).ShouldBe(0, "hết tệp");

        // Đọc tuần tự toàn bộ bằng CopyTo (cách ZipArchive và TypedResults.File dùng) cho đúng mã băm.
        stream.Position = 0;
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        var buf = new byte[81920];
        int n;
        while ((n = await stream.ReadAsync(buf, TestContext.Current.CancellationToken)) > 0) hash.AppendData(buf, 0, n);
        Convert.ToHexStringLower(hash.GetHashAndReset()).ShouldBe(stored.Sha256);
    }

    [Fact]
    public async Task Tep_lon_hon_nguong_multipart_va_luong_khong_biet_do_dai_van_nguyen_ven()
    {
        RequireS3();
        using var storage = Storage();
        var bytes = RandomBytes(20 * 1024 * 1024);          // trên ngưỡng 16 MiB của TransferUtility: gửi theo nhiều phần
        // Luồng không tua được và không biết độ dài, như thân request HTTP.
        var stored = await storage.SaveAsync(new ForwardOnlyStream(bytes), TestContext.Current.CancellationToken);
        stored.ByteSize.ShouldBe(bytes.Length);
        stored.Sha256.ShouldBe(Sha(bytes));

        await using var stream = await storage.OpenReadAsync(stored.StorageKey, TestContext.Current.CancellationToken);
        var read = new MemoryStream();
        await stream.CopyToAsync(read, TestContext.Current.CancellationToken);
        Sha(read.ToArray()).ShouldBe(stored.Sha256);
    }

    private sealed class ForwardOnlyStream(byte[] data) : Stream
    {
        private int _position;
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override int Read(byte[] buffer, int offset, int count)
        {
            var n = Math.Min(count, Math.Min(data.Length - _position, 65_536));
            Array.Copy(data, _position, buffer, offset, n);
            _position += n;
            return n;
        }
        public override void Flush() { }
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }

    [Fact]
    public async Task Thieu_tep_thi_FileNotFoundException_Exists_false_Delete_false_va_xoa_that_thi_true()
    {
        RequireS3();
        using var storage = Storage();
        var absent = $"blobs/ab/cd/{new string('a', 64)}";
        await Should.ThrowAsync<FileNotFoundException>(() => storage.OpenReadAsync(absent, TestContext.Current.CancellationToken));
        (await storage.ExistsAsync(absent, TestContext.Current.CancellationToken)).ShouldBeFalse();
        (await storage.DeleteAsync(absent, TestContext.Current.CancellationToken)).ShouldBeFalse();

        var stored = await storage.SaveAsync(new MemoryStream(RandomBytes(1000)), TestContext.Current.CancellationToken);
        (await storage.ExistsAsync(stored.StorageKey, TestContext.Current.CancellationToken)).ShouldBeTrue();
        (await storage.DeleteAsync(stored.StorageKey, TestContext.Current.CancellationToken)).ShouldBeTrue();
        (await storage.ExistsAsync(stored.StorageKey, TestContext.Current.CancellationToken)).ShouldBeFalse();
        (await storage.DeleteAsync(stored.StorageKey, TestContext.Current.CancellationToken)).ShouldBeFalse("xóa lần hai: không còn gì");

        // Xóa rồi ghi lại cùng nội dung: ghi mới được, không bị coi là đã có.
        var again = await storage.SaveAsync(new MemoryStream(RandomBytes(1000)), TestContext.Current.CancellationToken);
        again.AlreadyExisted.ShouldBeFalse();
    }

    [Theory]
    [InlineData("../../etc/passwd")]
    [InlineData("blobs/../../secret")]
    [InlineData("blobs/ab/cd/short")]
    [InlineData("tmp/abc.part")]
    [InlineData("health/probe")]
    [InlineData("")]
    public async Task Khoa_la_bi_tu_choi_o_moi_thao_tac(string key)
    {
        RequireS3();
        using var storage = Storage();
        await Should.ThrowAsync<ArgumentException>(() => storage.OpenReadAsync(key, TestContext.Current.CancellationToken));
        await Should.ThrowAsync<ArgumentException>(() => storage.ExistsAsync(key, TestContext.Current.CancellationToken));
        await Should.ThrowAsync<ArgumentException>(() => storage.DeleteAsync(key, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Tien_to_duoc_ap_dung_va_hai_he_thong_dung_chung_bucket_khong_thay_nhau()
    {
        RequireS3();
        using var a = Storage("he-thong-a");
        using var b = Storage("he-thong-b/");
        var stored = await a.SaveAsync(new MemoryStream(RandomBytes(4000)), TestContext.Current.CancellationToken);

        (await _raw!.GetObjectMetadataAsync(_bucket, "he-thong-a/" + stored.StorageKey, TestContext.Current.CancellationToken)).ContentLength.ShouldBe(4000);
        (await a.ExistsAsync(stored.StorageKey, TestContext.Current.CancellationToken)).ShouldBeTrue();
        (await b.ExistsAsync(stored.StorageKey, TestContext.Current.CancellationToken)).ShouldBeFalse("tiền tố khác là kho khác");
    }

    [Fact]
    public async Task Kiem_tra_ghi_duoc_khong_de_lai_doi_tuong_va_bao_loi_khi_bucket_khong_co()
    {
        RequireS3();
        using var storage = Storage();
        await storage.ProbeAsync(TestContext.Current.CancellationToken);
        var left = await _raw!.ListObjectsV2Async(new ListObjectsV2Request { BucketName = _bucket, Prefix = "health/" }, TestContext.Current.CancellationToken);
        (left.S3Objects ?? []).ShouldBeEmpty();

        using var broken = new S3FileStorage(Options.Create(new StorageOptions
        {
            Root = _temp, Provider = "S3",
            S3 = new S3Options { ServiceUrl = ServiceUrl, Bucket = "bucket-khong-ton-tai-" + Guid.NewGuid().ToString("N")[..8], AccessKey = Access, SecretKey = Secret },
        }), new TestEnvironment(_temp));
        await Should.ThrowAsync<AmazonS3Exception>(() => broken.ProbeAsync(TestContext.Current.CancellationToken));
    }
}

/// <summary>BE-21: chạy cả API trên kho S3 (đặt Storage:Provider=S3): tải PDF lên, tải xuống có Range, gói xuất, sức khỏe.</summary>
public sealed class S3EndToEndTests : IClassFixture<S3EndToEndTests.S3Factory>, IAsyncLifetime
{
    private static readonly string? ServiceUrl = Environment.GetEnvironmentVariable("HOSO_TEST_S3_URL");
    private static readonly string Access = Environment.GetEnvironmentVariable("HOSO_TEST_S3_ACCESS") ?? "test";
    private static readonly string Secret = Environment.GetEnvironmentVariable("HOSO_TEST_S3_SECRET") ?? "test";
    private static readonly string Bucket = "hoso-e2e-" + Guid.NewGuid().ToString("N")[..12];

    public sealed class S3Factory : DbApiFactory
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            if (ServiceUrl is null) return;
            builder.UseSetting("Storage:Provider", "S3");
            builder.UseSetting("Storage:S3:ServiceUrl", ServiceUrl);
            builder.UseSetting("Storage:S3:Bucket", Bucket);
            builder.UseSetting("Storage:S3:AccessKey", Access);
            builder.UseSetting("Storage:S3:SecretKey", Secret);
        }
    }

    private readonly S3Factory _api;
    private AmazonS3Client? _raw;

    public S3EndToEndTests(S3Factory api) => _api = api;

    public async ValueTask InitializeAsync()
    {
        if (ServiceUrl is null) return;
        _raw = new AmazonS3Client(new BasicAWSCredentials(Access, Secret), new AmazonS3Config { ServiceURL = ServiceUrl, ForcePathStyle = true, AuthenticationRegion = "us-east-1" });
        if (!((await _raw.ListBucketsAsync()).Buckets ?? []).Any(b => b.BucketName == Bucket)) await _raw.PutBucketAsync(Bucket);
    }

    public async ValueTask DisposeAsync()
    {
        if (_raw is null) return;
        var listed = await _raw.ListObjectsV2Async(new ListObjectsV2Request { BucketName = Bucket });
        foreach (var o in listed.S3Objects ?? []) await _raw.DeleteObjectAsync(Bucket, o.Key);
        _raw.Dispose();
    }

    [Fact]
    public async Task API_chay_tren_S3_tai_len_roi_tai_xuong_ca_tep_va_theo_khoang_va_khong_ghi_blob_xuong_o_dia()
    {
        Assert.SkipUnless(ServiceUrl is not null, "Đặt HOSO_TEST_S3_URL để chạy test API trên kho S3.");
        var http = await _api.LoginAsync("demo_cv_ht");
        var body = new byte[600_000];
        new Random(7).NextBytes(body);
        System.Text.Encoding.ASCII.GetBytes("%PDF-1.4\n").CopyTo(body, 0);       // đủ để qua kiểm tra đầu tệp
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(body);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", "tren-s3.pdf");
        var upload = await (await http.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();

        // Nằm trong bucket, đúng khóa theo mã băm, không nằm trên ổ đĩa.
        var sha = Convert.ToHexStringLower(SHA256.HashData(body));
        (await _raw!.GetObjectMetadataAsync(Bucket, $"blobs/{sha[..2]}/{sha[2..4]}/{sha}", TestContext.Current.CancellationToken)).ContentLength.ShouldBe(body.Length);
        Directory.Exists(Path.Combine(_api.StorageRoot, "blobs")).ShouldBeFalse("khi dùng S3, blob không được ghi xuống ổ đĩa");

        var whole = await http.GetAsync($"/api/v1/files/{upload.FileId}/content");
        whole.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await whole.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken)).ShouldBe(body);

        var request = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/files/{upload.FileId}/content");
        request.Headers.Range = new RangeHeaderValue(123_456, 123_555);
        var part = await http.SendAsync(request, TestContext.Current.CancellationToken);
        part.StatusCode.ShouldBe(HttpStatusCode.PartialContent);
        part.Content.Headers.ContentRange!.ToString().ShouldBe($"bytes 123456-123555/{body.Length}");
        (await part.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken)).ShouldBe(body[123_456..123_556]);

        // Tải lại cùng nội dung: bị chặn như khi dùng ổ đĩa (409 duplicate_file), không ghi đè.
        var again = new MultipartFormDataContent { { new ByteArrayContent(body) { Headers = { ContentType = new MediaTypeHeaderValue("application/pdf") } }, "file", "lan-hai.pdf" } };
        var duplicate = await http.PostAsync("/api/v1/intake/files", again, TestContext.Current.CancellationToken);
        duplicate.StatusCode.ShouldBe(HttpStatusCode.Conflict);

        // Sức khỏe: kho S3 ghi được.
        (await _api.CreateClient().GetAsync("/health/ready", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Goi_xuat_tren_S3_dong_goi_tu_kho_S3_tai_ve_day_du_va_theo_Range_va_het_han_thi_xoa_khoi_bucket()
    {
        Assert.SkipUnless(ServiceUrl is not null, "Đặt HOSO_TEST_S3_URL để chạy test API trên kho S3.");
        var clerk = await _api.LoginAsync("demo_clerk_ubnd");
        var pdf = System.Text.Encoding.ASCII.GetBytes($"%PDF-1.4\n% {Guid.NewGuid():N}\ntrailer<<>>\n%%EOF\n");
        var dossier = await (await clerk.PostJsonAsync("/api/v1/dossiers", new { title = "Hồ sơ xuất trên kho S3", workGroupCode = "U15" })).ReadAsync<DossierDetailDto>();
        var form = new MultipartFormDataContent { { new ByteArrayContent(pdf) { Headers = { ContentType = new MediaTypeHeaderValue("application/pdf") } }, "file", "van-ban.pdf" } };
        var upload = await (await clerk.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();
        (await clerk.PostJsonAsync($"/api/v1/dossiers/{dossier.Id}/documents", new { documentId = upload.DocumentId })).StatusCode.ShouldBe(HttpStatusCode.OK);

        var created = await (await clerk.PostJsonAsync("/api/v1/exports", new { dossierIds = new[] { dossier.Id } })).ReadAsync<ExportDto>();
        var ready = await Eventually.ForAsync(async () => await (await clerk.GetAsync($"/api/v1/exports/{created.Id}")).ReadAsync<ExportDto>(),
            e => e.Status is "ready" or "failed", TimeSpan.FromSeconds(30));
        ready.Status.ShouldBe("ready", ready.Error);

        // ZIP nằm trong bucket (khóa theo mã băm của chính gói), không nằm trên ổ đĩa.
        var key = (await _api.ScalarAsync<string>("SELECT storage_key FROM hoso.export_packages WHERE id = $1", created.Id))!;
        (await _raw!.GetObjectMetadataAsync(Bucket, key, TestContext.Current.CancellationToken)).ContentLength.ShouldBe(ready.ByteSize!.Value);
        Directory.Exists(Path.Combine(_api.StorageRoot, "blobs")).ShouldBeFalse();

        var whole = await clerk.GetAsync($"/api/v1/exports/{created.Id}/file");
        whole.StatusCode.ShouldBe(HttpStatusCode.OK);
        var zipBytes = await whole.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        zipBytes.Length.ShouldBe((int)ready.ByteSize!.Value);
        using (var zip = new System.IO.Compression.ZipArchive(new MemoryStream(zipBytes)))
        {
            using var entry = zip.Entries.Single(e => e.FullName.EndsWith(".pdf")).Open();
            using var copy = new MemoryStream();
            await entry.CopyToAsync(copy, TestContext.Current.CancellationToken);
            copy.ToArray().ShouldBe(pdf, "PDF trong gói được đọc từ kho S3 và giống hệt tệp đã nộp");
        }

        var request = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/exports/{created.Id}/file");
        request.Headers.Range = new RangeHeaderValue(10, 99);
        var part = await clerk.SendAsync(request, TestContext.Current.CancellationToken);
        part.StatusCode.ShouldBe(HttpStatusCode.PartialContent);
        (await part.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken)).ShouldBe(zipBytes[10..100]);

        // Hết hạn: nội dung bị xóa khỏi bucket.
        await _api.ExecuteAsync("UPDATE hoso.export_packages SET expires_at = now() - interval '1 minute' WHERE id = $1", created.Id);
        var worker = _api.Services.GetServices<Microsoft.Extensions.Hosting.IHostedService>().OfType<HoSoSo.Infrastructure.Messaging.ExportWorker>().Single();
        (await worker.ExpireAsync(TestContext.Current.CancellationToken)).ShouldBeGreaterThanOrEqualTo(1);
        var gone = await Should.ThrowAsync<AmazonS3Exception>(() => _raw.GetObjectMetadataAsync(Bucket, key, TestContext.Current.CancellationToken));
        gone.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    private sealed record ExportDto(Guid Id, string Status, long? ByteSize, string? Error);

    [Fact]
    public async Task Bucket_khong_ton_tai_thi_health_ready_bao_503()
    {
        Assert.SkipUnless(ServiceUrl is not null, "Đặt HOSO_TEST_S3_URL để chạy test API trên kho S3.");
        _api.RequireDatabase();
        await using var broken = _api.WithWebHostBuilder(b => b.UseSetting("Storage:S3:Bucket", "khong-co-" + Guid.NewGuid().ToString("N")[..8]));
        (await broken.CreateClient().GetAsync("/health/ready", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable);
    }
}
