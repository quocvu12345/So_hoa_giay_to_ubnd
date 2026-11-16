using HoSoSo.Application.Common;

namespace HoSoSo.Api.Endpoints;

/// <summary>Endpoint đã có đường dẫn, quyền và mô tả nhưng chưa làm: trả 501 kèm mã task.</summary>
internal static class Planned
{
    public static IResult Task(string taskCode) => TypedResults.Problem(
        statusCode: StatusCodes.Status501NotImplemented,
        title: "Chưa làm",
        detail: $"Endpoint này thuộc task {taskCode} (docs/tasks/backend.md).",
        type: $"https://hoso.local/errors/{ErrorCodes.NotImplemented}");
}
