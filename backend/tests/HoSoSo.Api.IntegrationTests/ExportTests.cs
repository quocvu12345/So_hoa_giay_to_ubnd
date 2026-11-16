using System.IO.Compression;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Infrastructure.Messaging;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-86: gói xuất ZIP chạy nền, manifest kiểm được bằng sha256sum, tiến độ qua SSE, hết hạn, lỗi toàn vẹn.</summary>
public sealed class ExportTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record Export(Guid Id, string Status, string Format, int TotalItems, int ProcessedItems, long? ByteSize, string? ManifestSha256, DateTimeOffset? ExpiresAt, string? Error);

    private static byte[] Pdf(string marker) => Encoding.ASCII.GetBytes($"%PDF-1.4\n% {marker}\ntrailer<<>>\n%%EOF\n");

    private async Task<(DossierDetailDto Dossier, byte[] Content, Guid FileId)> DossierWithPdfAsync(HttpClient http, string title)
    {
        var d = await (await http.PostJsonAsync("/api/v1/dossiers", new { title, workGroupCode = "U15" })).ReadAsync<DossierDetailDto>();
        var content = Pdf(Guid.NewGuid().ToString("N"));
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(content);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", "Giấy phép xây dựng số 12.pdf");
        var up = await (await http.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();
        (await http.PostJsonAsync($"/api/v1/dossiers/{d.Id}/documents", new { documentId = up.DocumentId })).StatusCode.ShouldBe(HttpStatusCode.OK);
        return (d, content, up.FileId);
    }

    private async Task<Export> WaitAsync(HttpClient http, Guid id, params string[] done) =>
        await Eventually.ForAsync(async () => await (await http.GetAsync($"/api/v1/exports/{id}")).ReadAsync<Export>(), e => done.Contains(e.Status), TimeSpan.FromSeconds(30));

    [Fact]
    public async Task Xuat_goi_dong_zip_nen_co_manifest_dung_tung_tep_bao_tien_do_qua_sse_va_ghi_nhat_ky_xuat()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var (dossier, content, _) = await DossierWithPdfAsync(clerk, "Hồ sơ xuất bàn giao");
        // Thêm một giấy tờ công khai chỉ có siêu dữ liệu: gói vẫn ghi nhận nhưng nói rõ không có tệp.
        var publicDoc = await api.ScalarAsync<Guid>("SELECT id FROM hoso.documents WHERE external_key = 'public-003'");
        await clerk.PostJsonAsync($"/api/v1/dossiers/{dossier.Id}/documents", new { documentId = publicDoc });

        await using var sse = await SseClient.ConnectAsync(clerk);
        var created = await clerk.PostJsonAsync("/api/v1/exports", new { dossierIds = new[] { dossier.Id } });
        created.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        var queued = await created.ReadAsync<Export>();
        queued.TotalItems.ShouldBe(1);

        var ready = await WaitAsync(clerk, queued.Id, "ready", "failed");
        ready.Status.ShouldBe("ready", ready.Error);
        ready.ProcessedItems.ShouldBe(1);
        ready.ManifestSha256!.ShouldMatch("^[0-9a-f]{64}$");
        ready.ExpiresAt.ShouldNotBeNull();
        (ready.ExpiresAt!.Value - DateTimeOffset.UtcNow).TotalDays.ShouldBeInRange(6.9, 7.1);
        (await sse.WaitForAsync("export.ready", TimeSpan.FromSeconds(10), e => e.Data.Contains(queued.Id.ToString()))).Data.ShouldContain("\"status\":\"ready\"");

        // Người khác không thấy sự kiện, không xem được gói, không tải được.
        var other = await api.LoginAsync("demo_clerk_hdnd");
        (await other.GetAsync($"/api/v1/exports/{queued.Id}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await other.GetAsync($"/api/v1/exports/{queued.Id}/file")).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        var response = await clerk.GetAsync($"/api/v1/exports/{queued.Id}/file");
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.ShouldBe("application/zip");
        var zipBytes = await response.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        ((long?)zipBytes.Length).ShouldBe(ready.ByteSize);

        if (Environment.GetEnvironmentVariable("HOSO_TEST_DUMP_DIR") is { Length: > 0 } dump)   // để kiểm độc lập bằng unzip và sha256sum thật
        {
            Directory.CreateDirectory(dump);
            await File.WriteAllBytesAsync(Path.Combine(dump, "goi-xuat.zip"), zipBytes, TestContext.Current.CancellationToken);
        }
        using var zip = new ZipArchive(new MemoryStream(zipBytes), ZipArchiveMode.Read);
        var names = zip.Entries.Select(e => e.FullName).ToList();
        names.ShouldContain("metadata.json");
        names.ShouldContain("danh-muc.csv");
        names.ShouldContain("manifest.sha256");
        var pdfEntry = names.Single(n => n.EndsWith(".pdf"));
        pdfEntry.ShouldBe($"{dossier.Code}/01-giay-phep-xay-dung-so-12.pdf", "tên tệp không dấu, thư mục theo mã hồ sơ, số thứ tự giấy tờ");

        byte[] Read(string name) { using var s = zip.GetEntry(name)!.Open(); using var m = new MemoryStream(); s.CopyTo(m); return m.ToArray(); }
        Read(pdfEntry).ShouldBe(content, "tệp trong gói giống hệt tệp đã nộp");

        // Mô phỏng `sha256sum -c manifest.sha256`: mọi dòng đều khớp, và không sót tệp nào.
        var manifest = Encoding.UTF8.GetString(Read("manifest.sha256"));
        var lines = manifest.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        foreach (var line in lines)
        {
            var parts = line.Split("  ", 2);
            Convert.ToHexStringLower(SHA256.HashData(Read(parts[1]))).ShouldBe(parts[0], parts[1]);
        }
        lines.Select(l => l.Split("  ", 2)[1]).Order(StringComparer.Ordinal).ShouldBe(names.Where(n => n != "manifest.sha256").Order(StringComparer.Ordinal));
        Convert.ToHexStringLower(SHA256.HashData(Read("manifest.sha256"))).ShouldBe(ready.ManifestSha256);

        using var meta = JsonDocument.Parse(Read("metadata.json"));
        var docs = meta.RootElement.GetProperty("dossiers")[0].GetProperty("documents");
        docs.GetArrayLength().ShouldBe(2);
        docs.EnumerateArray().Count(d => d.GetProperty("file").ValueKind == JsonValueKind.String).ShouldBe(1);
        docs.EnumerateArray().Single(d => d.GetProperty("file").ValueKind == JsonValueKind.Null).GetProperty("note").GetString()!.ShouldContain("Chỉ có siêu dữ liệu");

        var csv = Read("danh-muc.csv");
        csv.Take(3).ShouldBe([0xEF, 0xBB, 0xBF], "BOM để Excel mở đúng tiếng Việt");
        var csvText = Encoding.UTF8.GetString(csv);
        csvText.ShouldContain("Mã hồ sơ,Tên hồ sơ");
        csvText.ShouldContain(dossier.Code);
        csvText.ShouldContain("Hồ sơ xuất bàn giao");

        // Nhật ký: yêu cầu và tải đều ghi "export".
        var logged = await Eventually.ForAsync(
            async () => await api.ScalarAsync<long>("SELECT count(*) FROM hoso.access_events WHERE action = 'export' AND object_id = $1", queued.Id), n => n >= 2);
        logged.ShouldBeGreaterThanOrEqualTo(2);
    }

    [Fact]
    public async Task Pham_vi_va_quyen_xuat_chi_ho_so_trong_pham_vi_va_dieu_kien_hop_le()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var (dossier, _, _) = await DossierWithPdfAsync(await api.LoginAsync("demo_cv_ht"), "Hồ sơ của chuyên viên");

        (await (await api.LoginAsync("demo_cv_ht")).PostJsonAsync("/api/v1/exports", new { dossierIds = new[] { dossier.Id } })).StatusCode.ShouldBe(HttpStatusCode.Forbidden);   // không có quyền xuất
        (await clerk.PostJsonAsync("/api/v1/exports", new { })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);                                      // không chọn gì
        (await clerk.PostJsonAsync("/api/v1/exports", new { dossierIds = new[] { dossier.Id }, format = "rar" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await clerk.PostJsonAsync("/api/v1/exports", new { dossierIds = new[] { Guid.NewGuid() } })).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var empty = await clerk.PostJsonAsync("/api/v1/exports", new { status = "archived", archivedFrom = "2000-01-01", archivedTo = "2000-12-31" });
        empty.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await empty.ProblemCodeAsync()).ShouldBe("export_empty");

        // Văn thư HĐND không xuất được hồ sơ của UBND dù biết mã.
        var hdnd = await api.LoginAsync("demo_clerk_hdnd");
        (await hdnd.PostJsonAsync("/api/v1/exports", new { dossierIds = new[] { dossier.Id } })).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        // Lọc theo điều kiện chỉ lấy hồ sơ trong phạm vi và khớp; định dạng không JSON thì không có metadata.json.
        var export = await (await clerk.PostJsonAsync("/api/v1/exports", new { workGroupCode = "U15", status = "draft", format = "zip_pdf_csv" })).ReadAsync<Export>();
        export.TotalItems.ShouldBeGreaterThanOrEqualTo(1);
        var ready = await WaitAsync(clerk, export.Id, "ready", "failed");
        ready.Status.ShouldBe("ready", ready.Error);
        using var zip = new ZipArchive(new MemoryStream(await (await clerk.GetAsync($"/api/v1/exports/{export.Id}/file")).Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken)));
        zip.GetEntry("metadata.json").ShouldBeNull();
        zip.GetEntry("danh-muc.csv").ShouldNotBeNull();
        (await (await clerk.GetAsync("/api/v1/exports")).ReadAsync<List<Export>>()).ShouldContain(e => e.Id == export.Id);
    }

    [Fact]
    public async Task Tep_hong_hoac_mat_tren_kho_thi_goi_bao_loi_ro_rang_khong_giao_goi_thieu()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var cv = await api.LoginAsync("demo_cv_ht");

        // Tệp bị sửa nội dung sau khi tiếp nhận.
        var (tampered, _, tamperedFile) = await DossierWithPdfAsync(cv, "Hồ sơ có tệp bị sửa");
        var key = await api.ScalarAsync<string>("SELECT storage_key FROM hoso.files WHERE id = $1", tamperedFile);
        await File.WriteAllBytesAsync(Path.Combine(api.StorageRoot, key!), Encoding.ASCII.GetBytes("nội dung đã bị thay đổi"), TestContext.Current.CancellationToken);
        var failed = await WaitAsync(clerk, (await (await clerk.PostJsonAsync("/api/v1/exports", new { dossierIds = new[] { tampered.Id } })).ReadAsync<Export>()).Id, "failed", "ready");
        failed.Status.ShouldBe("failed");
        failed.Error!.ShouldContain("không khớp mã băm");
        (await clerk.GetAsync($"/api/v1/exports/{failed.Id}/file")).StatusCode.ShouldBe(HttpStatusCode.Conflict);

        // Tệp mất khỏi kho.
        var (missing, _, missingFile) = await DossierWithPdfAsync(cv, "Hồ sơ có tệp mất");
        File.Delete(Path.Combine(api.StorageRoot, (await api.ScalarAsync<string>("SELECT storage_key FROM hoso.files WHERE id = $1", missingFile))!));
        var lost = await WaitAsync(clerk, (await (await clerk.PostJsonAsync("/api/v1/exports", new { dossierIds = new[] { missing.Id } })).ReadAsync<Export>()).Id, "failed", "ready");
        lost.Status.ShouldBe("failed");
        lost.Error!.ShouldContain("Thiếu nội dung tệp");
        Directory.GetFiles(Path.Combine(api.StorageRoot, "tmp"), "export-*.part").ShouldBeEmpty("tệp tạm được dọn sau khi lỗi");
    }

    [Fact]
    public async Task Goi_het_han_bi_xoa_noi_dung_tra_410_va_viec_treo_duoc_xep_lai_hang_doi()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var (dossier, _, _) = await DossierWithPdfAsync(await api.LoginAsync("demo_cv_ht"), "Hồ sơ gói hết hạn");
        var export = await WaitAsync(clerk, (await (await clerk.PostJsonAsync("/api/v1/exports", new { dossierIds = new[] { dossier.Id } })).ReadAsync<Export>()).Id, "ready", "failed");
        export.Status.ShouldBe("ready", export.Error);
        var key = await api.ScalarAsync<string>("SELECT storage_key FROM hoso.export_packages WHERE id = $1", export.Id);
        File.Exists(Path.Combine(api.StorageRoot, key!)).ShouldBeTrue();

        var worker = api.Services.GetServices<IHostedService>().OfType<ExportWorker>().Single();
        await api.ExecuteAsync("UPDATE hoso.export_packages SET expires_at = now() - interval '1 minute' WHERE id = $1", export.Id);
        (await clerk.GetAsync($"/api/v1/exports/{export.Id}/file")).StatusCode.ShouldBe(HttpStatusCode.Gone);   // quá hạn là không tải được, kể cả trước khi dọn
        (await worker.ExpireAsync(TestContext.Current.CancellationToken)).ShouldBeGreaterThanOrEqualTo(1);
        (await api.ScalarAsync<string>("SELECT status FROM hoso.export_packages WHERE id = $1", export.Id)).ShouldBe("expired");
        File.Exists(Path.Combine(api.StorageRoot, key!)).ShouldBeFalse("nội dung gói hết hạn bị xóa");
        var gone = await clerk.GetAsync($"/api/v1/exports/{export.Id}/file");
        gone.StatusCode.ShouldBe(HttpStatusCode.Gone);
        (await gone.ProblemCodeAsync()).ShouldBe("export_expired");

        // Việc "running" đã mất nhịp sống 1 giờ: xếp lại hàng đợi và được đóng gói tiếp.
        var stuck = await (await clerk.PostJsonAsync("/api/v1/exports", new { dossierIds = new[] { dossier.Id } })).ReadAsync<Export>();
        await WaitAsync(clerk, stuck.Id, "ready", "failed");
        await api.ExecuteAsync("UPDATE hoso.export_packages SET status = 'running', heartbeat_at = now() - interval '1 hour', started_at = now() - interval '1 hour', storage_key = NULL, ready_at = NULL, expires_at = NULL, manifest_sha256 = NULL, byte_size = NULL WHERE id = $1", stuck.Id);
        (await worker.RequeueStaleAsync(TestContext.Current.CancellationToken)).ShouldBeGreaterThanOrEqualTo(1);
        (await WaitAsync(clerk, stuck.Id, "ready", "failed")).Status.ShouldBe("ready");
    }

    [Fact]
    public void Ten_tep_trong_goi_khong_dau_on_dinh_va_gioi_han_do_dai()
    {
        ExportWorker.Slug("Giấy phép xây dựng số 12/GP-UBND").ShouldBe("giay-phep-xay-dung-so-12-gp-ubnd");
        ExportWorker.Slug("Đơn đề nghị cấp đổi").ShouldBe("don-de-nghi-cap-doi");
        ExportWorker.Slug("   ///   ").ShouldBe("giay-to");
        ExportWorker.Slug(new string('a', 200)).Length.ShouldBe(60);
    }
}
