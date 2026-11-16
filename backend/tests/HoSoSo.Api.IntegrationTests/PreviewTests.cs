using System.Net;
using System.Net.Http.Headers;
using System.Text;
using HoSoSo.Api.IntegrationTests.Support;
using SkiaSharp;
using UglyToad.PdfPig.Content;
using UglyToad.PdfPig.Fonts.Standard14Fonts;
using UglyToad.PdfPig.Writer;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-43: ảnh xem trước một trang PDF (WebP), cache bản 800 px, kiểm phạm vi và lỗi.</summary>
public sealed class PreviewTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    /// <summary>PDF thật hai trang, trang 1 có chữ đen trên nền trắng.</summary>
    private static byte[] TwoPagePdf()
    {
        var builder = new PdfDocumentBuilder();
        var font = builder.AddStandard14Font(Standard14Font.Helvetica);
        for (var i = 1; i <= 2; i++)
        {
            var page = builder.AddPage(PageSize.A4);
            page.AddText($"Preview page {i}", 36, new UglyToad.PdfPig.Core.PdfPoint(60, 700), font);
        }
        return builder.Build();
    }

    private static async Task<UploadDto> UploadAsync(HttpClient http, byte[] content, string name)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(content);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", name);
        return await (await http.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();
    }

    private static async Task<(SKBitmap Bitmap, byte[] Bytes)> DecodeAsync(HttpResponseMessage response)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.ShouldBe("image/webp");
        var bytes = await response.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        Encoding.ASCII.GetString(bytes, 0, 4).ShouldBe("RIFF");
        Encoding.ASCII.GetString(bytes, 8, 4).ShouldBe("WEBP");
        return (SKBitmap.Decode(bytes), bytes);
    }

    [Fact]
    public async Task Xem_truoc_trang_tra_webp_dung_be_rong_co_chu_va_chi_luu_cache_ban_mac_dinh()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var up = await UploadAsync(cv, TwoPagePdf(), "xem-truoc.pdf");

        var (page1, bytes1) = await DecodeAsync(await cv.GetAsync($"/api/v1/files/{up.FileId}/pages/1/preview"));
        page1.Width.ShouldBe(800);
        page1.Height.ShouldBeInRange(1100, 1160, "tỉ lệ A4");
        var anyDark = false;
        for (var y = 0; y < page1.Height && !anyDark; y += 3)
            for (var x = 0; x < page1.Width && !anyDark; x += 3) anyDark = page1.GetPixel(x, y).Red < 100;
        anyDark.ShouldBeTrue("trang có chữ đen nên không được trắng toàn bộ");

        // Bản 800 px được ghi vào kho và page_images; gọi lại trả đúng bản đã lưu.
        var key = await api.ScalarAsync<string>("SELECT preview_storage_key FROM hoso.page_images WHERE file_id = $1 AND page_no = 1", up.FileId);
        key.ShouldNotBeNull();
        File.Exists(Path.Combine(api.StorageRoot, key)).ShouldBeTrue();
        var again = await cv.GetAsync($"/api/v1/files/{up.FileId}/pages/1/preview");
        (await DecodeAsync(again)).Bytes.ShouldBe(bytes1);

        // ETag là mã băm nội dung: hỏi lại thì 304, không tải lại ảnh.
        var etag = again.Headers.ETag!.ToString();
        using var conditional = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/files/{up.FileId}/pages/1/preview");
        conditional.Headers.TryAddWithoutValidation("If-None-Match", etag);
        (await cv.SendAsync(conditional, TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotModified);

        // Bề rộng khác: dựng theo yêu cầu, không ghi cache; ngoài khoảng thì bị kẹp.
        (await DecodeAsync(await cv.GetAsync($"/api/v1/files/{up.FileId}/pages/1/preview?w=200"))).Bitmap.Width.ShouldBe(200);
        (await DecodeAsync(await cv.GetAsync($"/api/v1/files/{up.FileId}/pages/1/preview?w=50"))).Bitmap.Width.ShouldBe(PreviewMin);
        (await DecodeAsync(await cv.GetAsync($"/api/v1/files/{up.FileId}/pages/2/preview?w=99999"))).Bitmap.Width.ShouldBe(1600);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.page_images WHERE file_id = $1", up.FileId)).ShouldBe(1, "chỉ trang 1 bản 800 được ghi cache");

        // Trang không có, số trang sai.
        (await cv.GetAsync($"/api/v1/files/{up.FileId}/pages/3/preview")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await cv.GetAsync($"/api/v1/files/{up.FileId}/pages/0/preview")).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    private const int PreviewMin = 120;

    [Fact]
    public async Task Xem_truoc_ngoai_pham_vi_la_404_tep_hong_la_422_va_chua_dang_nhap_la_401()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var good = await UploadAsync(cv, TwoPagePdf(), "rieng-tu.pdf");

        // PDF của người này nằm trong hộp tiếp nhận riêng: người khác không thấy, kể cả cùng cơ quan.
        var other = await api.LoginAsync("demo_cv_ht_02");
        (await other.GetAsync($"/api/v1/files/{good.FileId}/pages/1/preview")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await api.CreateClient().GetAsync($"/api/v1/files/{good.FileId}/pages/1/preview", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);

        // Tệp không phải PDF dựng được (nội dung hỏng): báo rõ, không 500.
        var broken = await UploadAsync(cv, Encoding.ASCII.GetBytes($"%PDF-1.4\n% {Guid.NewGuid():N}\ntrailer<<>>\n%%EOF\n"), "hong.pdf");
        var response = await cv.GetAsync($"/api/v1/files/{broken.FileId}/pages/1/preview");
        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await response.ProblemCodeAsync()).ShouldBe("preview_failed");

        // Tệp đã hủy nội dung không còn để xem trước.
        await api.ExecuteAsync("UPDATE hoso.files SET disposed_at = now(), storage_key = NULL WHERE id = $1", broken.FileId);
        (await cv.GetAsync($"/api/v1/files/{broken.FileId}/pages/1/preview")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }
}
