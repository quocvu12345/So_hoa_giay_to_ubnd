using System.Text;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Domain.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>
/// QA-01. Ma trận quyền: mỗi endpoint của API × 6 vai trò, sinh từ chính mã (EndpointDataSource + DefaultRolePermissions) và ghi vào
/// docs/ma-tran-quyen.md. Test kiểm tài liệu KHÔNG lệch khỏi mã: đổi quyền của endpoint hay của vai trò mà quên cập nhật tài liệu thì đỏ.
/// Cập nhật tài liệu: <c>HOSO_WRITE_PERMISSION_MATRIX=1 dotnet test --project tests/HoSoSo.Api.IntegrationTests -- --filter-class "*PermissionMatrixTests"</c>.
/// Giới hạn: đây là ma trận QUYỀN (vai trò có quyền gì). Việc người đó chỉ thấy hồ sơ trong phạm vi phân công do IScopeFilter lọc, được kiểm ở
/// ScopeTests, AssignmentScopeTests và ScopePrefilterTests; ma trận không thay cho các test đó.
/// </summary>
public sealed class PermissionMatrixTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly (string Role, string Name)[] Roles =
    [
        (RoleCode.Employee, "Chuyên viên"), (RoleCode.Manager, "Trưởng phòng/Ban"), (RoleCode.Clerk, "Văn thư"),
        (RoleCode.Chair, "Chủ tịch UBND"), (RoleCode.Council, "Lãnh đạo HĐND"), (RoleCode.TechnicalAdmin, "Quản trị kỹ thuật"),
    ];

    private static readonly string DocPath = Path.GetFullPath(Path.Combine(TestDatabase.MigrationsPath, "..", "..", "..", "docs", "ma-tran-quyen.md"));

    private sealed record Row(string Module, string Route, string Verbs, string Access, string[] Required);

    private List<Row> Collect() =>
        factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .Where(e => e.RoutePattern.RawText?.StartsWith("/api/v1", StringComparison.Ordinal) == true)
            .Select(e =>
            {
                var route = e.RoutePattern.RawText!;
                var verbs = string.Join("/", (e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? ["?"]).Order());
                var policy = e.Metadata.GetOrderedMetadata<IAuthorizeData>().Select(a => a.Policy).FirstOrDefault(p => p is not null && p.StartsWith("perm:", StringComparison.Ordinal));
                var machine = e.Metadata.GetMetadata<HoSoSo.Api.Endpoints.MachineTokenMetadata>() is not null;
                var anonymous = e.Metadata.GetMetadata<IAllowAnonymous>() is not null;
                var access = policy is not null ? "quyền" : machine ? "khóa máy" : anonymous ? "ẩn danh" : "đăng nhập";
                var module = route.Split('/', StringSplitOptions.RemoveEmptyEntries).ElementAtOrDefault(2) ?? "";
                return new Row(module, route, verbs, access, policy is null ? [] : policy["perm:".Length..].Split('|'));
            })
            .OrderBy(r => r.Module, StringComparer.Ordinal).ThenBy(r => r.Route, StringComparer.Ordinal).ThenBy(r => r.Verbs, StringComparer.Ordinal)
            .ToList();

    internal string Render()
    {
        var rows = Collect();
        var text = new StringBuilder();
        text.AppendLine("# Ma trận quyền của API (QA-01)");
        text.AppendLine();
        text.AppendLine("> **Tệp này do test sinh ra từ mã** (`PermissionMatrixTests`), không sửa tay. Đổi quyền của endpoint hay của vai trò thì test đỏ cho tới khi cập nhật:");
        text.AppendLine("> `HOSO_WRITE_PERMISSION_MATRIX=1 dotnet test --project tests/HoSoSo.Api.IntegrationTests -- --filter-class \"*PermissionMatrixTests\"` (chạy từ thư mục `backend/`).");
        text.AppendLine();
        text.AppendLine("Đây là ma trận **quyền**: vai trò có được gọi endpoint hay không. Việc chỉ thấy hồ sơ, giấy tờ trong **phạm vi phân công** do `IScopeFilter` lọc ở mọi truy vấn, được kiểm riêng ở `ScopeTests`, `AssignmentScopeTests`, `ScopePrefilterTests`; ma trận này không thay cho các test đó.");
        text.AppendLine();
        var byAccess = rows.GroupBy(r => r.Access).ToDictionary(g => g.Key, g => g.Count());
        text.AppendLine($"**{rows.Count} endpoint**: {byAccess.GetValueOrDefault("quyền")} cần quyền riêng, {byAccess.GetValueOrDefault("đăng nhập")} chỉ cần đăng nhập (phạm vi do use case kiểm tra), {byAccess.GetValueOrDefault("khóa máy")} dùng khóa máy (script sao lưu), {byAccess.GetValueOrDefault("ẩn danh")} ẩn danh (chỉ dưới `/auth`).");
        text.AppendLine();
        text.AppendLine("Ký hiệu: ✓ vai trò có quyền cần thiết (một trong các quyền nếu liệt kê nhiều) · — không có. Endpoint \"đăng nhập\" mọi vai trò đều gọi được.");
        foreach (var group in rows.GroupBy(r => r.Module))
        {
            text.AppendLine();
            text.AppendLine($"## {group.Key}");
            text.AppendLine();
            text.AppendLine("| Phương thức | Đường dẫn | Quyền cần | " + string.Join(" | ", Roles.Select(r => r.Name)) + " |");
            text.AppendLine("|---|---|---|" + string.Join("|", Roles.Select(_ => ":-:")) + "|");
            foreach (var r in group)
            {
                var need = r.Required.Length > 0 ? string.Join(" hoặc ", r.Required.Select(p => $"`{p}`")) : $"({r.Access})";
                var cells = Roles.Select(role => r.Required.Length == 0 ? (r.Access == "đăng nhập" ? "✓" : "n/a") : r.Required.Any(DefaultRolePermissions.For(role.Role).Contains) ? "✓" : "—");
                text.AppendLine($"| {r.Verbs} | `{r.Route}` | {need} | {string.Join(" | ", cells)} |");
            }
        }
        return text.ToString().Replace("\r\n", "\n");
    }

    [Fact]
    public void Ma_tran_quyen_trong_tai_lieu_khop_voi_ma_hien_tai()
    {
        var current = Render();
        if (Environment.GetEnvironmentVariable("HOSO_WRITE_PERMISSION_MATRIX") == "1")
        {
            File.WriteAllText(DocPath, current, new UTF8Encoding(false));
            return;
        }
        File.Exists(DocPath).ShouldBeTrue($"Chưa có {DocPath}. Sinh bằng HOSO_WRITE_PERMISSION_MATRIX=1 (xem chú thích đầu lớp).");
        File.ReadAllText(DocPath).Replace("\r\n", "\n").ShouldBe(current, "docs/ma-tran-quyen.md đã lệch khỏi mã: sinh lại bằng HOSO_WRITE_PERMISSION_MATRIX=1");
    }

    [Fact]
    public void Ma_tran_dung_voi_quyen_mac_dinh_cua_tung_vai_tro_o_vai_diem_da_biet()
    {
        var text = Render();
        // Chuyên viên tải PDF lên được, Chủ tịch thì không; chỉ quản trị kỹ thuật vào được trang vận hành AI.
        Line(text, "POST", "/api/v1/intake/files").ShouldContain("| ✓ | — | ✓ | — | — | — |");
        Line(text, "GET", "/api/v1/admin/ai/status").ShouldContain("| — | — | — | — | — | ✓ |");
        // Endpoint chỉ cần đăng nhập thì mọi vai trò đều ✓.
        Line(text, "GET", "/api/v1/me").ShouldContain("| ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |");
    }

    private static string Line(string text, string verb, string route) =>
        text.Split('\n').FirstOrDefault(l => l.StartsWith($"| {verb} | `{route}` |", StringComparison.Ordinal) || (l.Contains($"| `{route}` |") && l.StartsWith($"| {verb}", StringComparison.Ordinal)))
        ?? throw new InvalidOperationException($"Không thấy {verb} {route} trong ma trận.");
}
