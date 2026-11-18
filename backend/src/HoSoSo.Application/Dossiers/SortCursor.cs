using System.Text;
using System.Text.Json;
using HoSoSo.Application.Common;

namespace HoSoSo.Application.Dossiers;

/// <summary>
/// BE-111. Con trỏ phân trang cho danh sách có thể sắp theo cột: ghi nhớ cột, chiều và giá trị khóa của dòng cuối cùng (kèm Id để phân định).
/// Con trỏ đổi sang cột hay chiều khác thì sai (400) thay vì cho ra trang lệch. Bộ lọc không nằm trong con trỏ: người gọi giữ nguyên bộ lọc khi lấy trang sau.
/// </summary>
public sealed record SortCursor(string Sort, bool Descending, string? Key, Guid Id)
{
    private sealed record Wire(string S, string D, string? K, Guid I);

    public static string Encode(string sort, bool descending, string? key, Guid id) =>
        Convert.ToBase64String(JsonSerializer.SerializeToUtf8Bytes(new Wire(sort, descending ? "desc" : "asc", key, id))).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static SortCursor? Decode(string? cursor, string sort, bool descending)
    {
        if (string.IsNullOrWhiteSpace(cursor)) return null;
        try
        {
            var padded = cursor.Replace('-', '+').Replace('_', '/');
            padded = padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
            var wire = JsonSerializer.Deserialize<Wire>(Encoding.UTF8.GetString(Convert.FromBase64String(padded)))!;
            if (wire.S != sort || (wire.D == "desc") != descending)
                throw new ValidationFailedException(new Dictionary<string, string[]> { ["cursor"] = ["Con trỏ thuộc cách sắp xếp khác. Tải lại danh sách từ đầu."] });
            var key = wire.K;
            // Kiểm giá trị khóa ngay ở đây để lỗi định dạng ra 400, không thành 500 khi dựng truy vấn.
            if (sort == "due" && key is not null) _ = DateOnly.ParseExact(key, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);
            if (sort == "updated") _ = long.Parse(key ?? "", System.Globalization.CultureInfo.InvariantCulture);
            return new SortCursor(wire.S, wire.D == "desc", key, wire.I);
        }
        catch (Exception exception) when (exception is FormatException or JsonException or ArgumentException or OverflowException or NullReferenceException)
        {
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["cursor"] = ["Con trỏ phân trang không hợp lệ. Tải lại danh sách từ đầu."] });
        }
    }
}
