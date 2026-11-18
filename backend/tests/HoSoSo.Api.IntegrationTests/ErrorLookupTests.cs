using System.Net;
using System.Text.Json;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Infrastructure.Auditing;
using HoSoSo.Infrastructure.Messaging;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-117: người dùng báo Mã lỗi → quản trị tra ra đúng request và người.</summary>
public sealed class ErrorLookupTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record Row(long Id, string ErrorId, DateTimeOffset At, int Status, string Code, string Method, string Path, string? CorrelationId, Guid? UserId, string? Actor, List<Related> Related);
    private sealed record Related(string Action, string? ObjectType, string? CorrelationId);

    private async Task<string> ErrorIdOfAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).RootElement.GetProperty("errorId").GetString()!;

    private Task DrainAsync() => api.Services.GetRequiredService<ErrorEventRecorder>().DrainAsync(TimeSpan.FromSeconds(10));

    [Fact]
    public async Task Ma_loi_nguoi_dung_nhan_tra_ra_dung_request_va_nguoi_kem_cac_lan_truy_cap_cung_request()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        var correlation = "be117-" + Guid.NewGuid().ToString("N")[..12];
        var missing = Guid.NewGuid();
        var request = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/documents/{missing}?q=tu-khoa-tim-kiem");
        request.Headers.Add("X-Correlation-Id", correlation);
        var failed = await cv.SendAsync(request, TestContext.Current.CancellationToken);
        failed.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var errorId = await ErrorIdOfAsync(failed);
        await DrainAsync();

        // Một dòng nhật ký truy cập cùng mã tương quan (request đó đã xem gì trước khi lỗi).
        await api.ExecuteAsync("INSERT INTO hoso.access_events(user_id, action, object_type, correlation_id) VALUES ($1, 'search', 'search', $2)", await api.UserIdAsync("demo_cv_ht"), correlation);

        var admin = await api.LoginAsync("demo_admin");
        // Người dùng gõ mã bằng chữ thường, có khoảng trắng thừa: vẫn ra.
        var found = await (await admin.GetAsync($"/api/v1/admin/errors?errorId=%20{errorId.ToLowerInvariant()}%20", TestContext.Current.CancellationToken)).ReadAsync<List<Row>>();
        var row = found.ShouldHaveSingleItem();
        (row.ErrorId, row.Status, row.Code, row.Method).ShouldBe((errorId, 404, "not_found", "GET"));
        row.Path.ShouldBe($"/api/v1/documents/{missing}", "đường dẫn không kèm chuỗi truy vấn (có thể chứa từ khóa tìm kiếm)");
        row.CorrelationId.ShouldBe(correlation);
        row.UserId.ShouldBe(await api.UserIdAsync("demo_cv_ht"));
        row.Actor.ShouldBe(await api.ScalarAsync<string>("SELECT display_name FROM hoso.users WHERE username = 'demo_cv_ht'"));
        row.Related.ShouldHaveSingleItem().Action.ShouldBe("search");

        // Tra theo mã tương quan ra cùng dòng; lọc theo người khác thì không ra.
        (await (await admin.GetAsync($"/api/v1/admin/errors?correlationId={correlation}", TestContext.Current.CancellationToken)).ReadAsync<List<Row>>()).Single().ErrorId.ShouldBe(errorId);
        (await (await admin.GetAsync($"/api/v1/admin/errors?errorId={errorId}&actor={await api.UserIdAsync("demo_head_ht")}", TestContext.Current.CancellationToken)).ReadAsync<List<Row>>()).ShouldBeEmpty();
    }

    [Fact]
    public async Task Loi_chua_dang_nhap_van_co_dong_nhung_khong_co_nguoi_va_ma_sai_dinh_dang_bi_tu_choi()
    {
        var anonymous = api.CreateClient();
        var denied = await anonymous.GetAsync("/api/v1/documents/" + Guid.NewGuid(), TestContext.Current.CancellationToken);
        denied.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);

        var admin = await api.LoginAsync("demo_admin");
        foreach (var bad in new[] { "XYZ", "12345", "GGGGGGGG", "9FA137189" })
            (await admin.GetAsync($"/api/v1/admin/errors?errorId={bad}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.BadRequest, bad);
        (await (await admin.GetAsync("/api/v1/admin/errors?errorId=00000000", TestContext.Current.CancellationToken)).ReadAsync<List<Row>>()).ShouldBeEmpty("mã không có thì trả danh sách rỗng, không lỗi");
    }

    [Fact]
    public async Task Chi_quan_tri_ky_thuat_tra_duoc_ma_loi_va_dong_cu_hon_90_ngay_duoc_don()
    {
        var cv = await api.LoginAsync("demo_cv_ht");
        (await cv.GetAsync("/api/v1/admin/errors", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await (await api.LoginAsync("demo_head_ht")).GetAsync("/api/v1/admin/errors", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        await api.ExecuteAsync("INSERT INTO hoso.error_events(error_id, status, error_code, method, path, happened_at) VALUES ('0DDBA11D', 500, 'internal', 'GET', '/cu', now() - interval '91 days'), ('0DDBA11E', 500, 'internal', 'GET', '/moi', now() - interval '1 day')");
        await api.Services.GetServices<IHostedService>().OfType<SessionCleanupService>().Single().RunOnceAsync(TestContext.Current.CancellationToken);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.error_events WHERE error_id = '0DDBA11D'")).ShouldBe(0, "quá 90 ngày thì bị dọn");
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.error_events WHERE error_id = '0DDBA11E'")).ShouldBe(1);
    }
}
