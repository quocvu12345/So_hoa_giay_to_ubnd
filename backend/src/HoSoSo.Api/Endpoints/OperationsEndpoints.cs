using HoSoSo.Domain.Identity;

using HoSoSo.Application.Admin;
using HoSoSo.Application.Notifications;
using HoSoSo.Application.Operations;

namespace HoSoSo.Api.Endpoints;

/// <summary>Kho bản giấy, mượn trả, nộp lưu, xuất dữ liệu, đề nghị hủy, thông báo, quản trị.</summary>
internal static class OperationsEndpoints
{
    public static RouteGroupBuilder MapOperationsEndpoints(this RouteGroupBuilder api)
    {
        var storage = api.MapGroup("/storage-locations").WithTags("Kho bản giấy").RequirePermission(Permissions.StorageManage);
        storage.MapGet("/", async (bool? includeInactive, StorageHandler h, CancellationToken ct) => TypedResults.Ok(await h.TreeAsync(includeInactive ?? false, ct))).WithSummary("Cây vị trí kho (cha trước con, kèm đường dẫn đầy đủ)");
        storage.MapPost("/", async (CreateLocationRequest body, StorageHandler h, CancellationToken ct) => TypedResults.Ok(await h.CreateAsync(body, ct)))
            .Validate<CreateLocationRequest>().WithSummary("Thêm vị trí (kho › phòng › tủ › kệ › hộp)");
        storage.MapGet("/by-qr", async (string payload, StorageHandler h, CancellationToken ct) => TypedResults.Ok(await h.ResolveQrAsync(payload, ct))).WithSummary("Quét mã QR: tìm vị trí theo nội dung mã");
        storage.MapGet("/labels", async (string ids, StorageHandler h, CancellationToken ct) =>
            {
                var parsed = ids.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Select(s => Guid.TryParse(s, out var g) ? g : Guid.Empty).ToList();
                if (parsed.Contains(Guid.Empty)) throw new ValidationFailedException(new Dictionary<string, string[]> { ["ids"] = ["Danh sách mã vị trí không hợp lệ."] });
                return TypedResults.File(await h.LabelsAsync(parsed, ct), "application/pdf", "nhan-kho.pdf");
            }).WithSummary("In nhãn QR hàng loạt (PDF A4, 24 nhãn mỗi trang)");
        storage.MapGet("/{id:guid}", async (Guid id, StorageHandler h, CancellationToken ct) => TypedResults.Ok(await h.GetAsync(id, ct))).WithSummary("Một vị trí");
        storage.MapPatch("/{id:guid}", async (Guid id, UpdateLocationRequest body, StorageHandler h, CancellationToken ct) => TypedResults.Ok(await h.UpdateAsync(id, body, ct)))
            .Validate<UpdateLocationRequest>().WithSummary("Sửa, ngừng dùng vị trí");
        storage.MapGet("/{id:guid}/qr", async (Guid id, StorageHandler h, CancellationToken ct) => TypedResults.Content(await h.QrSvgAsync(id, ct), "image/svg+xml")).WithSummary("Mã QR của vị trí (SVG)");
        var loans = api.MapGroup("/loans").WithTags("Mượn trả");
        loans.MapGet("/", async (string? status, LoansHandler h, CancellationToken ct) => TypedResults.Ok(await h.ListAsync(status, ct)))
            .RequirePermission(Permissions.LoanRequest, Permissions.LoanApprove).WithSummary("Đề nghị mượn theo trạng thái (người mượn thấy của mình, người duyệt thấy của cơ quan)");
        loans.MapPost("/", async (RequestLoanRequest body, LoansHandler h, CancellationToken ct) => TypedResults.Ok(await h.RequestAsync(body, ct)))
            .Validate<RequestLoanRequest>().RequirePermission(Permissions.LoanRequest).WithSummary("Đề nghị mượn");
        loans.MapPost("/{id:guid}/approve", async (Guid id, ApproveLoanRequest? body, LoansHandler h, CancellationToken ct) => TypedResults.Ok(await h.ApproveAsync(id, body ?? new ApproveLoanRequest(null, null), ct)))
            .RequirePermission(Permissions.LoanApprove).WithSummary("Duyệt mượn (hạn trả mặc định 14 ngày, tối đa 90)");
        loans.MapPost("/{id:guid}/reject", async (Guid id, RejectLoanRequest body, LoansHandler h, CancellationToken ct) => TypedResults.Ok(await h.RejectAsync(id, body, ct)))
            .Validate<RejectLoanRequest>().RequirePermission(Permissions.LoanApprove).WithSummary("Từ chối kèm lý do");
        loans.MapPost("/{id:guid}/lend", async (Guid id, LoansHandler h, CancellationToken ct) => TypedResults.Ok(await h.LendAsync(id, ct)))
            .RequirePermission(Permissions.LoanApprove).WithSummary("Giao hồ sơ");
        loans.MapPost("/{id:guid}/return", async (Guid id, ReturnLoanRequest? body, LoansHandler h, CancellationToken ct) => TypedResults.Ok(await h.ReturnAsync(id, body ?? new ReturnLoanRequest(null), ct)))
            .RequirePermission(Permissions.LoanApprove).WithSummary("Nhận trả hồ sơ (ghi tình trạng)");
        var archive = api.MapGroup("/archive-submissions").WithTags("Nộp lưu").RequirePermission(Permissions.DossierArchive);
        archive.MapGet("/", async (string? status, ArchiveHandler h, CancellationToken ct) => TypedResults.Ok(await h.ListAsync(status, ct))).WithSummary("Các đợt nộp lưu của cơ quan");
        archive.MapPost("/", async (CreateSubmissionRequest body, ArchiveHandler h, CancellationToken ct) => TypedResults.Ok(await h.CreateAsync(body, ct)))
            .Validate<CreateSubmissionRequest>().WithSummary("Tạo đợt từ hồ sơ chờ nộp lưu");
        archive.MapGet("/{id:guid}", async (Guid id, ArchiveHandler h, CancellationToken ct) => TypedResults.Ok(await h.GetAsync(id, ct))).WithSummary("Một đợt kèm danh mục hồ sơ");
        archive.MapDelete("/{id:guid}", async (Guid id, ArchiveHandler h, CancellationToken ct) => { await h.DeleteDraftAsync(id, ct); return TypedResults.NoContent(); }).WithSummary("Xóa đợt đang soạn");
        archive.MapPost("/{id:guid}/submit", async (Guid id, ArchiveHandler h, CancellationToken ct) => TypedResults.Ok(await h.SubmitAsync(id, ct))).WithSummary("Nộp đợt");
        archive.MapPost("/{id:guid}/receive", async (Guid id, ArchiveHandler h, CancellationToken ct) => TypedResults.Ok(await h.ReceiveAsync(id, ct)))
            .WithSummary("Tiếp nhận cả đợt (một giao dịch, hoặc không hồ sơ nào đổi)");
        archive.MapPost("/{id:guid}/return", async (Guid id, ReturnSubmissionRequest body, ArchiveHandler h, CancellationToken ct) => TypedResults.Ok(await h.ReturnAsync(id, body, ct)))
            .Validate<ReturnSubmissionRequest>().WithSummary("Trả lại đợt kèm danh sách lỗi");
        archive.MapGet("/{id:guid}/minutes", async (Guid id, ArchiveHandler h, CancellationToken ct) =>
            {
                var file = await h.MinutesAsync(id, ct);
                return TypedResults.File(file.Content, "application/pdf", file.FileName);
            }).WithSummary("Biên bản nộp lưu (PDF)");

        var exports = api.MapGroup("/exports").WithTags("Xuất dữ liệu").RequirePermission(Permissions.ExportCreate);
        exports.MapGet("/", async (ExportHandler h, CancellationToken ct) => TypedResults.Ok(await h.ListAsync(ct))).WithSummary("Các gói xuất gần đây của tôi");
        exports.MapPost("/", async (CreateExportRequest body, ExportHandler h, CancellationToken ct) => TypedResults.Accepted($"/api/v1/exports/", await h.CreateAsync(body, ct)))
            .Validate<CreateExportRequest>().WithSummary("Tạo gói xuất (chạy nền; theo dõi qua SSE export.progress hoặc GET /exports/{id})");
        exports.MapGet("/{id:guid}", async (Guid id, ExportHandler h, CancellationToken ct) => TypedResults.Ok(await h.GetAsync(id, ct))).WithSummary("Tiến độ gói xuất");
        exports.MapGet("/{id:guid}/file", async (Guid id, ExportHandler h, CancellationToken ct) =>
            {
                var file = await h.OpenAsync(id, ct);
                return TypedResults.File(file.Content, "application/zip", file.FileName, enableRangeProcessing: true);
            }).WithSummary("Tải gói xuất (ZIP; có manifest.sha256)");

        var disposals = api.MapGroup("/disposals").WithTags("Đề nghị hủy");
        disposals.MapGet("/", async (string? status, DisposalHandler h, CancellationToken ct) => TypedResults.Ok(await h.ListAsync(status, ct)))
            .RequirePermission(Permissions.DisposalRequest, Permissions.DisposalApprove).WithSummary("Các đề nghị hủy của cơ quan");
        disposals.MapGet("/eligible", async (DisposalHandler h, CancellationToken ct) => TypedResults.Ok(await h.EligibleAsync(ct)))
            .RequirePermission(Permissions.DisposalRequest, Permissions.DisposalApprove).WithSummary("Hồ sơ đã hết thời hạn bảo quản (theo quy tắc đã xác nhận), chưa có đề nghị hủy");
        disposals.MapGet("/{id:guid}", async (Guid id, DisposalHandler h, CancellationToken ct) => TypedResults.Ok(await h.GetAsync(id, ct)))
            .RequirePermission(Permissions.DisposalRequest, Permissions.DisposalApprove).WithSummary("Một đề nghị hủy");
        disposals.MapPost("/", async (RequestDisposalRequest body, DisposalHandler h, CancellationToken ct) => TypedResults.Ok(await h.RequestAsync(body, ct)))
            .Validate<RequestDisposalRequest>().RequirePermission(Permissions.DisposalRequest).WithSummary("Đề nghị hủy (chỉ hồ sơ đã lưu trữ, hết thời hạn bảo quản đã xác nhận)");
        disposals.MapPost("/{id:guid}/approve", async (Guid id, ApproveDisposalRequest body, DisposalHandler h, CancellationToken ct) => TypedResults.Ok(await h.ApproveAsync(id, body, ct)))
            .Validate<ApproveDisposalRequest>().RequirePermission(Permissions.DisposalApprove).WithSummary("Phê duyệt kèm văn bản quyết định (khác người đề nghị)");
        disposals.MapPost("/{id:guid}/reject", async (Guid id, RejectDisposalRequest body, DisposalHandler h, CancellationToken ct) => TypedResults.Ok(await h.RejectAsync(id, body, ct)))
            .Validate<RejectDisposalRequest>().RequirePermission(Permissions.DisposalApprove).WithSummary("Từ chối kèm lý do");
        disposals.MapPost("/{id:guid}/execute", async (Guid id, DisposalHandler h, CancellationToken ct) => TypedResults.Ok(await h.ExecuteAsync(id, ct)))
            .RequirePermission(Permissions.DisposalRequest).WithSummary("Thực hiện hủy đã phê duyệt: xóa nội dung tệp, giữ metadata và nhật ký (đường duy nhất xóa tệp)");

        var notifications = api.MapGroup("/notifications").WithTags("Thông báo");
        notifications.MapGet("/", async (bool? unread, int? limit, string? cursor, NotificationsHandler h, CancellationToken ct) =>
                TypedResults.Ok(await h.ListAsync(unread ?? false, limit ?? 50, ct, cursor)))
            .WithSummary("Thông báo của tôi, mới nhất trước; trang cũ hơn bằng cursor = nextCursor của trang trước");
        notifications.MapPost("/{id:guid}/read", async (Guid id, NotificationsHandler h, CancellationToken ct) =>
            {
                await h.MarkReadAsync(id, ct);
                return TypedResults.NoContent();
            }).WithSummary("Đánh dấu đã đọc");
        notifications.MapPost("/read-all", async (NotificationsHandler h, CancellationToken ct) => TypedResults.Ok(new { updated = await h.MarkAllReadAsync(ct) }))
            .WithSummary("Đánh dấu tất cả đã đọc");

        var admin = api.MapGroup("/admin").WithTags("Quản trị");
        admin.MapGet("/users", async (string? q, bool? active, bool? expiring, AdminHandler h, CancellationToken ct) =>
                TypedResults.Ok(await h.ListUsersAsync(q, active, ct, expiring ?? false)))
            .RequirePermission(Permissions.AdminUsers).WithSummary("Người dùng; mỗi dòng kèm số phân công sắp hết hạn (≤ 7 ngày); expiring=true chỉ lấy những người đó");
        admin.MapGet("/users/{id:guid}", async (Guid id, AdminHandler h, CancellationToken ct) => TypedResults.Ok(await h.GetUserAsync(id, ct)))
            .RequirePermission(Permissions.AdminUsers).WithSummary("Chi tiết người dùng: phân công (kể cả đã kết thúc) và ủy quyền");
        admin.MapPost("/users", async (CreateUserRequest body, AdminHandler h, CancellationToken ct) =>
            {
                var created = await h.CreateUserAsync(body, ct);
                return TypedResults.Created($"/api/v1/admin/users/{created.User.Id}", created);
            })
            .Validate<CreateUserRequest>().RequirePermission(Permissions.AdminUsers).WithSummary("Thêm người dùng");
        admin.MapPatch("/users/{id:guid}", async (Guid id, UpdateUserRequest body, AdminHandler h, CancellationToken ct) => TypedResults.Ok(await h.UpdateUserAsync(id, body, ct)))
            .Validate<UpdateUserRequest>().RequirePermission(Permissions.AdminUsers).WithSummary("Khóa, mở khóa, sửa tên");
        admin.MapPost("/users/{id:guid}/revoke-sessions", async (Guid id, AdminHandler h, CancellationToken ct) => TypedResults.Ok(new { revoked = await h.RevokeUserSessionsAsync(id, ct) }))
            .RequirePermission(Permissions.AdminUsers).WithSummary("Buộc đăng xuất mọi phiên đang mở của một người dùng");
        admin.MapPost("/assignments", async (CreateAssignmentRequest body, AdminHandler h, CancellationToken ct) => TypedResults.Ok(await h.CreateAssignmentAsync(body, ct)))
            .Validate<CreateAssignmentRequest>().RequirePermission(Permissions.AdminUsers).WithSummary("Thêm phân công có thời hạn, căn cứ");
        admin.MapPost("/assignments/{id:guid}/end", async (Guid id, AdminHandler h, CancellationToken ct) => TypedResults.Ok(await h.EndAssignmentAsync(id, ct)))
            .RequirePermission(Permissions.AdminUsers).WithSummary("Kết thúc phân công");
        admin.MapPost("/delegations", async (CreateDelegationRequest body, AdminHandler h, CancellationToken ct) => TypedResults.Ok(await h.CreateDelegationAsync(body, ct)))
            .Validate<CreateDelegationRequest>().RequirePermission(Permissions.AdminUsers).WithSummary("Ủy quyền có thời hạn (tối đa 90 ngày, chỉ phần quyền mình có)");
        admin.MapPost("/delegations/{id:guid}/revoke", async (Guid id, AdminHandler h, CancellationToken ct) =>
            {
                await h.RevokeDelegationAsync(id, ct);
                return TypedResults.NoContent();
            })
            .RequirePermission(Permissions.AdminUsers).WithSummary("Thu hồi ủy quyền");
        admin.MapGet("/ai/status", async (AdminOpsHandler h, CancellationToken ct) => TypedResults.Ok(await h.AiStatusAsync(ct)))
            .RequirePermission(Permissions.ProcessingManage).WithSummary("Hàng đợi AI, worker, mô hình");
        admin.MapGet("/ai/jobs", async (string? status, string? cursor, int? limit, AdminJobsHandler h, CancellationToken ct) =>
                TypedResults.Ok(await h.ListAsync(status, cursor, limit ?? 50, ct)))
            .RequirePermission(Permissions.ProcessingManage)
            .WithSummary("Việc AI mới nhất trước (status=active|queued|running|failed|cancelled|completed), kèm có hủy/chạy lại được không và lý do");
        admin.MapPost("/ai/jobs/{id:guid}/cancel", async (Guid id, AdminJobsHandler h, CancellationToken ct) => TypedResults.Ok(await h.CancelAsync(id, ct)))
            .RequirePermission(Permissions.ProcessingManage).WithSummary("Hủy việc AI đang chờ hoặc đang chạy (không cần phạm vi giấy tờ)");
        admin.MapPost("/ai/jobs/{id:guid}/retry", async (Guid id, AdminJobsHandler h, CancellationToken ct) => TypedResults.Ok(await h.RetryAsync(id, ct)))
            .RequirePermission(Permissions.ProcessingManage).WithSummary("Chạy lại việc đã lỗi/đã hủy: tạo việc mới cùng tệp, cùng tùy chọn, mức tương tác");
        admin.MapGet("/settings", async (AdminOpsHandler h, CancellationToken ct) => TypedResults.Ok(await h.SettingsAsync(ct)))
            .RequirePermission(Permissions.AdminSettings).WithSummary("Cài đặt hệ thống");
        admin.MapPatch("/settings", async (UpdateSettingRequest body, AdminOpsHandler h, CancellationToken ct) => TypedResults.Ok(await h.UpdateSettingAsync(body, ct)))
            .Validate<UpdateSettingRequest>().RequirePermission(Permissions.AdminSettings).WithSummary("Sửa cài đặt (không nhận bí mật)");
        admin.MapGet("/audit", async (string? kind, Guid? actor, string? objectType, Guid? objectId, string? correlationId, DateTimeOffset? from, DateTimeOffset? to,
                long? before, int? limit, AdminOpsHandler h, CancellationToken ct) =>
                TypedResults.Ok(await h.AuditAsync(kind ?? "change", actor, objectType, objectId, correlationId, from, to, before, limit ?? 50, ct)))
            .RequirePermission(Permissions.AdminSettings).WithSummary("Nhật ký truy cập (kind=access) và thay đổi (kind=change, chỉ tên cột), lọc theo người, đối tượng, mã tương quan");
        admin.MapGet("/errors", async (string? errorId, string? correlationId, Guid? actor, DateTimeOffset? from, DateTimeOffset? to, long? before, int? limit, AdminOpsHandler h, CancellationToken ct) =>
                TypedResults.Ok(await h.ErrorsAsync(errorId, correlationId, actor, from, to, before, limit ?? 50, ct)))
            .RequirePermission(Permissions.AdminSettings).WithSummary("Tra Mã lỗi người dùng gửi: request, người, mã tương quan và các lần truy cập cùng request");
        admin.MapGet("/backups", async (AdminOpsHandler h, CancellationToken ct) => TypedResults.Ok(await h.BackupsAsync(ct)))
            .RequirePermission(Permissions.AdminSettings).WithSummary("Kết quả sao lưu");
        admin.MapPost("/backups", async (RecordBackupRequest body, AdminOpsHandler h, CancellationToken ct) => TypedResults.Ok(await h.RecordBackupAsync(body, ct)))
            .RequirePermission(Permissions.AdminSettings).WithSummary("Quản trị ghi tay kết quả sao lưu (script dùng /ops/backups với khóa máy)");
        admin.MapGet("/backups/status", async (BackupMonitor m, CancellationToken ct) => TypedResults.Ok(await m.StatusAsync(ct)))
            .RequirePermission(Permissions.AdminSettings).WithSummary("Sao lưu có ổn không: bản thành công gần nhất theo loại, quá hạn, lần chạy lỗi hoặc treo, diễn tập khôi phục");
        admin.MapPost("/backups/{id:guid}/restore-test", async (Guid id, RestoreTestRequest? body, AdminOpsHandler h, CancellationToken ct) =>
                TypedResults.Ok(await h.MarkRestoreTestedAsync(id, body ?? new RestoreTestRequest(null, null), ct)))
            .RequirePermission(Permissions.AdminSettings).WithSummary("Ghi nhận đã diễn tập khôi phục từ bản sao lưu này");
        return api;
    }
}
