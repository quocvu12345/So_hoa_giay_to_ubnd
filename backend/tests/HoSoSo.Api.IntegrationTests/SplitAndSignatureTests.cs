using System.Net;
using System.Net.Http.Headers;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Application.Documents;
using HoSoSo.Application.Intake;
using Microsoft.Extensions.DependencyInjection;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-51, BE-54: tách PDF nhiều văn bản bằng PDF thật trong database/samples; đọc chữ ký số.</summary>
public sealed class SplitAndSignatureTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private static readonly string Samples = Path.GetFullPath(Path.Combine(TestDatabase.MigrationsPath, "..", "..", "..", "database", "samples"));
    private sealed record Segment(Guid Id, int PageFrom, int PageTo, string Status, Guid? TargetDocumentId);
    private sealed record SegmentList(Guid FileId, int PageCount, List<Segment> Segments);
    private sealed record Child(Guid DocumentId, Guid FileId, Guid JobId, int PageFrom, int PageTo, string Title);
    private sealed record Split(Guid SourceDocumentId, List<Child> Children);
    private sealed record Signature(string? SignerName, string? CertificateSerial, string Status, JsonDetails Details);
    private sealed record JsonDetails(string? Trust, string? Revocation, string? Error);

    private static async Task<UploadDto> UploadSampleAsync(HttpClient http, string name)
    {
        var form = new MultipartFormDataContent();
        var content = new ByteArrayContent(await File.ReadAllBytesAsync(Path.Combine(Samples, name), TestContext.Current.CancellationToken));
        content.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(content, "file", name);
        return await (await http.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();
    }

    [Fact]
    public async Task Tach_PDF_8_trang_thanh_3_van_ban_moi_phan_la_tep_cat_that_cung_hang_doi_AI()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var up = await UploadSampleAsync(http, "public-019.pdf");
        var list = await (await http.GetAsync($"/api/v1/documents/{up.DocumentId}/segments")).ReadAsync<SegmentList>();
        list.PageCount.ShouldBe(8);

        // Các lỗi dải trang: chồng, hở, thiếu, quá, chỉ một phần.
        foreach (var bad in new[]
        {
            new[] { (1, 3), (3, 8) }, new[] { (1, 2), (4, 8) }, new[] { (1, 2), (3, 6) }, new[] { (1, 4), (5, 9) },
            new[] { (2, 4), (5, 8) }, new[] { (1, 8) },
        })
        {
            var response = await http.PostJsonAsync($"/api/v1/documents/{up.DocumentId}/segments", new { segments = bad.Select(b => new { pageFrom = b.Item1, pageTo = b.Item2 }) });
            response.StatusCode.ShouldBe(HttpStatusCode.BadRequest, string.Join(",", bad));
        }

        var proposed = await (await http.PostJsonAsync($"/api/v1/documents/{up.DocumentId}/segments",
            new { segments = new[] { new { pageFrom = 1, pageTo = 2 }, new { pageFrom = 3, pageTo = 5 }, new { pageFrom = 6, pageTo = 8 } } })).ReadAsync<SegmentList>();
        proposed.Segments.Select(s => (s.PageFrom, s.PageTo, s.Status)).ShouldBe([(1, 2, "proposed"), (3, 5, "proposed"), (6, 8, "proposed")]);

        // Người khác không tách được PDF của tôi.
        var other = await api.LoginAsync("demo_cv_kt");
        (await other.PostJsonAsync($"/api/v1/segments/{proposed.Segments[0].Id}/confirm")).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        var titles = new Dictionary<Guid, string> { [proposed.Segments[0].Id] = "Đơn đề nghị" };
        var result = await (await http.PostJsonAsync($"/api/v1/segments/{proposed.Segments[1].Id}/confirm", new { titles })).ReadAsync<Split>();
        result.Children.Count.ShouldBe(3);
        result.Children.Select(c => c.PageTo - c.PageFrom + 1).Sum().ShouldBe(8, "tổng số trang các phần bằng số trang tệp gốc");
        result.Children[0].Title.ShouldBe("Đơn đề nghị");
        result.Children[1].Title.ShouldContain("trang 3–5");

        // Mỗi phần là một PDF thật có đúng số trang, mở được bằng PdfPig (cũng đã được pdfium kiểm độc lập).
        var storage = api.Services.GetRequiredService<IFileStorage>();
        var pdf = api.Services.GetRequiredService<IPdfTools>();
        foreach (var child in result.Children)
        {
            var key = await api.ScalarAsync<string>("SELECT storage_key FROM hoso.files WHERE id = $1", child.FileId);
            await using var stream = await storage.OpenReadAsync(key!, TestContext.Current.CancellationToken);
            using var buffer = new MemoryStream();
            await stream.CopyToAsync(buffer, TestContext.Current.CancellationToken);
            buffer.Position = 0;
            pdf.CountPages(buffer).ShouldBe(child.PageTo - child.PageFrom + 1);
            // Tùy chọn: xuất tệp đã cắt để kiểm độc lập bằng thư viện khác (pdfium).
            if (Environment.GetEnvironmentVariable("HOSO_TEST_DUMP_DIR") is { Length: > 0 } dump)
                await File.WriteAllBytesAsync(Path.Combine(dump, $"tr{child.PageFrom}-{child.PageTo}.pdf"), buffer.ToArray(), TestContext.Current.CancellationToken);
            (await api.ScalarAsync<int>("SELECT page_count FROM hoso.files WHERE id = $1", child.FileId)).ShouldBe(child.PageTo - child.PageFrom + 1);
            (await api.ScalarAsync<string>("SELECT status FROM hoso.ocr_jobs WHERE id = $1", child.JobId)).ShouldBe("queued");
            (await api.ScalarAsync<string>("SELECT intake_status FROM hoso.documents WHERE id = $1", child.DocumentId)).ShouldBe("inbox");
        }
        (await api.ScalarAsync<string>("SELECT intake_status FROM hoso.documents WHERE id = $1", up.DocumentId)).ShouldBe("split");
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.document_segments WHERE source_document_id = $1 AND status = 'confirmed' AND target_document_id IS NOT NULL", up.DocumentId)).ShouldBe(3);
        // Tệp gốc nguyên vẹn.
        (await api.ScalarAsync<string>("SELECT sha256 FROM hoso.files WHERE id = $1", up.FileId)).ShouldBe(Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(await File.ReadAllBytesAsync(Path.Combine(Samples, "public-019.pdf"), TestContext.Current.CancellationToken))));

        var inbox = await (await http.GetAsync("/api/v1/intake/inbox")).ReadAsync<List<InboxDto>>();
        inbox.Count(i => result.Children.Any(c => c.DocumentId == i.DocumentId)).ShouldBe(3);
        inbox.ShouldNotContain(i => i.DocumentId == up.DocumentId);

        var again = await http.PostJsonAsync($"/api/v1/segments/{proposed.Segments[0].Id}/confirm");
        again.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await http.PostJsonAsync($"/api/v1/documents/{up.DocumentId}/segments", new { segments = new[] { new { pageFrom = 1, pageTo = 4 }, new { pageFrom = 5, pageTo = 8 } } })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Tep_khong_phai_PDF_doc_duoc_thi_bao_422_khong_tao_gi()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var form = new MultipartFormDataContent();
        var content = new ByteArrayContent("%PDF-1.4\nđây chỉ có đầu tệp, không có cấu trúc\n"u8.ToArray());
        content.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(content, "file", "hong.pdf");
        var up = await (await http.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();
        var response = await http.GetAsync($"/api/v1/documents/{up.DocumentId}/segments");
        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await response.ProblemCodeAsync()).ShouldBe("pdf_unreadable");
    }

    [Fact]
    public async Task Doc_chu_ky_so_trong_PDF_mau_va_noi_ro_chua_kiem_chuoi_tin_cay()
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var signed = await UploadSampleAsync(http, "public-016.pdf");
        var results = await (await http.PostJsonAsync($"/api/v1/files/{signed.FileId}/signatures/verify")).ReadAsync<List<Signature>>();
        results.Count.ShouldBe(1, "public-016.pdf có một chữ ký (ByteRange)");
        var signature = results[0];
        signature.Status.ShouldBe("valid", "mã băm và chữ ký toán học của PDF mẫu phải khớp");
        signature.SignerName.ShouldBe("HỘI ĐỒNG NHÂN DÂN PHƯỜNG TỪ LIÊM");
        signature.CertificateSerial.ShouldBe("262A5667A181730E");
        signature.Details.Trust.ShouldBe("not_evaluated");
        signature.Details.Revocation.ShouldBe("not_checked");

        // Lưu và đọc lại; kiểm lại thì thay thế, không nhân đôi.
        (await (await http.GetAsync($"/api/v1/files/{signed.FileId}/signatures")).ReadAsync<List<Signature>>()).Count.ShouldBe(1);
        await http.PostJsonAsync($"/api/v1/files/{signed.FileId}/signatures/verify");
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.file_signatures WHERE file_id = $1", signed.FileId)).ShouldBe(1);

        var unsigned = await UploadSampleAsync(http, "public-002.pdf");
        (await (await http.PostJsonAsync($"/api/v1/files/{unsigned.FileId}/signatures/verify")).ReadAsync<List<Signature>>()).ShouldBeEmpty();
        var other = await api.LoginAsync("demo_cv_kt");
        (await other.PostJsonAsync($"/api/v1/files/{signed.FileId}/signatures/verify")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }
}
