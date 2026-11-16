using System.Globalization;
using System.Text;

namespace HoSoSo.Application.Common;

public sealed record Page<T>(IReadOnlyList<T> Items, string? NextCursor);

/// <summary>Con trỏ phân trang keyset (thời điểm sửa, id) mã hóa base64url. Không cho client tự dựng giá trị khác.</summary>
public static class Cursor
{
    public static string Encode(DateTimeOffset at, Guid id) =>
        Convert.ToBase64String(Encoding.UTF8.GetBytes($"{at.UtcTicks.ToString(CultureInfo.InvariantCulture)}|{id:N}"))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static (DateTimeOffset At, Guid Id)? Decode(string? cursor)
    {
        if (string.IsNullOrWhiteSpace(cursor)) return null;
        try
        {
            var padded = cursor.Replace('-', '+').Replace('_', '/');
            padded = padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
            var parts = Encoding.UTF8.GetString(Convert.FromBase64String(padded)).Split('|');
            return (new DateTimeOffset(long.Parse(parts[0], CultureInfo.InvariantCulture), TimeSpan.Zero), Guid.ParseExact(parts[1], "N"));
        }
        catch (Exception exception) when (exception is FormatException or IndexOutOfRangeException or ArgumentOutOfRangeException or OverflowException)
        {
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["cursor"] = ["Con trỏ phân trang không hợp lệ. Tải lại danh sách từ đầu."] });
        }
    }
}

/// <summary>Dữ liệu gửi lên sai: 400 kèm lỗi theo từng trường (khóa camelCase).</summary>
public sealed class ValidationFailedException(IDictionary<string, string[]> errors)
    : AppException(400, ErrorCodes.ValidationFailed, "Dữ liệu chưa hợp lệ. Kiểm tra các trường được đánh dấu.", errors)
{
    public IDictionary<string, string[]> Errors { get; } = errors;
}
