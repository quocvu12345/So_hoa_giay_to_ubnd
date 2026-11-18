using HoSoSo.Application.Dossiers;
using HoSoSo.Application.Intake;
using HoSoSo.Application.Operations;
using HoSoSo.Application.Search;
using HoSoSo.Domain.Identity;
using Microsoft.AspNetCore.Mvc;

namespace HoSoSo.Api.Endpoints;

internal static class DossierEndpoints
{
    private sealed record ListParams(string? Status, string? Q, string? Department, string? WorkGroup, bool? Mine, string? Cursor, int? Limit,
        int? Year, Guid? Assignee, bool? Overdue, Guid? LocationId, string? Sort, string? Dir)
    {
        public ListDossiersQuery ToQuery() => new(Status, Q, Department, WorkGroup, Mine ?? false, Cursor, Limit ?? 25, Year, Assignee, Overdue ?? false, LocationId, Sort, Dir);
    }
    private sealed record SearchParams(string? Q, string? Kind, int? Limit, string? DocumentType, string? WorkGroup, string? Department, string? Form, DateOnly? IssuedFrom, DateOnly? IssuedTo,
        string? Issuer, string? Cursor);

    public static RouteGroupBuilder MapDossierEndpoints(this RouteGroupBuilder api)
    {
        var dossiers = api.MapGroup("/dossiers").WithTags("Hồ sơ");
        dossiers.MapGet("/", async ([AsParameters] ListParams p, DossierQueries q, CancellationToken ct) => TypedResults.Ok(await q.ListAsync(p.ToQuery(), ct)))
            .RequirePermission(Permissions.DossierRead).WithSummary("Danh sách hồ sơ trong phạm vi, lọc và phân trang keyset");

        dossiers.MapPost("/", async (CreateDossierRequest body, DossierCommands c, CancellationToken ct) =>
            {
                var created = await c.CreateAsync(body, ct);
                return TypedResults.Created($"/api/v1/dossiers/{created.Id}", created);
            })
            .Validate<CreateDossierRequest>().RequirePermission(Permissions.DossierPrepare).WithSummary("Tạo hồ sơ, mã do hệ thống cấp");

        dossiers.MapGet("/export.csv", async ([AsParameters] ListParams p, DossierQueries q, IAccessLog access, CancellationToken ct) =>
            {
                var bytes = DossierCsv.Build(await q.ExportAsync(p.ToQuery(), ct));
                // Đưa dữ liệu ra khỏi hệ thống: ghi nhật ký TRƯỚC khi trả (không ghi được thì không trả, như xuất gói và tải tệp).
                await access.RecordDurableAsync("export", "dossier_list", null, ct);
                return TypedResults.File(bytes, "text/csv; charset=utf-8", $"danh-sach-ho-so-{DateTime.UtcNow.AddHours(7):yyyyMMdd-HHmm}.csv");
            })
            .RequirePermission(Permissions.ExportCreate).WithSummary("Xuất danh sách hồ sơ dạng CSV theo cùng bộ lọc và thứ tự với danh sách (tối đa 10.000 dòng)");
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

        dossiers.MapPost("/{id:guid}/ai/extract", async (Guid id, AiExtractRequest? body, AiExtractHandler h, CancellationToken ct) =>
                TypedResults.Ok(await h.ExtractDossierAsync(id, body ?? new AiExtractRequest(), ct)))
            .WithTags("Xử lý AI").RequirePermission(Permissions.DossierPrepare).RequireRateLimiting(SecuritySetup.AiExtractPolicy)
            .WithSummary("Trích xuất ngay: đưa giấy tờ của hồ sơ lên đầu hàng đợi AI (hoặc tạo việc mới); body tùy chọn { force, documentIds }");

        dossiers.MapGet("/{id:guid}/checklist", async (Guid id, DossierQueries q, CancellationToken ct) => TypedResults.Ok(await q.ChecklistAsync(id, ct)))
            .RequirePermission(Permissions.DossierRead).WithSummary("Thành phần đủ / thiếu / chưa đối chiếu");

        dossiers.MapGet("/{id:guid}/assignees", async (Guid id, DossierQueries q, CancellationToken ct) => TypedResults.Ok(await q.AssigneesAsync(id, ct)))
            .RequirePermission(Permissions.DossierAssign).WithSummary("Người có thể giao chủ trì hồ sơ này (chuyên viên của phòng), kèm số hồ sơ đang giữ và quá hạn");
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
        workspace.MapGet("/leadership", async (DossierQueries q, CancellationToken ct) => TypedResults.Ok(await q.LeadershipAsync(ct)))
            .RequirePermission(Permissions.DossierDecide)
            .WithSummary("Số liệu tổng hợp cho lãnh đạo: Chủ tịch UBND theo phòng; lãnh đạo HĐND theo hoạt động. Chỉ đếm hồ sơ trong phạm vi phân công đang dùng");
        workspace.MapGet("/queue", async (DossierQueries q, CancellationToken ct) => TypedResults.Ok(await q.QueueAsync(ct)))
            .WithSummary("Hàng việc theo phân công đang dùng");

        api.MapGet("/search", async ([AsParameters] SearchParams p, SearchHandler h, CancellationToken ct) =>
                TypedResults.Ok(await h.SearchAsync(p.Q, p.Kind is "documents" or "dossiers" ? p.Kind : "all", p.Limit ?? 20,
                    new SearchFilters(p.DocumentType, p.WorkGroup, p.Department, p.Form, p.IssuedFrom, p.IssuedTo, p.Issuer), ct, p.Cursor)))
            .WithTags("Tra cứu").RequirePermission(Permissions.DocumentView)
            .WithSummary("Tìm số ký hiệu (gần đúng), trích yếu, mã hồ sơ, toàn văn OCR (không dấu); lọc theo loại giấy tờ, nhóm, đơn vị, hình thức, ngày ban hành");
        return api;
    }
}
