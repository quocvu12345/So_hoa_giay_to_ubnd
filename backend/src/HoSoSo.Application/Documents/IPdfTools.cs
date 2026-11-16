namespace HoSoSo.Application.Documents;

public class InvalidPdfException(string message, Exception? inner = null) : Exception(message, inner);

/// <summary>PDF đọc được nhưng vượt giới hạn hệ thống (quá nhiều trang, quá lớn). Khác tệp hỏng: nơi gọi từ chối rõ ràng thay vì bỏ qua.</summary>
public sealed class PdfLimitExceededException(string message) : InvalidPdfException(message);

/// <summary>Một chữ ký số đọc được từ PDF. Status: valid | invalid | unknown (chỉ là kết quả KỸ THUẬT, không kết luận hiệu lực pháp lý).</summary>
public sealed record PdfSignatureInfo(string? SignerName, string? CertificateSerial, string? CertificateIssuer, DateTimeOffset? SignedAt,
    string Status, IReadOnlyDictionary<string, object?> Details);

/// <summary>
/// Thao tác trên PDF của người dùng (không tin cậy): đếm trang, cắt trang, đọc chữ ký. Mọi phương thức giới hạn dung lượng và số trang,
/// ném InvalidPdfException với thông điệp cho người dùng khi tệp hỏng. Phân tích PDF là bề mặt tấn công; xem docs/05-bao-mat.md.
/// </summary>
public interface IPdfTools
{
    int MaxPages { get; }
    int CountPages(Stream pdf);
    /// <summary>Trang <paramref name="from"/>..<paramref name="to"/> (đánh số từ 1, gồm cả hai đầu) thành một PDF mới.</summary>
    byte[] ExtractPages(Stream pdf, int from, int to);
    IReadOnlyList<PdfSignatureInfo> ReadSignatures(Stream pdf);
}
