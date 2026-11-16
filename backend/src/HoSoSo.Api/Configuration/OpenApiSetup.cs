using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi;

namespace HoSoSo.Api.Configuration;

/// <summary>
/// BE-11. Mọi thao tác trong tài liệu OpenAPI khai báo các lỗi chung (cùng ProblemDetails + errorId), để frontend sinh kiểu và
/// xử lý đúng mà không phải đọc mã nguồn. Mã lỗi nghiệp vụ nằm ở trường "type" của ProblemDetails (docs/02-kien-truc-server.md mục 6).
/// </summary>
internal static class OpenApiSetup
{
    public static IServiceCollection AddHoSoOpenApi(this IServiceCollection services) => services.AddOpenApi(options =>
        options.AddOperationTransformer((operation, context, _) =>
        {
            var path = context.Description.RelativePath ?? "";
            if (path.StartsWith("api/v1/auth", StringComparison.Ordinal)) return Task.CompletedTask;
            var metadata = context.Description.ActionDescriptor.EndpointMetadata;
            var hasPermission = metadata.OfType<IAuthorizeData>().Any(a => a.Policy?.StartsWith("perm:", StringComparison.Ordinal) == true);
            var writes = context.Description.HttpMethod is "POST" or "PUT" or "PATCH" or "DELETE";

            operation.Responses ??= [];
            Add(operation, "401", "Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated).");
            if (hasPermission) Add(operation, "403", "Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed).");
            if (path.Contains('{')) Add(operation, "404", "Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại.");
            if (writes)
            {
                Add(operation, "400", "Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed).");
                Add(operation, "409", "Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file).");
                Add(operation, "422", "Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ.");
            }
            Add(operation, "429", "Gọi quá nhiều lần trong một phút; thử lại sau.");
            return Task.CompletedTask;
        }));

    private static void Add(OpenApiOperation operation, string code, string description)
    {
        if (operation.Responses!.ContainsKey(code)) return;
        operation.Responses[code] = new OpenApiResponse
        {
            Description = description,
            Content = new Dictionary<string, OpenApiMediaType> { ["application/problem+json"] = new() },
        };
    }
}
