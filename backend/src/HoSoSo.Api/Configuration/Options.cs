using System.ComponentModel.DataAnnotations;

namespace HoSoSo.Api.Configuration;

/// <summary>BE-02. Mục "Limits" của cấu hình. Sai giá trị thì máy chủ không khởi động (ValidateOnStart), nói rõ khóa nào sai.</summary>
public sealed class LimitsOptions
{
    [Range(1_000_000, 2_000_000_000, ErrorMessage = "Limits:UploadMaxBytes phải từ 1 MB đến 2 GB.")]
    public long UploadMaxBytes { get; set; } = 200L * 1024 * 1024;

    [Range(10, 100_000, ErrorMessage = "Limits:RequestsPerMinute phải từ 10 đến 100000.")]
    public int RequestsPerMinute { get; set; } = 300;

    [Range(1, 5000, ErrorMessage = "Limits:MaxPdfPages phải từ 1 đến 5000.")]
    public int MaxPdfPages { get; set; } = 500;

    [Range(10_000, 100_000_000, ErrorMessage = "Limits:DefaultMaxBodyBytes phải từ 10 KB đến 100 MB.")]
    public long DefaultMaxBodyBytes { get; set; } = 1L * 1024 * 1024;
}

/// <summary>Mục "ErrorTracking": GlitchTip tự cài tại cơ quan; để trống DSN thì không gửi lỗi đi đâu.</summary>
public sealed class ErrorTrackingOptions
{
    public string Dsn { get; set; } = "";
    public string Environment { get; set; } = "production";

    public bool IsValid => string.IsNullOrWhiteSpace(Dsn) || Uri.TryCreate(Dsn, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https";
}

/// <summary>Mục "ForwardedHeaders": reverse proxy được tin để lấy đúng IP và https của người dùng.</summary>
public sealed class ForwardedHeadersSettings
{
    public string[] KnownProxies { get; set; } = [];
    /// <summary>Dạng CIDR, ví dụ "10.0.0.0/8".</summary>
    public string[] KnownNetworks { get; set; } = [];
}
