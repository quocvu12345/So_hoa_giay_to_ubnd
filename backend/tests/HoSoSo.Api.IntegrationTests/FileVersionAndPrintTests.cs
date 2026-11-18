using System.Net;
using System.Net.Http.Headers;
using HoSoSo.Api.IntegrationTests.Support;
using Microsoft.Extensions.DependencyInjection;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-113: chi tiết giấy tờ liệt kê mọi phiên bản tệp; in (?purpose=print) cần quyền riêng và ghi đúng một dòng nhật ký.</summary>
public sealed class FileVersionAndPrintTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record FileVersion(Guid Id, string ComponentKey, int VersionNo, string Role, string Kind, string Name, long ByteSize, int? PageCount, string Sha256,
        DateTimeOffset? UploadedAt, string? UploadedByName, bool Disposed, bool IsCurrent);
    private sealed record Detail(Guid Id, List<FileVersion> Files);

    private const string Pdf = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n";

    private static async Task<UploadDto> UploadAsync(HttpClient http, string marker)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(System.Text.Encoding.ASCII.GetBytes($"{Pdf}% {marker}\n"));
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", $"{marker}.pdf");
        return await (await http.PostAsync("/api/v1/intake/files", form, TestContext.Current.CancellationToken)).ReadAsync<UploadDto>();
    }

    /// <summary>
    /// Quyền được nhớ ở hai tầng: theo vai trò (khóa chung "role-permissions") và phân công đã gộp quyền của từng người (Invalidate). Đổi bảng role_permissions xong phải xóa cả hai.
    /// </summary>
    private async Task ForgetPermissionsAsync(string username)
    {
        api.Services.GetRequiredService<Microsoft.Extensions.Caching.Memory.IMemoryCache>().Remove("role-permissions");
        using var scope = api.Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<HoSoSo.Application.Common.IIdentityService>().Invalidate(await api.UserIdAsync(username));
    }

    private Task<long> LinesAsync(string action, Guid fileId) =>
        Eventually.ForAsync(() => api.ScalarAsync<long>("SELECT count(*) FROM hoso.access_events WHERE action = $1 AND object_type = 'file' AND object_id = $2", action, fileId), _ => true);

    [Fact]
    public async Task Chi_tiet_giay_to_liet_ke_du_phien_ban_ban_quet_thay_the_dan_xuat_va_da_huy_khong_lo_khoa_kho()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var up = await UploadAsync(cv, "be113-phien-ban");
        var cvId = await api.UserIdAsync("demo_cv_ht");
        await api.ExecuteAsync("INSERT INTO hoso.files(document_id, component_key, version_no, file_role, original_name, media_type, byte_size, sha256, page_count, storage_key, uploaded_by, uploaded_at) " +
                               "VALUES ($1,'main',2,'scan','ban-quet-lai.pdf','application/pdf',2048,$2,3,'blobs/aa/bb/x',$3, now())", up.DocumentId, new string('a', 64), cvId);
        await api.ExecuteAsync("INSERT INTO hoso.files(document_id, component_key, version_no, file_role, original_name, media_type, byte_size, sha256, page_count, storage_key, uploaded_by, uploaded_at) " +
                               "VALUES ($1,'main',3,'derivative','co-lop-chu.pdf','application/pdf',4096,$2,3,'blobs/bb/cc/y',$3, now())", up.DocumentId, new string('b', 64), cvId);
        await api.ExecuteAsync("INSERT INTO hoso.files(document_id, component_key, version_no, file_role, original_name, media_type, byte_size, sha256, page_count, storage_key, uploaded_at, disposed_at) " +
                               "VALUES ($1,'phu-luc',1,'scan','phu-luc-da-huy.pdf','application/pdf',512,$2,1,NULL, now(), now())", up.DocumentId, new string('c', 64));

        var detail = await (await cv.GetAsync($"/api/v1/documents/{up.DocumentId}", TestContext.Current.CancellationToken)).ReadAsync<Detail>();
        detail.Files.Select(f => (f.ComponentKey, f.VersionNo, f.Kind)).ShouldBe([("main", 1, "original"), ("main", 2, "replacement"), ("main", 3, "derivative"), ("phu-luc", 1, "original")], "theo thành phần rồi phiên bản");
        detail.Files.Single(f => f.VersionNo == 1 && f.ComponentKey == "main").IsCurrent.ShouldBeFalse("đã có bản thay thế mới hơn");
        detail.Files.Single(f => f.VersionNo == 2).IsCurrent.ShouldBeTrue();
        detail.Files.Single(f => f.Kind == "derivative").IsCurrent.ShouldBeTrue("bản dẫn xuất mới nhất của loại đó");
        var disposed = detail.Files.Single(f => f.ComponentKey == "phu-luc");
        (disposed.Disposed, disposed.IsCurrent).ShouldBe((true, false), "đã hủy: còn dòng metadata nhưng không còn là bản hiện hành");
        detail.Files.Single(f => f.VersionNo == 2).UploadedByName.ShouldBe(await api.ScalarAsync<string>("SELECT display_name FROM hoso.users WHERE username = 'demo_cv_ht'"));
        detail.Files.Single(f => f.VersionNo == 2).PageCount.ShouldBe(3);

        var raw = await (await cv.GetAsync($"/api/v1/documents/{up.DocumentId}", TestContext.Current.CancellationToken)).Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.ShouldNotContain("storageKey", Case.Insensitive);
        raw.ShouldNotContain("blobs/", Case.Sensitive, "không lộ khóa kho tệp");
        raw.ShouldNotContain("localPath", Case.Insensitive);

        // Người ngoài phạm vi không thấy giấy tờ nên không thấy danh sách tệp.
        (await (await api.LoginAsync("demo_cv_kt")).GetAsync($"/api/v1/documents/{up.DocumentId}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task In_ghi_dung_mot_dong_nhat_ky_mo_tai_cho_khong_Range_va_tai_ve_van_la_download()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");     // văn thư: có document.print và document.download
        var up = await UploadAsync(clerk, "be113-in");

        var print = await clerk.GetAsync($"/api/v1/files/{up.FileId}/download?purpose=print", TestContext.Current.CancellationToken);
        print.StatusCode.ShouldBe(HttpStatusCode.OK);
        print.Content.Headers.ContentType!.MediaType.ShouldBe("application/pdf");
        print.Content.Headers.ContentDisposition?.DispositionType.ShouldNotBe("attachment", "mở tại chỗ để in, không ép tải về");
        (await print.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken)).Length.ShouldBe((int)up.ByteSize);
        (await LinesAsync("print", up.FileId)).ShouldBe(1, "một lần in một dòng nhật ký");

        // Trình xem PDF hay gửi Range: không hỗ trợ Range thì trả đủ 200, không 206 chia khúc ghi nhiều dòng.
        var ranged = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/files/{up.FileId}/download?purpose=print");
        ranged.Headers.Range = new RangeHeaderValue(0, 9);
        var rangedResponse = await clerk.SendAsync(ranged, TestContext.Current.CancellationToken);
        rangedResponse.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await rangedResponse.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken)).Length.ShouldBe((int)up.ByteSize);
        (await LinesAsync("print", up.FileId)).ShouldBe(2, "mỗi yêu cầu in một dòng; không chia khúc");

        // Tải về bình thường vẫn là download (không lẫn với in).
        var download = await clerk.GetAsync($"/api/v1/files/{up.FileId}/download", TestContext.Current.CancellationToken);
        download.StatusCode.ShouldBe(HttpStatusCode.OK);
        download.Content.Headers.ContentDisposition!.DispositionType.ShouldBe("attachment");
        (await LinesAsync("download", up.FileId)).ShouldBe(1);
        (await LinesAsync("print", up.FileId)).ShouldBe(2);
        (await clerk.GetAsync($"/api/v1/files/{up.FileId}/download?purpose=download", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.OK);

        // Mục đích lạ bị từ chối, tệp không có thì 404.
        (await clerk.GetAsync($"/api/v1/files/{up.FileId}/download?purpose=email", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await clerk.GetAsync($"/api/v1/files/{Guid.NewGuid()}/download?purpose=print", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Chi_nguoi_co_quyen_in_moi_in_duoc_va_quyen_tai_va_quyen_in_tach_roi()
    {
        // Chuyên viên có quyền tải nhưng không có quyền in; giấy tờ của chính họ nên thấy được.
        var cv = await api.LoginAsync("demo_cv_ht");
        var up = await UploadAsync(cv, "be113-chuyen-vien");
        (await cv.GetAsync($"/api/v1/files/{up.FileId}/download", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var denied = await cv.GetAsync($"/api/v1/files/{up.FileId}/download?purpose=print", TestContext.Current.CancellationToken);
        denied.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await LinesAsync("print", up.FileId)).ShouldBe(0, "bị từ chối thì không ghi dòng in nào: chưa có gì đưa ra khỏi hệ thống");

        // Quyền in và quyền tải tách rời: văn thư bị gỡ quyền tải thì vẫn in được nhưng không tải được.
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var mine = await UploadAsync(clerk, "be113-van-thu");
        await api.ExecuteAsync("DELETE FROM hoso.role_permissions WHERE role_code = 'clerk' AND permission_code = 'document.download'");
        try
        {
            await ForgetPermissionsAsync("demo_clerk_ubnd");
            var reloaded = await api.LoginAsync("demo_clerk_ubnd");
            (await reloaded.GetAsync($"/api/v1/files/{mine.FileId}/download?purpose=print", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.OK, "còn quyền in");
            (await reloaded.GetAsync($"/api/v1/files/{mine.FileId}/download", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Forbidden, "không còn quyền tải: không được dùng điểm vào của in để tải");
            (await LinesAsync("download", mine.FileId)).ShouldBe(0);
            (await LinesAsync("print", mine.FileId)).ShouldBe(1);
        }
        finally
        {
            await api.ExecuteAsync("INSERT INTO hoso.role_permissions(role_code, permission_code) VALUES ('clerk', 'document.download') ON CONFLICT DO NOTHING");
            await ForgetPermissionsAsync("demo_clerk_ubnd");
        }

        // Chưa đăng nhập thì 401.
        (await api.CreateClient().GetAsync($"/api/v1/files/{up.FileId}/download?purpose=print", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}
