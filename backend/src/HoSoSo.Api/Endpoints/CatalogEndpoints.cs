using HoSoSo.Application.Admin;
using HoSoSo.Application.Catalog;
using HoSoSo.Application.Procedures;
using HoSoSo.Domain.Identity;

namespace HoSoSo.Api.Endpoints;

internal static class CatalogEndpoints
{
    public static RouteGroupBuilder MapCatalogEndpoints(this RouteGroupBuilder api)
    {
        var catalog = api.MapGroup("/catalog").WithTags("Danh mục");
        catalog.MapGet("/organizations", async (CatalogHandler h, CancellationToken ct) => TypedResults.Ok(await h.OrganizationsAsync(ct))).WithSummary("Cơ quan (UBND, HĐND)");
        catalog.MapGet("/departments", async (string? organization, CatalogHandler h, CancellationToken ct) => TypedResults.Ok(await h.DepartmentsAsync(organization, ct))).WithSummary("Phòng, Ban, đầu mối");
        catalog.MapGet("/work-groups", async (string? organization, string? department, CatalogHandler h, CancellationToken ct) => TypedResults.Ok(await h.WorkGroupsAsync(organization, department, ct)))
            .WithSummary("Nhóm hồ sơ, lọc theo cơ quan và đầu mối (mục ngừng dùng chỉ hiện cho người quản lý danh mục)");
        catalog.MapGet("/work-groups/{code}/document-types", async (string code, CatalogHandler h, CancellationToken ct) => TypedResults.Ok(await h.DocumentTypesAsync(code, ct)))
            .WithSummary("Loại giấy tờ và trường dữ liệu của một nhóm");

        var admin = api.MapGroup("/admin/catalog").WithTags("Quản trị danh mục").RequirePermission(Permissions.CatalogManage);
        admin.MapPost("/work-groups", async (CreateWorkGroupRequest body, CatalogAdminHandler h, CancellationToken ct) => TypedResults.Ok(await h.CreateWorkGroupAsync(body, ct)))
            .Validate<CreateWorkGroupRequest>().WithSummary("Thêm nhóm hồ sơ");
        admin.MapPatch("/work-groups/{code}", async (string code, UpdateWorkGroupRequest body, CatalogAdminHandler h, CancellationToken ct) => TypedResults.Ok(await h.UpdateWorkGroupAsync(code, body, ct)))
            .Validate<UpdateWorkGroupRequest>().WithSummary("Sửa, xác nhận, ngừng dùng nhóm hồ sơ");
        admin.MapDelete("/work-groups/{code}", async (string code, CatalogAdminHandler h, CancellationToken ct) => { await h.DeleteWorkGroupAsync(code, ct); return TypedResults.NoContent(); })
            .WithSummary("Xóa nhóm chưa có dữ liệu (đã dùng thì 409 in_use: hãy ngừng dùng)");
        admin.MapPost("/document-types", async (CreateDocumentTypeRequest body, CatalogAdminHandler h, CancellationToken ct) => TypedResults.Ok(await h.CreateDocumentTypeAsync(body, ct)))
            .Validate<CreateDocumentTypeRequest>().WithSummary("Thêm loại giấy tờ (mã tự cấp)");
        admin.MapPatch("/document-types/{code}", async (string code, UpdateDocumentTypeRequest body, CatalogAdminHandler h, CancellationToken ct) => TypedResults.Ok(await h.UpdateDocumentTypeAsync(code, body, ct)))
            .Validate<UpdateDocumentTypeRequest>().WithSummary("Sửa loại giấy tờ, đặt thành phần bắt buộc, ngừng dùng");
        admin.MapDelete("/document-types/{code}", async (string code, CatalogAdminHandler h, CancellationToken ct) => { await h.DeleteDocumentTypeAsync(code, ct); return TypedResults.NoContent(); })
            .WithSummary("Xóa loại chưa có dữ liệu (đã dùng thì 409 in_use: hãy ngừng dùng)");
        admin.MapPost("/field-definitions", async (CreateFieldRequest body, CatalogAdminHandler h, CancellationToken ct) => TypedResults.Ok(await h.CreateFieldAsync(body, ct)))
            .Validate<CreateFieldRequest>().WithSummary("Thêm trường dữ liệu (mã và thứ tự tự cấp)");
        admin.MapPatch("/field-definitions/{code}", async (string code, UpdateFieldRequest body, CatalogAdminHandler h, CancellationToken ct) => TypedResults.Ok(await h.UpdateFieldAsync(code, body, ct)))
            .Validate<UpdateFieldRequest>().WithSummary("Sửa trường dữ liệu, đánh dấu trường quan trọng");
        admin.MapDelete("/field-definitions/{code}", async (string code, CatalogAdminHandler h, CancellationToken ct) => { await h.DeleteFieldAsync(code, ct); return TypedResults.NoContent(); })
            .WithSummary("Xóa trường chưa có dữ liệu");
        admin.MapGet("/retention-rules", async (string? workGroup, CatalogAdminHandler h, CancellationToken ct) => TypedResults.Ok(await h.RetentionAsync(workGroup, ct)))
            .WithSummary("Thời hạn bảo quản");
        admin.MapPost("/retention-rules", async (CreateRetentionRequest body, CatalogAdminHandler h, CancellationToken ct) => TypedResults.Ok(await h.ProposeRetentionAsync(body, ct)))
            .Validate<CreateRetentionRequest>().WithSummary("Đề xuất thời hạn bảo quản (chưa có hiệu lực cho tới khi xác nhận)");
        admin.MapPost("/retention-rules/{id:guid}/confirm", async (Guid id, ConfirmRetentionRequest body, CatalogAdminHandler h, CancellationToken ct) => TypedResults.Ok(await h.ConfirmRetentionAsync(id, body, ct)))
            .Validate<ConfirmRetentionRequest>().WithSummary("Xác nhận kèm căn cứ pháp lý");
        admin.MapDelete("/retention-rules/{id:guid}", async (Guid id, CatalogAdminHandler h, CancellationToken ct) => { await h.DeleteRetentionAsync(id, ct); return TypedResults.NoContent(); })
            .WithSummary("Xóa đề xuất chưa xác nhận");

        var procedures = api.MapGroup("/procedures").WithTags("Thủ tục hành chính");
        procedures.MapGet("/", async (string? q, string? domain, string? status, int? page, int? pageSize, ProceduresHandler h, CancellationToken ct) =>
                TypedResults.Ok(await h.SearchAsync(q, domain, status, page ?? 1, pageSize ?? 25, ct)))
            .WithSummary("Tìm thủ tục theo tên (không dấu), mã, lĩnh vực, tình trạng hiệu lực");
        procedures.MapGet("/domains", async (ProceduresHandler h, CancellationToken ct) => TypedResults.Ok(await h.DomainsAsync(ct))).WithSummary("Lĩnh vực và số thủ tục");
        procedures.MapGet("/{id}", async (string id, ProceduresHandler h, CancellationToken ct) => TypedResults.Ok(await h.GetAsync(id, ct)))
            .WithSummary("Chi tiết thủ tục, thành phần hồ sơ, mẫu biểu, lịch sử hiệu lực");
        api.MapGet("/form-templates/{id:guid}/file", async (Guid id, ProceduresHandler h, CancellationToken ct) =>
            {
                var file = await h.OpenTemplateAsync(id, ct);
                return TypedResults.File(file.Stream, file.MediaType, file.FileName);
            })
            .WithTags("Thủ tục hành chính").WithSummary("Tải mẫu biểu");
        return api;
    }
}
