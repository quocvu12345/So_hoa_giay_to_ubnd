using System.Net;
using System.Net.Sockets;
using HoSoSo.Infrastructure.Pdf;
using HoSoSo.Infrastructure.Storage;

namespace HoSoSo.Api.Configuration;

/// <summary>
/// BE-96. Kiểm cấu hình AN TOÀN khi chạy Production, lúc khởi động: lỗi thì máy chủ không chạy (thông điệp nói rõ khóa cấu hình và cách sửa), cảnh báo thì ghi log.
/// Các khóa kiểm đơn lẻ (Auth:Mode, cookie, OIDC) đã có ở SecuritySetup; đây là các yêu cầu chỉ có nghĩa ở Production.
/// </summary>
public static class ProductionSafety
{
    public sealed record Result(IReadOnlyList<string> Errors, IReadOnlyList<string> Warnings);

    public static Result Check(IConfiguration configuration, IHostEnvironment environment)
    {
        if (!environment.IsProduction()) return new Result([], []);
        var errors = new List<string>();
        var warnings = new List<string>();

        // PDF là đầu vào không tin cậy: Production bắt buộc chạy xử lý PDF trong tiến trình con có hạn giờ và bộ nhớ (BE-93).
        var sandbox = configuration.GetSection("PdfSandbox").Get<PdfSandboxOptions>() ?? new PdfSandboxOptions();
        if (sandbox.InProcess)
            errors.Add("PdfSandbox:Mode=InProcess chỉ để phát triển: một PDF độc hại có thể treo hoặc làm sập cả API. Đặt PdfSandbox:Mode=Process (mặc định).");

        // Cookie phiên được mã hóa bằng khóa Data Protection: khóa phải bền và dùng chung giữa các instance, và không nằm trần trên đĩa.
        var keysPath = configuration["Auth:DataProtectionKeysPath"];
        var certificate = configuration["Auth:DataProtectionCertificatePath"];
        if (string.IsNullOrWhiteSpace(keysPath))
            errors.Add("Thiếu Auth:DataProtectionKeysPath. Không đặt thì khóa mã hóa cookie lưu ở nơi mặc định của hệ điều hành: container tạo lại hay chạy nhiều instance là mọi người mất phiên. Đặt thư mục bền, dùng chung giữa các instance.");
        if (string.IsNullOrWhiteSpace(certificate) && !configuration.GetValue("Auth:AllowUnprotectedDataProtectionKeys", false))
            errors.Add("Khóa Data Protection chưa được bảo vệ khi lưu. Đặt Auth:DataProtectionCertificatePath (tệp .pfx) và mật khẩu ở biến môi trường Auth__DataProtectionCertificatePassword; " +
                       "hoặc đặt Auth:AllowUnprotectedDataProtectionKeys=true nếu đã mã hóa cả ổ đĩa lưu khóa và chấp nhận rủi ro đó.");
        if (!string.IsNullOrWhiteSpace(certificate) && !File.Exists(certificate))
            errors.Add($"Không thấy tệp chứng thư Auth:DataProtectionCertificatePath ({certificate}).");

        // Kho tệp S3: dữ liệu giấy tờ không được đi trên đường truyền không mã hóa ra ngoài mạng nội bộ.
        var storage = configuration.GetSection("Storage").Get<StorageOptions>() ?? new StorageOptions();
        if (storage.UsesS3 && Uri.TryCreate(storage.S3.ServiceUrl, UriKind.Absolute, out var s3) && s3.Scheme == Uri.UriSchemeHttp && !IsInternalHost(s3.Host))
            errors.Add($"Storage:S3:ServiceUrl dùng http:// tới máy chủ ngoài mạng nội bộ ({s3.Host}). Dùng https://.");

        // Chống virus.
        if (!configuration.GetValue("Antivirus:Enabled", false))
        {
            var message = "Antivirus:Enabled=false: tệp PDF tải lên không được quét mã độc. Cài ClamAV (clamd) và bật Antivirus:Enabled.";
            if (configuration.GetValue("Antivirus:RequiredInProduction", false)) errors.Add(message + " (Antivirus:RequiredInProduction=true nên bắt buộc.)");
            else warnings.Add(message);
        }
        else if (configuration.GetValue("Antivirus:FailOpen", false))
            warnings.Add("Antivirus:FailOpen=true: máy quét hỏng thì vẫn nhận tệp chưa quét. Chỉ nên bật tạm thời.");

        // Khóa máy sao lưu: ngắn quá thì endpoint /ops/backups tắt âm thầm (trả 404), người vận hành tưởng đã bật.
        var token = configuration["Backup:IngestToken"];
        if (!string.IsNullOrEmpty(token) && token.Length < 32)
            warnings.Add("Backup:IngestToken ngắn hơn 32 ký tự nên endpoint /api/v1/ops/backups bị tắt (trả 404). Dùng khóa ngẫu nhiên từ 32 ký tự.");

        return new Result(errors, warnings);
    }

    /// <summary>Máy trong mạng nội bộ: loopback, dải riêng (10/8, 172.16/12, 192.168/16, 100.64/10, link-local), tên không có dấu chấm hoặc đuôi .local/.internal/.lan/.intranet.</summary>
    internal static bool IsInternalHost(string host)
    {
        if (IPAddress.TryParse(host, out var ip))
        {
            if (IPAddress.IsLoopback(ip)) return true;
            if (ip.AddressFamily == AddressFamily.InterNetworkV6) return ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal || (ip.GetAddressBytes()[0] & 0xFE) == 0xFC;
            var b = ip.GetAddressBytes();
            return b[0] == 10 || (b[0] == 172 && b[1] is >= 16 and <= 31) || (b[0] == 192 && b[1] == 168) || (b[0] == 100 && b[1] is >= 64 and <= 127) || (b[0] == 169 && b[1] == 254);
        }
        host = host.ToLowerInvariant();
        return !host.Contains('.') || host.EndsWith(".local", StringComparison.Ordinal) || host.EndsWith(".internal", StringComparison.Ordinal)
            || host.EndsWith(".lan", StringComparison.Ordinal) || host.EndsWith(".intranet", StringComparison.Ordinal);
    }
}
