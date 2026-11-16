using HoSoSo.Domain.Identity;

using HoSoSo.Application.Documents;

namespace HoSoSo.Api.Endpoints;

internal static class DocumentEndpoints
{
    /// <summary>Trả tệp có hỗ trợ Range (trình xem PDF tải từng phần). Không cache ở trình duyệt/proxy chung.</summary>
    private static async Task<IResult> ServeAsync(FileContentHandler handler, Guid id, bool download, CancellationToken ct)
    {
        var content = await handler.OpenAsync(id, download, ct);
        return TypedResults.File(content.Stream, content.MediaType, download ? content.FileName : null, enableRangeProcessing: true);
    }

    public static RouteGroupBuilder MapDocumentEndpoints(this RouteGroupBuilder api)
    {
        var documents = api.MapGroup("/documents").WithTags("Giấy tờ");
        documents.MapGet("/{id:guid}", async (Guid id, ReviewHandler h, CancellationToken ct) => TypedResults.Ok(await h.GetAsync(id, ct))).RequirePermission(Permissions.DocumentView).WithSummary("Chi tiết giấy tờ");
        documents.MapGet("/{id:guid}/review", async (Guid id, ReviewHandler h, CancellationToken ct) => TypedResults.Ok(await h.ReviewAsync(id, ct))).RequirePermission(Permissions.DocumentEdit).WithSummary("Dữ liệu đối chiếu: gợi ý AI, trường, trang/vùng nguồn, trường cần chú ý");
        documents.MapPut("/{id:guid}/classification", async (Guid id, ClassifyRequest body, ReviewHandler h, CancellationToken ct) => TypedResults.Ok(await h.ClassifyAsync(id, body, ct))).RequirePermission(Permissions.DocumentEdit).WithSummary("Chấp nhận hoặc đổi nhóm, loại giấy tờ");
        documents.MapPatch("/{id:guid}/fields", async (Guid id, EditFieldsRequest body, ReviewHandler h, CancellationToken ct) => TypedResults.Ok(await h.EditFieldsAsync(id, body, ct))).RequirePermission(Permissions.DocumentEdit).WithSummary("Sửa, chuẩn hóa, xác nhận nhiều trường");
        documents.MapPost("/{id:guid}/verify", async (Guid id, ReviewHandler h, CancellationToken ct) => TypedResults.Ok(await h.VerifyAsync(id, ct))).RequirePermission(Permissions.DocumentEdit).WithSummary("Đánh dấu giấy tờ đã đối chiếu");
        documents.MapGet("/{id:guid}/segments", async (Guid id, SegmentsHandler h, CancellationToken ct) => TypedResults.Ok(await h.ListAsync(id, ct)))
            .RequirePermission(Permissions.DocumentEdit).WithSummary("Đề xuất tách văn bản và số trang của tệp");
        documents.MapPost("/{id:guid}/segments", async (Guid id, ProposeSegmentsRequest body, SegmentsHandler h, CancellationToken ct) => TypedResults.Ok(await h.ProposeAsync(id, body, ct)))
            .Validate<ProposeSegmentsRequest>().RequirePermission(Permissions.DocumentEdit).WithSummary("Đặt dải trang cho từng văn bản (không chồng, không hở, phủ đủ)");
        api.MapPost("/segments/{id:guid}/confirm", async (Guid id, ConfirmSplitRequest? body, SegmentsHandler h, CancellationToken ct) =>
                TypedResults.Ok(await h.ConfirmAsync(id, body ?? new ConfirmSplitRequest(null), ct)))
            .WithTags("Giấy tờ").RequirePermission(Permissions.DocumentEdit).WithSummary("Xác nhận tách: cắt trang, tạo văn bản con và đưa vào hàng đợi AI");
        documents.MapGet("/{id:guid}/relations", async (Guid id, RelationsHandler h, CancellationToken ct) => TypedResults.Ok(await h.ListAsync(id, ct)))
            .RequirePermission(Permissions.DocumentView).WithSummary("Liên kết của văn bản (đi và đến)");
        documents.MapPost("/{id:guid}/relations", async (Guid id, AddRelationRequest body, RelationsHandler h, CancellationToken ct) => TypedResults.Ok(await h.AddAsync(id, body, ct)))
            .Validate<AddRelationRequest>().RequirePermission(Permissions.DocumentEdit).WithSummary("Liên kết phụ lục, thay thế, sửa đổi, trả lời (chặn vòng)");
        documents.MapDelete("/{id:guid}/relations/{toId:guid}/{relation}", async (Guid id, Guid toId, string relation, RelationsHandler h, CancellationToken ct) =>
            {
                await h.RemoveAsync(id, toId, relation, ct);
                return TypedResults.NoContent();
            })
            .RequirePermission(Permissions.DocumentEdit).WithSummary("Gỡ liên kết");

        var files = api.MapGroup("/files").WithTags("Tệp");
        files.MapGet("/{id:guid}/signatures", async (Guid id, SignaturesHandler h, CancellationToken ct) => TypedResults.Ok(await h.ListAsync(id, ct)))
            .RequirePermission(Permissions.DocumentView).WithSummary("Kết quả kiểm tra kỹ thuật chữ ký số (không kết luận hiệu lực pháp lý)");
        files.MapPost("/{id:guid}/signatures/verify", async (Guid id, SignaturesHandler h, CancellationToken ct) => TypedResults.Ok(await h.VerifyAsync(id, ct)))
            .RequirePermission(Permissions.DocumentEdit).WithSummary("Đọc và kiểm tra chữ ký số trong PDF");
        files.MapGet("/{id:guid}/content", async (Guid id, FileContentHandler h, CancellationToken ct) => await ServeAsync(h, id, false, ct)).RequirePermission(Permissions.DocumentView).WithSummary("Nội dung tệp, hỗ trợ Range cho trình xem PDF");
        files.MapGet("/{id:guid}/pages/{page:int}/preview", async (Guid id, int page, int? w, PreviewHandler h, CancellationToken ct) =>
            {
                var preview = await h.GetAsync(id, page, w, ct);
                // ETag là mã băm nội dung nên trình duyệt hỏi lại sẽ nhận 304; không cache chung vì ảnh là nội dung hồ sơ.
                return TypedResults.File(preview.Content, "image/webp", entityTag: new Microsoft.Net.Http.Headers.EntityTagHeaderValue(preview.ETag));
            })
            .RequirePermission(Permissions.DocumentView).WithSummary("Ảnh xem trước một trang (WebP, w = bề rộng 120–1600, mặc định 800 và được lưu cache)");
        files.MapGet("/{id:guid}/download", async (Guid id, FileContentHandler h, CancellationToken ct) => await ServeAsync(h, id, true, ct)).RequirePermission(Permissions.DocumentDownload).WithSummary("Tải tệp gốc (ghi nhật ký truy cập)");
        return api;
    }
}
