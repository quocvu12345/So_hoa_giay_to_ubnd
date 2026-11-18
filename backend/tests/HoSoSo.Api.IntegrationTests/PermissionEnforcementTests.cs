using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Domain.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>
/// QA-01 (phần gọi thật). <see cref="PermissionMatrixTests"/> chỉ chứng minh tài liệu khớp mã; ở đây GỌI từng endpoint của API bằng từng vai trò:
/// 1. vai trò KHÔNG có quyền cần thiết thì nhận 403 (trước khi endpoint đụng tới dữ liệu, nên không có tác dụng phụ);
/// 2. đối chứng: vai trò CÓ quyền gọi được các endpoint đọc (GET) mà không bị 401/403, để chắc ca 1 không đỏ-xanh giả vì "cái gì cũng 403";
/// 3. chưa đăng nhập thì mọi endpoint (trừ ẩn danh dưới /auth) trả 401, endpoint khóa máy không nhận khi thiếu khóa (404 khi chưa cấu hình khóa, 401 khi thiếu hoặc sai).
/// Quyền của vai trò lấy từ chính <c>/me</c> của phiên đã đăng nhập (không dùng bảng quyền mặc định trong mã), nên bắt được cả lệch giữa CSDL và mã.
/// Phạm vi dữ liệu (chỉ thấy hồ sơ được phân công) vẫn do ScopeTests, AssignmentScopeTests, ScopePrefilterTests kiểm.
/// </summary>
public sealed class PermissionEnforcementTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private static readonly (string Role, string User)[] Users =
    [
        (RoleCode.Employee, "demo_cv_ht"), (RoleCode.Manager, "demo_head_ht"), (RoleCode.Clerk, "demo_clerk_ubnd"),
        (RoleCode.Chair, "demo_chair"), (RoleCode.Council, "demo_council"), (RoleCode.TechnicalAdmin, "demo_admin"),
    ];

    private sealed record MeAssignment(string Id, string Role);
    private sealed record MeDto(MeAssignment ActiveAssignment, string[] Permissions);
    private sealed record Ep(string Verb, string Route, string[] Required, string Access, bool Multipart);
    private sealed record Session(string Role, HttpClient Http, HashSet<string> Permissions);

    private List<Ep> Endpoints() =>
        api.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .Where(e => e.RoutePattern.RawText?.StartsWith("/api/v1", StringComparison.Ordinal) == true)
            .SelectMany(e =>
            {
                var policy = e.Metadata.GetOrderedMetadata<IAuthorizeData>().Select(a => a.Policy).FirstOrDefault(p => p is not null && p.StartsWith("perm:", StringComparison.Ordinal));
                var access = policy is not null ? "perm"
                    : e.Metadata.GetMetadata<HoSoSo.Api.Endpoints.MachineTokenMetadata>() is not null ? "machine"
                    : e.Metadata.GetMetadata<IAllowAnonymous>() is not null ? "anonymous" : "login";
                var required = policy is null ? [] : policy["perm:".Length..].Split('|');
                var verbs = (e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? []).Where(v => v is not ("HEAD" or "OPTIONS"));
                // Endpoint khai báo Accepts(multipart) bị bộ định tuyến từ chối bằng 415 TRƯỚC khi tới kiểm quyền nếu gửi sai loại nội dung: phải gửi đúng loại thì mới thử được quyền.
                var multipart = e.Metadata.GetMetadata<IAcceptsMetadata>()?.ContentTypes.Any(c => c.StartsWith("multipart/", StringComparison.OrdinalIgnoreCase)) == true;
                return verbs.Select(v => new Ep(v, e.RoutePattern.RawText!, required, access, multipart));
            })
            .OrderBy(e => e.Route, StringComparer.Ordinal).ThenBy(e => e.Verb, StringComparer.Ordinal).ToList();

    /// <summary>Điền tham số đường dẫn bằng giá trị đúng kiểu (để đường dẫn khớp và việc kiểm quyền chạy thật, không rơi vào 404 của bộ định tuyến).</summary>
    private static string Fill(string route) =>
        Regex.Replace(route, @"\{\*{0,2}([^}:?=]+)(?::([^}]+?))?\??\}", m =>
        {
            var constraint = m.Groups[2].Value;
            return constraint.StartsWith("guid", StringComparison.Ordinal) ? Guid.NewGuid().ToString()
                : constraint.StartsWith("int", StringComparison.Ordinal) || constraint.StartsWith("long", StringComparison.Ordinal) ? "1" : "x";
        });

    private static async Task<HttpStatusCode> CallAsync(HttpClient http, Ep ep)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
        cts.CancelAfter(TimeSpan.FromSeconds(20));
        using var request = new HttpRequestMessage(new HttpMethod(ep.Verb), Fill(ep.Route));
        if (ep.Multipart) request.Content = new MultipartFormDataContent { { new StringContent("x"), "note" } };
        else if (ep.Verb is "POST" or "PUT" or "PATCH" or "DELETE") request.Content = new StringContent("{}", Encoding.UTF8, "application/json");
        // Chỉ cần đầu phản hồi: endpoint SSE giữ kết nối mở nên không đọc thân.
        using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cts.Token);
        return response.StatusCode;
    }

    private async Task<List<Session>> SessionsAsync()
    {
        var sessions = new List<Session>();
        foreach (var (role, user) in Users)
        {
            var http = await api.LoginAsync(user);
            var me = await (await http.GetAsync("/api/v1/me", TestContext.Current.CancellationToken)).ReadAsync<MeDto>();
            me.ActiveAssignment.Role.ShouldBe(role, $"{user} phải đăng nhập với vai trò {role} (phân công đang dùng)");
            me.Permissions.ShouldNotBeEmpty($"{role} phải có quyền nào đó");
            sessions.Add(new Session(role, http, [.. me.Permissions]));
        }
        return sessions;
    }

    [Fact]
    public async Task Vai_tro_khong_co_quyen_thi_moi_endpoint_cua_quyen_do_tra_403()
    {
        var sessions = await SessionsAsync();
        var endpoints = Endpoints().Where(e => e.Access == "perm").ToList();
        endpoints.Count.ShouldBeGreaterThan(100, "danh sách endpoint phải lấy được từ mã");

        var wrong = new List<string>();
        var checkedPairs = 0;
        foreach (var s in sessions)
        {
            foreach (var ep in endpoints.Where(e => !e.Required.Any(s.Permissions.Contains)))
            {
                checkedPairs++;
                var status = await CallAsync(s.Http, ep);
                if (status != HttpStatusCode.Forbidden) wrong.Add($"{s.Role} {ep.Verb} {ep.Route} cần [{string.Join(" | ", ep.Required)}] → {(int)status}, đáng lẽ 403");
            }
        }
        checkedPairs.ShouldBeGreaterThan(300, "mỗi vai trò phải bị từ chối ở rất nhiều endpoint");
        wrong.ShouldBeEmpty("Có cặp (vai trò, endpoint) không bị chặn đúng:\n" + string.Join("\n", wrong));
    }

    [Fact]
    public async Task Doi_chung_vai_tro_co_quyen_goi_duoc_cac_endpoint_doc_khong_bi_chan()
    {
        var sessions = await SessionsAsync();
        var gets = Endpoints().Where(e => e.Access == "perm" && e.Verb == "GET").ToList();
        var wrong = new List<string>();
        var allowedPairs = 0;
        foreach (var s in sessions)
        {
            foreach (var ep in gets.Where(e => e.Required.Any(s.Permissions.Contains)))
            {
                allowedPairs++;
                var status = await CallAsync(s.Http, ep);
                if (status is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden) wrong.Add($"{s.Role} GET {ep.Route} có quyền [{string.Join(" | ", ep.Required.Where(s.Permissions.Contains))}] nhưng nhận {(int)status}");
            }
        }
        allowedPairs.ShouldBeGreaterThan(50, "phải có đủ cặp được phép để đối chứng");
        wrong.ShouldBeEmpty("Vai trò có quyền mà vẫn bị chặn:\n" + string.Join("\n", wrong));
    }

    [Fact]
    public async Task Chua_dang_nhap_thi_moi_endpoint_tru_an_danh_tra_401_va_endpoint_khoa_may_khong_nhan_khi_thieu_khoa()
    {
        api.RequireDatabase();
        var anonymous = api.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = false });
        anonymous.DefaultRequestHeaders.Add("X-CSRF", "1");

        var wrong = new List<string>();
        var count = 0;
        foreach (var ep in Endpoints().Where(e => e.Access != "anonymous"))
        {
            count++;
            var status = await CallAsync(anonymous, ep);
            // Khóa máy: chưa cấu hình khóa thì endpoint trả 404 như không tồn tại (OpsEndpoints), có khóa mà thiếu/sai thì 401. Không bao giờ được là 2xx.
            var ok = ep.Access == "machine" ? status is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden or HttpStatusCode.NotFound : status == HttpStatusCode.Unauthorized;
            if (!ok) wrong.Add($"{ep.Access} {ep.Verb} {ep.Route} → {(int)status}");
        }
        count.ShouldBeGreaterThan(120);
        wrong.ShouldBeEmpty("Endpoint không đòi đăng nhập:\n" + string.Join("\n", wrong));
    }
}
