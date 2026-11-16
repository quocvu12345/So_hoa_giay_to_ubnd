using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using HoSoSo.Application.Documents;
using Org.BouncyCastle.Asn1;
using Org.BouncyCastle.Asn1.Cms;
using Org.BouncyCastle.Asn1.X509;
using Org.BouncyCastle.Cms;
using Org.BouncyCastle.X509;
using Microsoft.Extensions.Configuration;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Writer;

namespace HoSoSo.Infrastructure.Pdf;

internal sealed partial class PdfTools(IConfiguration configuration) : IPdfTools
{
    private const long MaxBytes = 250L * 1024 * 1024;
    private const string VerifierVersion = "hoso-cms-spike/1 (BouncyCastle 2.7)";

    /// <summary>Giới hạn số trang (<c>Limits:MaxPdfPages</c>, mặc định 500): PDF nhiều trang hơn bị từ chối, tránh một tệp độc chiếm hàng đợi AI.</summary>
    public int MaxPages => configuration.GetValue("Limits:MaxPdfPages", 500);

    [GeneratedRegex(@"/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]")]
    private static partial Regex ByteRangeRegex();

    public int CountPages(Stream pdf)
    {
        using var document = Open(pdf);
        return document.NumberOfPages;
    }

    public byte[] ExtractPages(Stream pdf, int from, int to)
    {
        using var source = Open(pdf);
        if (from < 1 || to < from || to > source.NumberOfPages)
            throw new InvalidPdfException($"Dải trang {from}–{to} không nằm trong tệp {source.NumberOfPages} trang.");
        try
        {
            var builder = new PdfDocumentBuilder();
            for (var page = from; page <= to; page++) builder.AddPage(source, page);
            return builder.Build();
        }
        catch (Exception exception) when (exception is not InvalidPdfException)
        {
            throw new InvalidPdfException("Không cắt được trang từ PDF này (cấu trúc tệp chưa được hỗ trợ). Thử xuất lại PDF từ máy quét.", exception);
        }
    }

    private PdfDocument Open(Stream pdf)
    {
        if (pdf.CanSeek && pdf.Length > MaxBytes) throw new PdfLimitExceededException("PDF quá lớn để xử lý.");
        try
        {
            var document = PdfDocument.Open(pdf, new ParsingOptions { UseLenientParsing = true, SkipMissingFonts = true });
            if (document.NumberOfPages > MaxPages) { var pages = document.NumberOfPages; document.Dispose(); throw new PdfLimitExceededException($"PDF có {pages} trang, nhiều hơn giới hạn {MaxPages} trang. Chia thành các tệp nhỏ hơn rồi tải lại."); }
            return document;
        }
        catch (Exception exception) when (exception is not InvalidPdfException)
        {
            throw new InvalidPdfException("Không đọc được PDF này (tệp hỏng hoặc không đúng định dạng).", exception);
        }
    }

    // ---- chữ ký số (BE-54: spike) ----
    public IReadOnlyList<PdfSignatureInfo> ReadSignatures(Stream pdf)
    {
        byte[] bytes;
        using (var buffer = new MemoryStream())
        {
            pdf.CopyTo(buffer);
            if (buffer.Length > MaxBytes) throw new InvalidPdfException("PDF quá lớn để xử lý.");
            bytes = buffer.ToArray();
        }
        var text = Encoding.Latin1.GetString(bytes);    // 1 byte = 1 ký tự nên vị trí khớp chỉ số byte
        var result = new List<PdfSignatureInfo>();
        foreach (Match match in ByteRangeRegex().Matches(text))
        {
            var range = Enumerable.Range(1, 4).Select(i => long.Parse(match.Groups[i].Value, CultureInfo.InvariantCulture)).ToArray();
            result.Add(ReadOne(bytes, range));
        }
        return result;
    }

