namespace HoSoSo.Api.Endpoints;

/// <summary>
/// Toàn bộ API dưới /api/v1. Mỗi module một tệp; mặc định cần đăng nhập (FallbackPolicy),
/// thêm RequirePermission cho từng thao tác. Danh sách đầy đủ: docs/02-kien-truc-server.md mục 8.
/// </summary>
internal static class ApiRoutes
{
    public static WebApplication MapHoSoApi(this WebApplication app)
    {
        var api = app.MapGroup("/api/v1");
        var uploadMaxBytes = app.Configuration.GetValue("Limits:UploadMaxBytes", 200L * 1024 * 1024);

        api.MapAuthEndpoints(app.Environment);
        api.MapMeEndpoints();
        api.MapEventEndpoints();
        api.MapCatalogEndpoints();
        api.MapIntakeEndpoints(uploadMaxBytes);
        api.MapDocumentEndpoints();
        api.MapDossierEndpoints();
        api.MapOperationsEndpoints();
        api.MapOpsEndpoints();
        return app;
    }
}
