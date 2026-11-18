using HoSoSo.Application.Intake;
using HoSoSo.Domain.Identity;
using Microsoft.AspNetCore.Mvc;

namespace HoSoSo.Api.Endpoints;

internal static class IntakeEndpoints
{
    public static RouteGroupBuilder MapIntakeEndpoints(this RouteGroupBuilder api, long uploadMaxBytes)
    {
        var intake = api.MapGroup("/intake").WithTags("Tiếp nhận");
        intake.MapPost("/batches", async (CreateBatchRequest body, IntakeHandler h, CancellationToken ct) =>
                TypedResults.Ok(await h.CreateBatchAsync(body, ct)))
            .Validate<CreateBatchRequest>().RequirePermission(Permissions.IntakeManage).WithSummary("Tạo lô quét");
        intake.MapGet("/batches", async (IntakeHandler h, CancellationToken ct) => TypedResults.Ok(await h.ListBatchesAsync(ct)))
            .RequirePermission(Permissions.IntakeManage, Permissions.IntakeUpload).WithSummary("Danh sách lô quét");
        intake.MapGet("/batches/{id:guid}", async (Guid id, IntakeHandler h, CancellationToken ct) => TypedResults.Ok(await h.GetBatchAsync(id, ct)))
            .RequirePermission(Permissions.IntakeManage, Permissions.IntakeUpload).WithSummary("Chi tiết lô quét");
        intake.MapPost("/batches/{id:guid}/close", async (Guid id, CloseBatchRequest? body, IntakeHandler h, CancellationToken ct) => TypedResults.Ok(await h.CloseBatchAsync(id, body, ct)))
            .RequirePermission(Permissions.IntakeManage)
            .WithSummary("Đóng lô quét. Còn lỗi ảnh mở: 409 kèm số lỗi; gửi acceptOpenIssuesNote (từ 10 ký tự) để chấp nhận bỏ qua tất cả và đóng luôn");

        // Xác thực CSRF do CsrfMiddleware (header X-CSRF); antiforgery token của MVC không dùng ở API này.
        intake.MapPost("/files", async (IFormFile file, [FromForm] Guid? batchId, IntakeHandler h, CancellationToken ct) =>
            {
                await using var stream = file.OpenReadStream();
                var result = await h.UploadAsync(stream, file.FileName, batchId, ct);
                return TypedResults.Created($"/api/v1/documents/{result.DocumentId}", result);
            })
            .DisableAntiforgery()
            .RequirePermission(Permissions.IntakeUpload)
            .RequireRateLimiting(SecuritySetup.UploadPolicy)
            .WithMetadata(new RequestSizeLimitAttribute(uploadMaxBytes))
            .WithSummary("Tải PDF lên: tính SHA-256, chống trùng, xếp hàng đọc. Trùng trả 409 duplicate_file kèm id giấy tờ cũ");
        // BE-126. Bản quét thay thế: cùng giới hạn tải lên và quét virus như tải PDF mới; quyền là quyền sửa giấy tờ.
        api.MapPost("/documents/{id:guid}/files", async (Guid id, IFormFile file, [FromForm] string? reason, IntakeHandler h, CancellationToken ct) =>
            {
                await using var stream = file.OpenReadStream();
                var result = await h.ReplaceScanAsync(id, stream, file.FileName, reason, ct);
                return TypedResults.Created($"/api/v1/documents/{id}", result);
            })
            .WithTags("Giấy tờ")
            .DisableAntiforgery()
            .RequirePermission(Permissions.DocumentEdit)
            .RequireRateLimiting(SecuritySetup.UploadPolicy)
            .WithMetadata(new RequestSizeLimitAttribute(uploadMaxBytes))
            .WithSummary("Tải bản quét thay thế (phiên bản kế tiếp) kèm lý do 10–500 ký tự; bản cũ giữ nguyên. Trùng bản đã có trả 409 duplicate_file");
        intake.MapGet("/inbox", async (string? status, string? cursor, int? limit, string? read, Guid? batch, string? group, string? type, IntakeHandler h, CancellationToken ct) =>
                TypedResults.Ok(await h.InboxAsync(status, cursor, limit ?? 50, new InboxFilter(read, batch, group, type), ct)))
            .RequirePermission(Permissions.IntakeUpload)
            .WithSummary("Hộp tiếp nhận theo trạng thái inbox | filed | discarded; lọc trên toàn hộp theo tình trạng đọc (read, nhiều giá trị cách nhau dấu phẩy), lô quét (batch), nhóm (group), loại giấy tờ (type) của gợi ý AI mới nhất");
        intake.MapGet("/inbox/summary", async (string? status, Guid? batch, string? group, string? type, IntakeHandler h, CancellationToken ct) =>
                TypedResults.Ok(await h.InboxSummaryAsync(status, new InboxFilter(null, batch, group, type), ct)))
            .RequirePermission(Permissions.IntakeUpload).WithSummary("Số PDF theo tình trạng đọc của một thẻ hộp tiếp nhận (cùng lô/nhóm/loại), cho các nút lọc");
        intake.MapPost("/documents/{id:guid}/discard", async (Guid id, IntakeHandler h, CancellationToken ct) =>
            {
                await h.DiscardAsync(id, ct);
                return TypedResults.NoContent();
            })
            .RequirePermission(Permissions.IntakeUpload).WithSummary("Bỏ PDF (hoàn tác được trong 30 ngày)");
        intake.MapPost("/documents/{id:guid}/restore", async (Guid id, IntakeHandler h, CancellationToken ct) =>
            {
                await h.RestoreAsync(id, ct);
                return TypedResults.NoContent();
            })
            .RequirePermission(Permissions.IntakeUpload).WithSummary("Hoàn tác bỏ PDF");

        var quality = api.MapGroup("/quality-issues").WithTags("Tiếp nhận").RequirePermission(Permissions.IntakeQc);
        quality.MapGet("/", async (Guid? batchId, string? status, QualityHandler h, CancellationToken ct) => TypedResults.Ok(await h.ListAsync(batchId, status, ct)))
            .WithSummary("Lỗi ảnh theo lô, kèm các trang AI đã gắn cờ đáng ngờ");
        quality.MapPost("/", async (CreateIssueRequest body, QualityHandler h, CancellationToken ct) => TypedResults.Ok(await h.CreateAsync(body, ct)))
            .Validate<CreateIssueRequest>().WithSummary("Ghi một lỗi ảnh (trống, mờ, nghiêng, thiếu trang...)");
        quality.MapPost("/{id:guid}/resolve", async (Guid id, ResolveIssueRequest body, QualityHandler h, CancellationToken ct) => TypedResults.Ok(await h.ResolveAsync(id, body, ct)))
            .Validate<ResolveIssueRequest>().WithSummary("Đánh dấu đã sửa hoặc chấp nhận bỏ qua (cần lý do)");
        api.MapPut("/files/{fileId:guid}/pages/{page:int}/quality", async (Guid fileId, int page, PageQualityRequest body, QualityHandler h, CancellationToken ct) =>
                TypedResults.Ok(await h.SetPageQualityAsync(fileId, page, body, ct)))
            .WithTags("Tiếp nhận").Validate<PageQualityRequest>().RequirePermission(Permissions.IntakeQc)
            .WithSummary("Đặt chất lượng một trang; rescan_required sẽ mở lỗi và chặn đóng lô");

        var jobs = api.MapGroup("/jobs").WithTags("Xử lý AI");
        jobs.MapGet("/{id:guid}", async (Guid id, JobsHandler h, CancellationToken ct) => TypedResults.Ok(await h.GetAsync(id, ct)))
            .WithSummary("Tiến độ, vị trí trong hàng đợi, kết quả");
        jobs.MapPost("/{id:guid}/cancel", async (Guid id, JobsHandler h, CancellationToken ct) => TypedResults.Ok(await h.CancelAsync(id, ct)))
            .WithSummary("Hủy đọc (dừng sau trang hiện tại)");
        jobs.MapPost("/{id:guid}/pages/{page:int}/retry", async (Guid id, int page, JobsHandler h, CancellationToken ct) =>
                TypedResults.Ok(await h.RetryPageAsync(id, page, ct)))
            .WithSummary("Đọc lại một trang");
        return api;
    }
}
