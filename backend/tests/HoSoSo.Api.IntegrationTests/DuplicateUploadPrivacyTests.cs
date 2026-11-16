using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-92: tải trùng chỉ chỉ đường tới giấy tờ cũ khi người tải thấy được nó; ngoài phạm vi thì không lộ mã, tên tệp, giờ tải.</summary>
public sealed class DuplicateUploadPrivacyTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private const string SensitiveName = "Don-xin-ly-hon-Nguyen-Van-A-CCCD-079123456789.pdf";

    private static Task<HttpResponseMessage> UploadAsync(HttpClient http, byte[] bytes, string name)
    {
        var form = new MultipartFormDataContent { { new ByteArrayContent(bytes) { Headers = { ContentType = new MediaTypeHeaderValue("application/pdf") } }, "file", name } };
        return http.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken);
    }

    private static byte[] NewPdf() => Encoding.ASCII.GetBytes($"%PDF-1.4\n% {Guid.NewGuid():N}\n%%EOF\n");

    [Fact]
    public async Task Nguoi_ngoai_pham_vi_nhan_409_khong_co_chi_tiet_con_chu_tep_va_nguoi_thay_duoc_van_nhan_du()
    {
        var bytes = NewPdf();
        var owner = await api.LoginAsync("demo_cv_ht");
        var first = await (await UploadAsync(owner, bytes, SensitiveName)).ReadAsync<UploadDto>();

        // Chủ tệp tải lại: thấy tài liệu của chính mình nên nhận chi tiết để mở lại.
        var ownDuplicate = await UploadAsync(owner, bytes, "tai-lai.pdf");
        ownDuplicate.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var ownBody = await ownDuplicate.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        ownBody.ShouldContain(first.DocumentId.ToString());
        ownBody.ShouldContain(SensitiveName);

        // Người đơn vị khác (không thấy hộp tiếp nhận riêng của chủ tệp): 409 nhưng không có gì về tài liệu kia.
        var stranger = await api.LoginAsync("demo_cv_kt");
        var outside = await UploadAsync(stranger, bytes, "bat-ky.pdf");
        outside.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await outside.ProblemCodeAsync()).ShouldBe("duplicate_file", "vẫn là lỗi trùng để giao diện hiện đúng thông báo");
        var body = await outside.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var json = JsonDocument.Parse(body);
        json.RootElement.TryGetProperty("details", out _).ShouldBeFalse("không có details");
        foreach (var leaked in new[] { first.DocumentId.ToString(), first.FileId.ToString(), "Nguyen-Van-A", "079123456789", "ly-hon", "uploadedAt" })
            body.ShouldNotContain(leaked, Case.Insensitive);

        // Hệ quả an toàn: lần tải bị từ chối không tạo gì thêm.
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.files WHERE sha256 = $1", Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(bytes)))).ShouldBe(1);
    }

    [Fact]
    public async Task Khi_giay_to_cu_da_vao_ho_so_nguoi_cung_pham_vi_thay_duoc_thi_nhan_chi_tiet()
    {
        var bytes = NewPdf();
        var owner = await api.LoginAsync("demo_cv_ht");
        var first = await (await UploadAsync(owner, bytes, "ho-so-chung.pdf")).ReadAsync<UploadDto>();
        var dossier = await (await owner.PostJsonAsync("/api/v1/dossiers", new { title = "Hồ sơ chung của phòng Hạ tầng", workGroupCode = "U15" })).ReadAsync<DossierDetailDto>();
        (await owner.PostJsonAsync($"/api/v1/dossiers/{dossier.Id}/documents", new { documentId = first.DocumentId })).StatusCode.ShouldBe(HttpStatusCode.OK);

        // Văn thư cơ quan thấy mọi hồ sơ của cơ quan nên thấy cả giấy tờ trong hồ sơ này: nhận chi tiết.
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var seen = await UploadAsync(clerk, bytes, "tai-lai-boi-van-thu.pdf");
        seen.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await seen.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain(first.DocumentId.ToString());

        // Người phòng khác vẫn không thấy.
        var stranger = await api.LoginAsync("demo_cv_kt");
        var outside = await UploadAsync(stranger, bytes, "x.pdf");
        outside.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await outside.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldNotContain(first.DocumentId.ToString());
    }
}