    private static PdfSignatureInfo ReadOne(byte[] bytes, long[] range)
    {
        var details = new Dictionary<string, object?> { ["byteRange"] = range, ["trust"] = "not_evaluated", ["revocation"] = "not_checked" };
        try
        {
            var (a, b, c, d) = (range[0], range[1], range[2], range[3]);
            if (a != 0 || b <= 0 || c < b + 2 || c + d > bytes.Length)
            {
                details["error"] = "ByteRange không hợp lệ hoặc không nằm trong tệp.";
                return new PdfSignatureInfo(null, null, null, null, "unknown", details);
            }
            // Khoảng giữa hai đoạn là "<hex>" chứa CMS (có thể độn thêm số 0 ở cuối).
            var hex = Encoding.ASCII.GetString(bytes, (int)b + 1, (int)(c - b - 2)).Trim();
            var cmsBytes = Convert.FromHexString(hex.Length % 2 == 0 ? hex : hex + "0");
            using var asn1 = new Asn1InputStream(cmsBytes);
            var contentInfo = ContentInfo.GetInstance(asn1.ReadObject());

            var signedBytes = new byte[b + d];
            Array.Copy(bytes, 0, signedBytes, 0, b);
            Array.Copy(bytes, c, signedBytes, b, d);
            var cms = new CmsSignedData(new CmsProcessableByteArray(signedBytes), contentInfo);

            var signer = cms.GetSignerInfos().GetSigners().FirstOrDefault();
            if (signer is null) { details["error"] = "Không có người ký trong chữ ký."; return new PdfSignatureInfo(null, null, null, null, "unknown", details); }
            var certificate = cms.GetCertificates().EnumerateMatches(signer.SignerID).OfType<X509Certificate>().FirstOrDefault();
            DateTimeOffset? signedAt = null;
            if (signer.SignedAttributes?[CmsAttributes.SigningTime] is { } attribute
                && attribute.AttrValues.Count > 0 && attribute.AttrValues[0] is { } time)
            {
                signedAt = new DateTimeOffset(Org.BouncyCastle.Asn1.Cms.Time.GetInstance(time).ToDateTime(), TimeSpan.Zero);
            }
            details["digestAlgorithm"] = signer.DigestAlgorithmID.Algorithm.Id;
            details["signatureAlgorithm"] = signer.SignatureAlgorithm.Algorithm.Id;
            if (certificate is null)
            {
                details["error"] = "Không có chứng thư số của người ký trong chữ ký nên không kiểm được.";
                return new PdfSignatureInfo(null, null, null, signedAt, "unknown", details);
            }
            details["certificateNotBefore"] = certificate.NotBefore.ToString("O", CultureInfo.InvariantCulture);
            details["certificateNotAfter"] = certificate.NotAfter.ToString("O", CultureInfo.InvariantCulture);
            if (signedAt is { } at) details["certificateValidAtSigning"] = at.UtcDateTime >= certificate.NotBefore && at.UtcDateTime <= certificate.NotAfter;

            // Kiểm tra toán học: mã băm của hai đoạn khớp và chữ ký khớp khóa công khai trong chứng thư. KHÔNG kiểm chuỗi tin cậy hay thu hồi.
            var ok = signer.Verify(certificate);
            return new PdfSignatureInfo(CommonName(certificate), certificate.SerialNumber.ToString(16).ToUpperInvariant(), certificate.IssuerDN.ToString(),
                signedAt, ok ? "valid" : "invalid", details);
        }
        catch (CmsException exception) when (exception.Message.Contains("digest", StringComparison.OrdinalIgnoreCase))
        {
            // BouncyCastle ném lỗi này khi mã băm nội dung khác mã băm ghi trong chữ ký: tệp đã bị sửa sau khi ký.
            details["error"] = "Mã băm nội dung không khớp: tệp có thể đã bị sửa sau khi ký.";
            return new PdfSignatureInfo(null, null, null, null, "invalid", details);
        }
        catch (Exception exception) when (exception is CmsException or IOException or FormatException or ArgumentException or InvalidCastException
                                          or IndexOutOfRangeException or OverflowException or Org.BouncyCastle.Security.GeneralSecurityException or Org.BouncyCastle.Asn1.Asn1Exception)
        {
            // Không đọc được: "unknown", không phải "invalid" (không biết là sai hay chỉ là định dạng chưa hỗ trợ).
            details["error"] = $"Không đọc được cấu trúc chữ ký ({exception.GetType().Name}).";
            return new PdfSignatureInfo(null, null, null, null, "unknown", details);
        }
    }

    private static string? CommonName(X509Certificate certificate) =>
        certificate.SubjectDN.GetValueList(X509Name.CN).Cast<object>().FirstOrDefault()?.ToString() ?? certificate.SubjectDN.ToString();
}
