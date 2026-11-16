using System.Globalization;
using System.Reflection;
using HoSoSo.Application.Documents;
using QRCoder;
using UglyToad.PdfPig.Content;
using UglyToad.PdfPig.Core;
using UglyToad.PdfPig.Writer;

namespace HoSoSo.Infrastructure.Pdf;

internal sealed class DocumentRenderer : IDocumentRenderer
{
    private const double Width = 595, Height = 842, Margin = 40;
    private static readonly byte[] Regular = Font("BeVietnamPro-Regular.ttf");
    private static readonly byte[] Bold = Font("BeVietnamPro-Bold.ttf");

    private static byte[] Font(string name)
    {
        var assembly = typeof(DocumentRenderer).Assembly;
        using var stream = assembly.GetManifestResourceStream(assembly.GetManifestResourceNames().Single(n => n.EndsWith(name, StringComparison.Ordinal)))!;
        using var buffer = new MemoryStream();
        stream.CopyTo(buffer);
        return buffer.ToArray();
    }

    public string QrSvg(string payload)
    {
        using var generator = new QRCodeGenerator();
        using var data = generator.CreateQrCode(payload, QRCodeGenerator.ECCLevel.M);
        return new SvgQRCode(data).GetGraphic(8);
    }

    /// <summary>Nhãn dán lên hộp/kệ: lưới 3 cột × 8 hàng trên A4; mỗi nhãn có mã QR vector, mã vị trí và đường dẫn đầy đủ.</summary>
    public byte[] Labels(IReadOnlyList<LabelItem> labels)
    {
        var builder = new PdfDocumentBuilder();
        var regular = builder.AddTrueTypeFont(Regular);
        var bold = builder.AddTrueTypeFont(Bold);
        const int columns = 3, rows = 8;
        var cellWidth = (Width - 2 * Margin) / columns;
        var cellHeight = (Height - 2 * Margin) / rows;
        PdfPageBuilder? page = null;
        for (var i = 0; i < labels.Count; i++)
        {
            if (i % (columns * rows) == 0) page = builder.AddPage(Width, Height);
            var slot = i % (columns * rows);
            var x = Margin + slot % columns * cellWidth;
            var top = Height - Margin - slot / columns * cellHeight;
            var label = labels[i];
            DrawQr(page!, label.QrPayload, x + 6, top - cellHeight + 8, cellHeight - 16);
            var textX = x + cellHeight - 6;
            page!.AddText(label.Code, 13, new PdfPoint(textX, top - 24), bold);
            var lines = Wrap(label.Path, 20);
            for (var l = 0; l < Math.Min(lines.Count, 4); l++) page.AddText(lines[l], 8, new PdfPoint(textX, top - 40 - l * 11), regular);
            page.DrawRectangle(new PdfPoint(x + 1, top - cellHeight + 1), cellWidth - 2, cellHeight - 2, 0.3, false);
        }
        if (labels.Count == 0) builder.AddPage(Width, Height).AddText("Chưa chọn vị trí nào", 12, new PdfPoint(Margin, Height - Margin - 12), regular);
        return builder.Build();
    }

    public byte[] ArchiveMinutes(MinutesModel m)
    {
        var builder = new PdfDocumentBuilder();
        var regular = builder.AddTrueTypeFont(Regular);
        var bold = builder.AddTrueTypeFont(Bold);
        var vn = m.At.ToOffset(TimeSpan.FromHours(7));
        var page = builder.AddPage(Width, Height);
        var y = Height - Margin - 14;

        void Line(string text, double size = 10.5, bool strong = false, double gap = 17)
        {
            foreach (var part in Wrap(text, size > 12 ? 60 : 92))
            {
                if (y < Margin + 60) { page = builder.AddPage(Width, Height); y = Height - Margin - 14; }
                page.AddText(part, size, new PdfPoint(Margin, y), strong ? bold : regular);
                y -= gap;
            }
        }

        Line(m.OrganizationName.ToUpperInvariant(), 11, true);
        Line("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", 11, true, 14);
        y -= 8;
        Line("BIÊN BẢN NỘP LƯU HỒ SƠ", 15, true, 24);
        Line($"Mã đợt nộp lưu: {m.SubmissionCode}");
        Line($"Thời điểm tiếp nhận: {vn:HH:mm} ngày {vn:dd/MM/yyyy}");
        Line($"Người nộp: {m.SubmittedBy}");
        Line($"Người tiếp nhận: {m.ReceivedBy}");
        Line($"Tổng cộng: {m.Dossiers.Count} hồ sơ, {m.Dossiers.Sum(d => d.PageCount).ToString("N0", CultureInfo.GetCultureInfo("vi-VN"))} trang.");
        if (m.Note.Length > 0) Line($"Ghi chú: {m.Note}");
        y -= 8;
        Line("DANH MỤC HỒ SƠ", 11, true);
        for (var i = 0; i < m.Dossiers.Count; i++)
        {
            var d = m.Dossiers[i];
            Line($"{i + 1}. {d.Code} · {d.Title}", 10, true, 14);
            Line($"    Số trang: {d.PageCount} · Vị trí lưu: {d.Location ?? "chưa xác định"}", 9.5, false, 15);
        }
        y -= 24;
        if (y < Margin + 90) { page = builder.AddPage(Width, Height); y = Height - Margin - 14; }
        page.AddText("NGƯỜI NỘP", 10.5, new PdfPoint(Margin + 40, y), bold);
        page.AddText("NGƯỜI TIẾP NHẬN", 10.5, new PdfPoint(Margin + 300, y), bold);
        page.AddText("(Ký, ghi rõ họ tên)", 9, new PdfPoint(Margin + 40, y - 13), regular);
        page.AddText("(Ký, ghi rõ họ tên)", 9, new PdfPoint(Margin + 300, y - 13), regular);
        page.AddText("Biên bản do hệ thống Hồ sơ số lập; chữ ký trên bản in là của người có thẩm quyền, hệ thống không thay thế ký.", 8, new PdfPoint(Margin, Margin - 10), regular);
        return builder.Build();
    }

    private static void DrawQr(PdfPageBuilder page, string payload, double x, double y, double size)
    {
        using var generator = new QRCodeGenerator();
        using var data = generator.CreateQrCode(payload, QRCodeGenerator.ECCLevel.M);
        var matrix = data.ModuleMatrix;      // gồm cả vùng yên tĩnh (quiet zone) 4 module mỗi cạnh
        var cell = size / matrix.Count;
        for (var row = 0; row < matrix.Count; row++)
            for (var col = 0; col < matrix.Count; col++)
                if (matrix[row][col]) page.DrawRectangle(new PdfPoint(x + col * cell, y + size - (row + 1) * cell), cell, cell, 0, true);
    }

    /// <summary>Ngắt dòng theo từ; một từ dài hơn độ rộng thì cắt cứng.</summary>
    internal static List<string> Wrap(string text, int width)
    {
        var lines = new List<string>();
        var current = "";
        foreach (var word in text.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            var w = word;
            while (w.Length > width) { if (current.Length > 0) { lines.Add(current); current = ""; } lines.Add(w[..width]); w = w[width..]; }
            if (current.Length + w.Length + 1 > width && current.Length > 0) { lines.Add(current); current = w; }
            else current = current.Length == 0 ? w : $"{current} {w}";
        }
        if (current.Length > 0) lines.Add(current);
        return lines.Count == 0 ? [""] : lines;
    }
}
