using System.Globalization;
using System.Text;

namespace HoSoSo.Application.Dossiers;

/// <summary>
/// BE-111. Bản xuất danh sách hồ sơ dạng CSV (RFC 4180, dấu phẩy, CRLF) mở đúng tiếng Việt trong Excel nhờ BOM UTF-8.
/// Ô bắt đầu bằng = + - @ hoặc ký tự điều khiển được đặt dấu nháy đơn phía trước: tên hồ sơ do người dùng nhập, mở bằng Excel không được thành công thức (CSV injection).
/// </summary>
public static class DossierCsv
{
    private static readonly string[] Header = ["Mã hồ sơ", "Tên hồ sơ", "Nhóm hồ sơ", "Phòng/Ban", "Trạng thái", "Người chủ trì", "Hạn nội bộ", "Cập nhật lần cuối", "Số giấy tờ", "Vị trí lưu"];
    private static readonly TimeSpan Vietnam = TimeSpan.FromHours(7);

    public static byte[] Build(IEnumerable<DossierQueries.ExportRow> rows)
    {
        var text = new StringBuilder();
        text.Append(string.Join(',', Header.Select(Cell))).Append("\r\n");
        foreach (var r in rows)
        {
            text.Append(string.Join(',', new[]
            {
                r.Code, r.Title, r.WorkGroupTitle, r.DepartmentCode, r.StatusLabel, r.AssigneeName ?? "",
                r.DueOn?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? "",
                r.UpdatedAt.ToOffset(Vietnam).ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture),
                r.DocumentCount.ToString(CultureInfo.InvariantCulture), r.Location ?? "",
            }.Select(Cell))).Append("\r\n");
        }
        return [.. Encoding.UTF8.GetPreamble(), .. Encoding.UTF8.GetBytes(text.ToString())];
    }

    /// <summary>Một ô CSV: vô hiệu hóa công thức ở đầu ô và thoát dấu phẩy, nháy kép, xuống dòng.</summary>
    public static string Cell(string value)
    {
        if (value.Length > 0 && value[0] is '=' or '+' or '-' or '@' or '\t' or '\r' or '\n') value = "'" + value;
        return value.AsSpan().IndexOfAny(",\"\r\n") >= 0 ? "\"" + value.Replace("\"", "\"\"") + "\"" : value;
    }
}
