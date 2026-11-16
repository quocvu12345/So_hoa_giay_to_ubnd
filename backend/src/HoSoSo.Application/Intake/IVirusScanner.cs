namespace HoSoSo.Application.Intake;

/// <summary>Kết quả quét. <c>Clean</c> = sạch. <c>Signature</c> = tên mã độc khi bị chặn. <c>Error</c> = không quét được (máy quét lỗi, quá thời gian).</summary>
public sealed record VirusScanResult(bool Clean, string? Signature = null, string? Error = null)
{
    public static VirusScanResult Ok { get; } = new(true);
    public static VirusScanResult Infected(string signature) => new(false, signature);
    public static VirusScanResult Failed(string error) => new(false, null, error);
    public bool Unavailable => Error is not null;
}

/// <summary>
/// SEC-05. Quét tệp người dùng tải lên trước khi lưu và xếp hàng đọc. Không bao giờ ném lỗi khi máy quét hỏng: trả <see cref="VirusScanResult.Failed"/>
/// để nơi gọi quyết định theo cấu hình (chặn hay cho qua).
/// </summary>
public interface IVirusScanner
{
    /// <summary>Quét đang bật hay không (tắt thì <see cref="ScanAsync"/> luôn trả sạch).</summary>
    bool Enabled { get; }

    /// <summary>Khi máy quét hỏng: true = vẫn nhận tệp (ghi cảnh báo); false = từ chối tải lên (an toàn hơn, mặc định).</summary>
    bool FailOpen { get; }

    Task<VirusScanResult> ScanAsync(Stream content, CancellationToken cancellationToken);
}
