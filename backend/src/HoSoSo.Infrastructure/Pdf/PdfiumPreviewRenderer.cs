using HoSoSo.Application.Documents;
using PDFtoImage;
using SkiaSharp;

namespace HoSoSo.Infrastructure.Pdf;

/// <summary>
/// BE-43. PDFium (qua PDFtoImage) dựng trang PDF thành ảnh, SkiaSharp mã hóa WebP.
/// Lưu ý bảo mật: PDFium là mã gốc (C++), tệp PDF do người dùng tải lên là dữ liệu không tin cậy. Tải lên đã giới hạn dung lượng và số trang,
/// dựng chạy tối đa 2 trang cùng lúc; nếu cần cách ly mạnh hơn thì chuyển bước này sang tiến trình riêng (xem docs/05-bao-mat.md).
/// </summary>
internal sealed class PdfiumPreviewRenderer : IPagePreviewRenderer
{
    public byte[] RenderWebp(Stream pdf, int page, int width)
    {
        // PDFium kèm sẵn cho Windows, Linux, macOS; hệ khác (FreeBSD...) thì báo rõ thay vì lỗi khó hiểu.
        if (!(OperatingSystem.IsWindows() || OperatingSystem.IsLinux() || OperatingSystem.IsMacOS()))
            throw new InvalidPdfException("hệ điều hành của máy chủ chưa hỗ trợ dựng ảnh trang.");
        try
        {
#pragma warning disable CA1416 // PDFtoImage liệt kê cả Android/iOS/browser; máy chủ chỉ chạy Windows, Linux, macOS và đã chặn hệ khác ở trên.
            using var bitmap = Conversion.ToImage(pdf, page: page - 1, leaveOpen: true, options: new RenderOptions(Width: width, WithAspectRatio: true));
#pragma warning restore CA1416
            using var image = SKImage.FromBitmap(bitmap);
            using var data = image.Encode(SKEncodedImageFormat.Webp, 80);
            return data.ToArray();
        }
        catch (Exception e) when (e is not OutOfMemoryException)
        {
            // PDFium báo lỗi bằng nhiều kiểu ngoại lệ (PDF hỏng, trang không có, bị mã hóa); gộp thành một thông điệp cho người dùng.
            throw new InvalidPdfException("tệp PDF hỏng, bị mã hóa hoặc không có trang này.", e);
        }
    }
}
