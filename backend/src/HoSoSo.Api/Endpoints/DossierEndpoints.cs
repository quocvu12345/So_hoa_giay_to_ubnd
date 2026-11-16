using HoSoSo.Application.Dossiers;
using HoSoSo.Application.Operations;
using HoSoSo.Application.Search;
using HoSoSo.Domain.Identity;
using Microsoft.AspNetCore.Mvc;

namespace HoSoSo.Api.Endpoints;

internal static class DossierEndpoints
{
    private sealed record ListParams(string? Status, string? Q, string? Department, string? WorkGroup, bool? Mine, string? Cursor, int? Limit);
    private sealed record SearchParams(string? Q, string? Kind, int? Limit, string? DocumentType, string? WorkGroup, string? Department, string? Form, DateOnly? IssuedFrom, DateOnly? IssuedTo);

    public static RouteGroupBuilder MapDossierEndpoints(this RouteGroupBuilder api)
    {
        var dossiers = api.MapGroup("/dossiers").WithTags("Hồ sơ");
        dossiers.MapGet("/", async ([AsParameters] ListParams p, DossierQueries q, CancellationToken ct) =>
                TypedResults.Ok(await q.ListAsync(new ListDossiersQuery(p.Status, p.Q, p.Department, p.WorkGroup, p.Mine ?? false, p.Cursor, p.Limit ?? 25), ct)))
            .RequirePermission(Permissions.DossierRead).WithSummary("Danh sách hồ sơ trong phạm vi, lọc và phân trang keyset");

        dossiers.MapPost("/", async (CreateDossierRequest body, DossierCommands c, CancellationToken ct) =>
            {
                var created = await c.CreateAsync(body, ct);
                return TypedResults.Created($"/api/v1/dossiers/{created.Id}", created);
            })
            .Validate<CreateDossierRequest>().RequirePermission(Permissions.DossierPrepare).WithSummary("Tạo hồ sơ, mã do hệ thống cấp");

        dossiers.MapGet("/suggestions", async (Guid documentId, DossierQueries q, CancellationToken ct) => TypedResults.Ok(await q.SuggestAsync(documentId, ct))).RequirePermission(Permissions.DossierPrepare).WithSummary("Hồ sơ gợi ý khi xếp một giấy tờ");

        dossiers.MapGet("/{id:guid}", async (Guid id, DossierQueries q, IAccessLog access, CancellationToken ct) =>
            {
                var detail = await q.GetAsync(id, ct);
                // Hồ sơ hạn chế: ghi đồng bộ, không ghi được thì không trả nội dung (BE-94).
                if (detail.AccessLevel == "restricted") await access.RecordDurableAsync("view", "dossier", id, ct);
                else access.Record("view", "dossier", id);
                return TypedResults.Ok(detail);
            })
            .RequirePermission(Permissions.DossierRead).WithSummary("Chi tiết hồ sơ");

        dossiers.MapPatch("/{id:guid}", async (Guid id, UpdateDossierRequest body, DossierCommands c, CancellationToken ct) =>
                TypedResults.Ok(await c.UpdateAsync(id, body, ct)))
            .Validate<UpdateDossierRequest>().RequirePermission(Permissions.DossierPrepare).WithSummary("Sửa thông tin (gửi kèm phiên bản)");

        dossiers.MapPost("/{id:guid}/documents", async (Guid id, AddDocumentRequest body, DossierCommands c, CancellationToken ct) =>
                TypedResults.Ok(await c.AddDocumentAsync(id, body, ct)))
            .Validate<AddDocumentRequest>().RequirePermission(Permissions.DossierPrepare).WithSummary("Thêm giấy tờ (từ hộp tiếp nhận hoặc có sẵn)");

        dossiers.MapPatch("/{id:guid}/documents", async (Guid id, [FromBody] List<DocumentPlacement> body, DossierCommands c, CancellationToken ct) =>
                TypedResults.Ok(await c.ArrangeAsync(id, body, ct)))
            .RequirePermission(Permissions.DossierPrepare).WithSummary("Sắp xếp, đổi chiều luân chuyển, gán thành phần thủ tục");

        dossiers.MapDelete("/{id:guid}/documents/{documentId:guid}", async (Guid id, Guid documentId, DossierCommands c, CancellationToken ct) =>
            {
                await c.RemoveDocumentAsync(id, documentId, ct);
                return TypedResults.NoContent();
            })
            .RequirePermission(Permissions.DossierPrepare).WithSummary("Gỡ giấy tờ khỏi hồ sơ");

        dossiers.MapGet("/{id:guid}/checklist", async (Guid id, DossierQueries q, CancellationToken ct) => TypedResults.Ok(await q.ChecklistAsync(id, ct)))
            .RequirePermission(Permissions.DossierRead).WithSummary("Thành phần đủ / thiếu / chưa đối chiếu");

        dossiers.MapPut("/{id:guid}/assignment", async (Guid id, AssignRequest body, DossierCommands c, CancellationToken ct) =>
                TypedResults.Ok(await c.AssignAsync(id, body, ct)))
            .Validate<AssignRequest>().RequirePermission(Permissions.DossierAssign).WithSummary("Giao người chủ trì, phối hợp, hạn nội bộ");

        dossiers.MapGet("/{id:guid}/actions", async (Guid id, DossierQueries q, CancellationToken ct) => TypedResults.Ok(await q.ActionsAsync(id, ct)))
            .RequirePermission(Permissions.DossierRead).WithSummary("Thao tác được phép ở bước hiện tại, kèm lý do bị khóa");

        dossiers.MapPost("/{id:guid}/transitions", async (Guid id, TransitionRequest body, DossierCommands c, CancellationToken ct) =>
                TypedResults.Ok(await c.TransitionAsync(id, body, ct)))
            .Validate<TransitionRequest>().RequirePermission(Permissions.DossierRead).WithSummary("Chuyển bước qua hoso.transition_dossier (quyền cụ thể do luật chuyển bước quyết định)");

        dossiers.MapGet("/{id:guid}/history", async (Guid id, DossierQueries q, CancellationToken ct) => TypedResults.Ok(await q.HistoryAsync(id, ct)))
            .RequirePermission(Permissions.DossierRead).WithSummary("Nhật ký xử lý");

        dossiers.MapPut("/{id:guid}/location", async (Guid id, PlaceDossierRequest body, StorageHandler h, CancellationToken ct) => TypedResults.Ok(await h.PlaceDossierAsync(id, body, ct))).RequirePermission(Permissions.StorageManage).WithSummary("Đặt hoặc chuyển vị trí bản giấy");

        var workspace = api.MapGroup("/workspace").WithTags("Việc của tôi");
        workspace.MapGet("/summary", async (DossierQueries q, CancellationToken ct) => TypedResults.Ok(await q.SummaryAsync(ct)))
            .WithSummary("Số liệu cho menu và màn Việc của tôi");
        workspace.MapGet("/queue", async (DossierQueries q, CancellationToken ct) => TypedResults.Ok(await q.QueueAsync(ct)))
            .WithSummary("Hàng việc theo phân công đang dùng");

        api.MapGet("/search", async ([AsParameters] SearchParams p, SearchHandler h, CancellationToken ct) =>
                TypedResults.Ok(await h.SearchAsync(p.Q, p.Kind is "documents" or "dossiers" ? p.Kind : "all", p.Limit ?? 20,
                    new SearchFilters(p.DocumentType, p.WorkGroup, p.Department, p.Form, p.IssuedFrom, p.IssuedTo), ct)))
            .WithTags("Tra cứu").RequirePermission(Permissions.DocumentView)
            .WithSummary("Tìm số ký hiệu (gần đúng), trích yếu, mã hồ sơ, toàn văn OCR (không dấu); lọc theo loại giấy tờ, nhóm, đơn vị, hình thức, ngày ban hành");
        return api;
    }
}
