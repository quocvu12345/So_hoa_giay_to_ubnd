using System.Text.RegularExpressions;
using HoSoSo.Api.IntegrationTests.Support;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>
/// BE-09: mỗi mã lỗi SQLSTATE do CSDL ném ra được ánh xạ thành đúng mã HTTP và mã nghiệp vụ (bảng mục 6 của docs/02).
/// Một đường dẫn chỉ có trong kiểm thử (đặt cuối pipeline, sau bộ xử lý lỗi) chạy lệnh SQL ném lỗi rồi để ngoại lệ đi qua
/// GlobalExceptionHandler như mọi lỗi thật; không thêm gì vào mã chạy thật.
/// </summary>
public sealed class ErrorMappingTests(ErrorMappingTests.RaisingFactory api) : IClassFixture<ErrorMappingTests.RaisingFactory>
{
    public sealed class RaisingFactory : DbApiFactory
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.ConfigureServices(services => services.AddSingleton<IStartupFilter, RaiseSqlStateFilter>());
        }
    }

    private sealed class RaiseSqlStateFilter : IStartupFilter
    {
        private static readonly Regex SqlStateShape = new("^[A-Z0-9]{5}$", RegexOptions.Compiled);

        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            next(app);      // thêm SAU pipeline thật: chỉ tới đây khi không endpoint nào khớp
            app.Use(async (context, nextMiddleware) =>
            {
                if (!context.Request.Path.StartsWithSegments("/__test/raise", out var rest)) { await nextMiddleware(context); return; }
                var state = rest.Value!.Trim('/');
                if (!SqlStateShape.IsMatch(state)) { context.Response.StatusCode = 400; return; }
                var data = context.RequestServices.GetRequiredService<NpgsqlDataSource>();
                await using var command = data.CreateCommand($"DO $$ BEGIN RAISE EXCEPTION 'noi-dung-goc-cua-csdl' USING ERRCODE = '{state}'; END $$");
                await command.ExecuteNonQueryAsync(context.RequestAborted);
            });
        };
    }

    [Theory]
    [InlineData("HS001", 403, "out_of_scope")]
    [InlineData("HS002", 409, "workflow_conflict")]
    [InlineData("HS003", 422, "note_required")]
    [InlineData("HS004", 422, "dossier_incomplete")]
    [InlineData("HS005", 409, "concurrency_conflict")]
    [InlineData("HS006", 404, "not_found")]
    [InlineData("23505", 409, "duplicate_value")]        // unique_violation không thuộc ràng buộc có tên riêng
    [InlineData("23503", 422, "validation_failed")]      // foreign_key_violation
    [InlineData("23514", 422, "validation_failed")]      // check_violation
    [InlineData("23502", 422, "validation_failed")]      // not_null_violation
    [InlineData("P0001", 422, "validation_failed")]      // RAISE EXCEPTION không có mã riêng
    [InlineData("XX000", 500, "internal_error")]         // lỗi lạ: không lộ nội dung, chỉ có Mã lỗi
    public async Task Ma_SQLSTATE_duoc_anh_xa_dung_ma_HTTP_va_ma_nghiep_vu(string sqlState, int status, string code)
    {
        var http = await api.LoginAsync("demo_cv_ht");
        var response = await http.GetAsync($"/__test/raise/{sqlState}");

        ((int)response.StatusCode).ShouldBe(status);
        (await response.ProblemCodeAsync()).ShouldBe(code);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldContain("errorId");
        body.ShouldContain("correlationId");
        body.ShouldNotContain("noi-dung-goc-cua-csdl", Case.Sensitive, "thông điệp gốc của CSDL không được lộ ra người dùng");
    }

    [Fact]
    public async Task Ham_chuyen_buoc_va_giao_viec_nem_HS006_khi_khong_thay_ho_so()
    {
        api.RequireDatabase();
        var actor = await api.UserIdAsync("demo_cv_ht");
        var assignment = await api.AssignmentIdAsync("demo_cv_ht", "employee");
        var missing = Guid.NewGuid();

        var transition = await Should.ThrowAsync<PostgresException>(() =>
            api.ScalarAsync<string>("SELECT hoso.transition_dossier($1, $2, $3, 'submit', '', NULL)", missing, actor, assignment));
        transition.SqlState.ShouldBe("HS006");

        var assign = await Should.ThrowAsync<PostgresException>(() =>
            api.ExecuteAsync("SELECT hoso.assign_dossier($1, $2, $3, $2, NULL, '')", missing, actor, assignment));
        assign.SqlState.ShouldBe("HS006");
    }
}
