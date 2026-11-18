using System.Globalization;
using System.Text;
using System.Text.Json;
using HoSoSo.Application.Common;

namespace HoSoSo.Application.Search;

/// <summary>
/// BE-112. Con trỏ cho tra cứu. Một trang có hai dòng kết quả độc lập (giấy tờ xếp theo độ khớp, hồ sơ xếp theo mới cập nhật), nên con trỏ giữ vị trí của CẢ HAI:
/// <c>Documents</c> = (độ khớp, Id) của giấy tờ cuối trang trước; <c>Dossiers</c> = (thời điểm cập nhật, Id) của hồ sơ cuối trang trước;
/// <c>null</c> = dòng đó chưa bắt đầu, "end" = đã hết (trang sau không trả thêm gì từ dòng đó).
/// </summary>
public sealed record SearchCursor(SearchCursor.Position? Documents, bool DocumentsDone, SearchCursor.Position? Dossiers, bool DossiersDone)
{
    /// <summary>Khóa xếp hạng (độ khớp hoặc ticks của thời điểm cập nhật) và Id để phân định khi trùng khóa.</summary>
    public sealed record Position(double Rank, long Ticks, Guid Id);

    private sealed record Wire(string? D, string? S);
    private const string End = "end";

    public static string Encode(SearchCursor cursor) =>
        Convert.ToBase64String(JsonSerializer.SerializeToUtf8Bytes(new Wire(Write(cursor.Documents, cursor.DocumentsDone), Write(cursor.Dossiers, cursor.DossiersDone))))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static SearchCursor? Decode(string? cursor)
    {
        if (string.IsNullOrWhiteSpace(cursor)) return null;
        try
        {
            var padded = cursor.Replace('-', '+').Replace('_', '/');
            padded = padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
            var wire = JsonSerializer.Deserialize<Wire>(Encoding.UTF8.GetString(Convert.FromBase64String(padded)))!;
            var (documents, documentsDone) = Read(wire.D);
            var (dossiers, dossiersDone) = Read(wire.S);
            return new SearchCursor(documents, documentsDone, dossiers, dossiersDone);
        }
        catch (Exception exception) when (exception is FormatException or JsonException or ArgumentException or OverflowException or NullReferenceException or IndexOutOfRangeException)
        {
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["cursor"] = ["Con trỏ phân trang không hợp lệ. Tìm lại từ đầu."] });
        }
    }

    private static string? Write(Position? position, bool done) =>
        done ? End : position is null ? null : string.Create(CultureInfo.InvariantCulture, $"{position.Rank:R}|{position.Ticks}|{position.Id:N}");

    private static (Position? Position, bool Done) Read(string? text)
    {
        if (text is null) return (null, false);
        if (text == End) return (null, true);
        var parts = text.Split('|');
        var rank = double.Parse(parts[0], NumberStyles.Float, CultureInfo.InvariantCulture);
        if (!double.IsFinite(rank)) throw new FormatException("rank");
        return (new Position(rank, long.Parse(parts[1], CultureInfo.InvariantCulture), Guid.ParseExact(parts[2], "N")), false);
    }
}
