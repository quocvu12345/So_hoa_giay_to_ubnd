using System.Security.Cryptography;
using HoSoSo.Application.Intake;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace HoSoSo.Infrastructure.Storage;

public sealed class StorageOptions
{
    /// <summary>Thư mục gốc chứa blobs/ab/cd/&lt;sha256&gt;; đường dẫn tương đối tính từ ContentRoot. Không đặt trong thư mục web.</summary>
    public string Root { get; set; } = "data/blobs";

    /// <summary>"Local" (mặc định, ổ đĩa) hoặc "S3" (S3/MinIO). Với S3, <see cref="Root"/> vẫn dùng làm thư mục tạm khi ghi và đóng gói.</summary>
    public string Provider { get; set; } = "Local";

    public S3Options S3 { get; set; } = new();

    public bool UsesS3 => string.Equals(Provider, "S3", StringComparison.OrdinalIgnoreCase);
}

/// <summary>Cấu hình S3. Khóa truy cập đặt bằng biến môi trường (<c>Storage__S3__SecretKey</c>), không ghi vào tệp cấu hình.</summary>
public sealed class S3Options
{
    /// <summary>Địa chỉ dịch vụ tương thích S3 (ví dụ MinIO <c>https://minio.noi-bo:9000</c>). Để trống khi dùng AWS S3.</summary>
    public string? ServiceUrl { get; set; }
    public string Region { get; set; } = "us-east-1";
    public string Bucket { get; set; } = "";
    /// <summary>Để trống cả AccessKey và SecretKey thì dùng chuỗi thông tin xác thực mặc định của AWS (vai trò IAM, biến môi trường AWS_*).</summary>
    public string? AccessKey { get; set; }
    public string? SecretKey { get; set; }
    /// <summary>MinIO và hầu hết dịch vụ nội bộ cần địa chỉ dạng đường dẫn (<c>host/bucket/key</c>).</summary>
    public bool ForcePathStyle { get; set; } = true;
    /// <summary>Tiền tố thêm vào mọi khóa, ví dụ <c>hoso/</c>, để dùng chung bucket.</summary>
    public string Prefix { get; set; } = "";
    /// <summary>"AES256" hoặc "aws:kms" để bắt buộc mã hóa phía máy chủ khi ghi; trống nếu bucket đã mã hóa mặc định.</summary>
    public string? ServerSideEncryption { get; set; }
}

/// <summary>Dạng khóa tệp do hệ thống sinh: <c>blobs/ab/cd/&lt;sha256&gt;</c>. Dùng chung cho mọi kho để chuyển từ ổ đĩa sang S3 chỉ là chép tệp, không đổi khóa trong CSDL.</summary>
internal static class StorageKeys
{
    public static string For(string sha256) => $"blobs/{sha256[..2]}/{sha256[2..4]}/{sha256}";

    /// <summary>Chỉ nhận khóa đúng dạng; chặn đường dẫn kiểu ../ và mọi khóa lạ.</summary>
    public static string[] Parts(string storageKey)
    {
        var parts = storageKey.Split('/');
        if (parts is not ["blobs", { Length: 2 }, { Length: 2 }, { Length: 64 } name] || !name.All(Uri.IsHexDigit))
        {
            throw new ArgumentException("Khóa tệp không hợp lệ.", nameof(storageKey));
        }
        return parts;
    }
}

/// <summary>
/// Kho tệp trên ổ đĩa, địa chỉ theo nội dung (ADR-05). Ghi qua tệp tạm rồi đổi tên
/// để không bao giờ để lại tệp ghi dở ở vị trí chính thức.
/// </summary>
public sealed class LocalFileStorage(IOptions<StorageOptions> options, IHostEnvironment environment) : IFileStorage
{
    private readonly string _root = Path.GetFullPath(options.Value.Root, environment.ContentRootPath);

    public async Task<StoredFile> SaveAsync(Stream content, CancellationToken cancellationToken)
    {
        var tempDirectory = Path.Combine(_root, "tmp");
        Directory.CreateDirectory(tempDirectory);
        var tempPath = Path.Combine(tempDirectory, $"{Guid.NewGuid():N}.part");

        long size = 0;
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        try
        {
            await using (var target = new FileStream(tempPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true))
            {
                var buffer = new byte[81920];
                int read;
                while ((read = await content.ReadAsync(buffer, cancellationToken)) > 0)
                {
                    hash.AppendData(buffer, 0, read);
                    await target.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
                    size += read;
                }
            }

            var sha256 = Convert.ToHexStringLower(hash.GetHashAndReset());
            var key = StorageKeys.For(sha256);
            var finalPath = PathFor(key);
            if (File.Exists(finalPath))
            {
                File.Delete(tempPath);
                return new StoredFile(key, sha256, size, AlreadyExisted: true);
            }

            Directory.CreateDirectory(Path.GetDirectoryName(finalPath)!);
            File.Move(tempPath, finalPath);
            return new StoredFile(key, sha256, size, AlreadyExisted: false);
        }
        catch
        {
            if (File.Exists(tempPath)) File.Delete(tempPath);
            throw;
        }
    }

    /// <summary>
    /// BE-21. Xóa tệp ghi dở (tmp/*.part) cũ hơn <paramref name="olderThan"/>: tiến trình chết giữa lúc tải lên để lại chúng.
    /// Không bao giờ động tới blobs/ (tệp đã lưu chính thức).
    /// </summary>
    public int CleanTemp(TimeSpan olderThan, DateTimeOffset now)
    {
        var directory = Path.Combine(_root, "tmp");
        if (!Directory.Exists(directory)) return 0;
        var removed = 0;
        foreach (var file in Directory.EnumerateFiles(directory, "*.part"))
        {
            if (now - File.GetLastWriteTimeUtc(file) > olderThan)
            {
                try { File.Delete(file); removed++; } catch (IOException) { /* đang được ghi: để lần sau */ }
            }
        }
        return removed;
    }

    public Task<Stream> OpenReadAsync(string storageKey, CancellationToken cancellationToken)
    {
        Stream stream = new FileStream(PathFor(storageKey), FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);
        return Task.FromResult(stream);
    }

    public Task<bool> ExistsAsync(string storageKey, CancellationToken cancellationToken) =>
        Task.FromResult(File.Exists(PathFor(storageKey)));

    public Task<bool> DeleteAsync(string storageKey, CancellationToken cancellationToken)
    {
        var path = PathFor(storageKey);
        if (!File.Exists(path)) return Task.FromResult(false);
        File.Delete(path);
        return Task.FromResult(true);
    }

    /// <summary>Đường dẫn tệp tạm (đuôi .part nên StorageMaintenanceService dọn nếu tiến trình chết giữa chừng).</summary>
    public string TempPath(string name)
    {
        var directory = Path.Combine(_root, "tmp");
        Directory.CreateDirectory(directory);
        return Path.Combine(directory, name + ".part");
    }

    private string PathFor(string storageKey)
    {
        var parts = StorageKeys.Parts(storageKey);
        return Path.Combine(_root, parts[0], parts[1], parts[2], parts[3]);
    }
}
