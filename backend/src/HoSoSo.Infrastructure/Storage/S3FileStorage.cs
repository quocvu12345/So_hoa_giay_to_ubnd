using System.Net;
using System.Security.Cryptography;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Amazon.S3.Transfer;
using HoSoSo.Application.Intake;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace HoSoSo.Infrastructure.Storage;

/// <summary>Kho tệp có thể kiểm tra "ghi được" (dùng cho /health/ready).</summary>
internal interface IStorageProbe
{
    Task ProbeAsync(CancellationToken cancellationToken);
}

/// <summary>
/// BE-21. Kho tệp trên S3 hoặc dịch vụ tương thích (MinIO), chọn bằng <c>Storage:Provider=S3</c>.
/// Cùng quy ước với kho ổ đĩa: địa chỉ theo nội dung, khóa <c>blobs/ab/cd/&lt;sha256&gt;</c> (nên chuyển giữa hai kho chỉ là chép tệp, không đổi khóa trong CSDL),
/// ghi cùng nội dung hai lần thì lần hai <c>AlreadyExisted</c>, khóa lạ bị từ chối, thiếu tệp thì ném <see cref="FileNotFoundException"/>.
/// Luồng tải lên được ghi tạm xuống ổ đĩa (thư mục <c>Storage:Root/tmp</c>) để tính SHA-256 trước khi biết khóa; tệp lớn được gửi theo từng phần (multipart).
/// </summary>
public sealed class S3FileStorage : IFileStorage, IStorageProbe, IDisposable
{
    private readonly IAmazonS3 _s3;
    private readonly string _bucket;
    private readonly string _prefix;
    private readonly string _tempDirectory;
    private readonly ServerSideEncryptionMethod? _encryption;

    public S3FileStorage(IOptions<StorageOptions> options, IHostEnvironment environment)
        : this(CreateClient(options.Value.S3), options.Value.S3, Path.Combine(Path.GetFullPath(options.Value.Root, environment.ContentRootPath), "tmp"))
    {
    }

    internal S3FileStorage(IAmazonS3 s3, S3Options options, string tempDirectory)
    {
        if (string.IsNullOrWhiteSpace(options.Bucket)) throw new InvalidOperationException("Storage:S3:Bucket không được để trống khi Storage:Provider=S3.");
        _s3 = s3;
        _bucket = options.Bucket;
        _prefix = options.Prefix.Trim('/') is { Length: > 0 } p ? p + "/" : "";
        _tempDirectory = tempDirectory;
        _encryption = string.IsNullOrWhiteSpace(options.ServerSideEncryption) ? null : new ServerSideEncryptionMethod(options.ServerSideEncryption);
    }

    private static AmazonS3Client CreateClient(S3Options o)
    {
        var config = new AmazonS3Config
        {
            ForcePathStyle = o.ForcePathStyle,
            // Một số dịch vụ tương thích S3 chưa hiểu các tổng kiểm (checksum) tự động của SDK mới: chỉ tính khi giao thức bắt buộc.
            RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
            ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED,
        };
        if (!string.IsNullOrWhiteSpace(o.ServiceUrl))
        {
            config.ServiceURL = o.ServiceUrl;
            config.AuthenticationRegion = o.Region;
        }
        else
        {
            config.RegionEndpoint = Amazon.RegionEndpoint.GetBySystemName(o.Region);
        }
        return !string.IsNullOrEmpty(o.AccessKey) && !string.IsNullOrEmpty(o.SecretKey)
            ? new AmazonS3Client(new BasicAWSCredentials(o.AccessKey, o.SecretKey), config)
            : new AmazonS3Client(config);     // chuỗi thông tin xác thực mặc định (vai trò IAM, biến môi trường AWS_*)
    }

    private string ObjectKey(string storageKey)
    {
        StorageKeys.Parts(storageKey);        // chặn khóa lạ trước khi gửi đi đâu
        return _prefix + storageKey;
    }

