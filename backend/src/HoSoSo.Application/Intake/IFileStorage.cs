namespace HoSoSo.Application.Intake;

/// <summary>Tệp đã lưu. StorageKey dựa trên SHA-256 nên cùng nội dung chỉ lưu một lần.</summary>
public sealed record StoredFile(string StorageKey, string Sha256, long ByteSize, bool AlreadyExisted);

/// <summary>Kho tệp (ổ đĩa local hoặc S3/MinIO). Không lưu nhị phân trong PostgreSQL.</summary>
public interface IFileStorage
{
    /// <summary>Ghi luồng vào tệp tạm, tính SHA-256 khi ghi, rồi chuyển vào vị trí theo mã băm.</summary>
    Task<StoredFile> SaveAsync(Stream content, CancellationToken cancellationToken);

    Task<Stream> OpenReadAsync(string storageKey, CancellationToken cancellationToken);

    Task<bool> ExistsAsync(string storageKey, CancellationToken cancellationToken);

    /// <summary>
    /// Xóa nội dung theo khóa. Nội dung được dùng chung giữa các bản ghi có cùng mã băm, nên CHỈ gọi khi đã kiểm tra không còn bản ghi nào tham chiếu
    /// (hủy hồ sơ đã phê duyệt BE-87, gói xuất hết hạn BE-86). Trả false nếu không có gì để xóa.
    /// </summary>
    Task<bool> DeleteAsync(string storageKey, CancellationToken cancellationToken);
}
