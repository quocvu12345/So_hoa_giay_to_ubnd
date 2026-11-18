using System.Text.Json;

namespace HoSoSo.Application.Documents;

/// <summary>
/// BE-114. Vùng chứa trích dẫn của một trường AI trên trang: tọa độ theo TỈ LỆ kích thước trang (0..1), gốc ở góc trên bên trái,
/// trang đánh số từ 1. <paramref name="Approximate"/>: engine chỉ ước theo vị trí dòng (trang lấy chữ từ lớp chữ PDF, chưa có khung chữ).
/// Hình dạng JSON trong CSDL: docs/03 mục "Giao kèo giữa API .NET và worker Python".
/// </summary>
public sealed record SourceRegionDto(int Page, double X, double Y, double Width, double Height, bool Approximate);

/// <summary>Đọc cột jsonb <c>source_region</c>. Dữ liệu do worker ghi nên không tin hình dạng: sai thì bỏ vùng (trường vẫn dùng được), không làm hỏng cả màn đối chiếu.</summary>
public static class SourceRegions
{
    public static SourceRegionDto? Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return null;
            if (!Number(root, "page", out var page) || page < 1 || page != Math.Floor(page) || page > int.MaxValue) return null;
            if (!Number(root, "x", out var x) || !Number(root, "y", out var y) || !Number(root, "width", out var width) || !Number(root, "height", out var height)) return null;
            if (x < 0 || y < 0 || width <= 0 || height <= 0 || x > 1 || y > 1) return null;
            // Khung vượt mép trang (làm tròn, ước dòng) thì cắt về mép thay vì bỏ cả vùng.
            width = Math.Min(width, 1 - x);
            height = Math.Min(height, 1 - y);
            var approximate = root.TryGetProperty("approximate", out var flag) && flag.ValueKind == JsonValueKind.True;
            return new SourceRegionDto((int)page, Round(x), Round(y), Round(width), Round(height), approximate);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static double Round(double value) => Math.Round(value, 4);

    private static bool Number(JsonElement root, string name, out double value)
    {
        value = 0;
        return root.TryGetProperty(name, out var element) && element.ValueKind == JsonValueKind.Number && element.TryGetDouble(out value) && double.IsFinite(value);
    }
}