    public async Task<StoredFile> SaveAsync(Stream content, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(_tempDirectory);
        var tempPath = Path.Combine(_tempDirectory, $"{Guid.NewGuid():N}.part");
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
            if (await HeadAsync(key, cancellationToken) is not null)
                return new StoredFile(key, sha256, size, AlreadyExisted: true);

            var request = new TransferUtilityUploadRequest
            {
                BucketName = _bucket, Key = ObjectKey(key), FilePath = tempPath, ContentType = "application/octet-stream",
            };
            request.Metadata["sha256"] = sha256;
            if (_encryption is not null) request.ServerSideEncryptionMethod = _encryption;
            using (var transfer = new TransferUtility(_s3)) await transfer.UploadAsync(request, cancellationToken);
            return new StoredFile(key, sha256, size, AlreadyExisted: false);
        }
        finally
        {
            if (File.Exists(tempPath)) File.Delete(tempPath);
        }
    }

    public async Task<Stream> OpenReadAsync(string storageKey, CancellationToken cancellationToken)
    {
        var length = await HeadAsync(storageKey, cancellationToken) ?? throw new FileNotFoundException("Không có tệp trong kho S3.", storageKey);
        return new S3ReadStream(_s3, _bucket, ObjectKey(storageKey), length);
    }

    public async Task<bool> ExistsAsync(string storageKey, CancellationToken cancellationToken) =>
        await HeadAsync(storageKey, cancellationToken) is not null;

    public async Task<bool> DeleteAsync(string storageKey, CancellationToken cancellationToken)
    {
        if (await HeadAsync(storageKey, cancellationToken) is null) return false;
        await _s3.DeleteObjectAsync(_bucket, ObjectKey(storageKey), cancellationToken);
        return true;
    }

    /// <summary>Kích thước đối tượng, hoặc null nếu không có.</summary>
    private async Task<long?> HeadAsync(string storageKey, CancellationToken cancellationToken)
    {
        try
        {
            var meta = await _s3.GetObjectMetadataAsync(_bucket, ObjectKey(storageKey), cancellationToken);
            return meta.ContentLength;
        }
        catch (AmazonS3Exception e) when (e.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    /// <summary>Ghi rồi xóa một đối tượng nhỏ để biết bucket còn ghi được và khóa truy cập còn hiệu lực.</summary>
    public async Task ProbeAsync(CancellationToken cancellationToken)
    {
        var key = $"{_prefix}health/probe-{Guid.NewGuid():N}";
        await _s3.PutObjectAsync(new PutObjectRequest { BucketName = _bucket, Key = key, ContentBody = "ok" }, cancellationToken);
        await _s3.DeleteObjectAsync(_bucket, key, cancellationToken);
    }

    public void Dispose() => _s3.Dispose();
}

/// <summary>
/// Luồng đọc đối tượng S3 theo từng đoạn byte (HTTP Range), cho phép tua. Cần vì <c>TypedResults.File(enableRangeProcessing: true)</c>,
/// trình đọc PDF và ZIP đều đòi luồng tua được, còn luồng trả về của S3 chỉ đọc tuần tự.
/// Mỗi lần chỉ giữ một đoạn (mặc định 1 MiB) trong bộ nhớ nên đọc tệp lớn không tốn RAM theo kích thước tệp.
/// Đọc đồng bộ (Read) chạy chờ trên tác vụ bất đồng bộ; code của hệ thống dùng ReadAsync.
/// </summary>
internal sealed class S3ReadStream(IAmazonS3 s3, string bucket, string key, long length) : Stream
{
    private const int MinChunk = 1 << 20;
    private const int MaxChunk = 8 << 20;
    private long _position;
    private byte[]? _chunk;
    private long _chunkStart;
    private int _chunkLength;

    public override bool CanRead => true;
    public override bool CanSeek => true;
    public override bool CanWrite => false;
    public override long Length => length;

    public override long Position
    {
        get => _position;
        set => _position = value >= 0 ? value : throw new ArgumentOutOfRangeException(nameof(value));
    }

    public override long Seek(long offset, SeekOrigin origin)
    {
        var target = origin switch
        {
            SeekOrigin.Begin => offset,
            SeekOrigin.Current => _position + offset,
            SeekOrigin.End => length + offset,
            _ => throw new ArgumentOutOfRangeException(nameof(origin)),
        };
        if (target < 0) throw new IOException("Không tua được tới trước đầu tệp.");
        return _position = target;
    }

    /// <summary>Bảo đảm đoạn đang giữ phủ vị trí hiện tại; trả số byte đọc được ngay từ vị trí đó (tối đa <paramref name="wanted"/>), 0 nếu hết tệp.</summary>
    private async ValueTask<int> FillAsync(int wanted, CancellationToken cancellationToken)
    {
        if (wanted == 0 || _position >= length) return 0;
        if (_chunk is null || _position < _chunkStart || _position >= _chunkStart + _chunkLength)
        {
            var size = (int)Math.Min(Math.Clamp(wanted, MinChunk, MaxChunk), length - _position);
            using var response = await s3.GetObjectAsync(new GetObjectRequest
            {
                BucketName = bucket, Key = key, ByteRange = new ByteRange(_position, _position + size - 1),
            }, cancellationToken);
            var buffer = new byte[size];
            var filled = 0;
            while (filled < size)
            {
                var n = await response.ResponseStream.ReadAsync(buffer.AsMemory(filled), cancellationToken);
                if (n == 0) break;
                filled += n;
            }
            if (filled == 0) return 0;
            (_chunk, _chunkStart, _chunkLength) = (buffer, _position, filled);
        }
        return Math.Min(wanted, _chunkLength - (int)(_position - _chunkStart));
    }

    public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
    {
        var available = await FillAsync(buffer.Length, cancellationToken);
        if (available == 0) return 0;
        _chunk.AsMemory((int)(_position - _chunkStart), available).CopyTo(buffer);
        _position += available;
        return available;
    }

    public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken) =>
        ReadAsync(buffer.AsMemory(offset, count), cancellationToken).AsTask();

    public override int Read(byte[] buffer, int offset, int count) =>
        ReadAsync(buffer.AsMemory(offset, count), CancellationToken.None).AsTask().GetAwaiter().GetResult();

    public override int Read(Span<byte> buffer)
    {
        var temp = new byte[buffer.Length];
        var n = Read(temp, 0, temp.Length);
        temp.AsSpan(0, n).CopyTo(buffer);
        return n;
    }

    public override void Flush() { }
    public override void SetLength(long value) => throw new NotSupportedException();
    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

    protected override void Dispose(bool disposing)
    {
        if (disposing) _chunk = null;
        base.Dispose(disposing);
    }
}
