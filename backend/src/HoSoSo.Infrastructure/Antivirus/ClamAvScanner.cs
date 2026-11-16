using System.Buffers.Binary;
using System.Net.Sockets;
using System.Text;
using HoSoSo.Application.Intake;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HoSoSo.Infrastructure.Antivirus;

/// <summary>Mục "Antivirus" của cấu hình (SEC-05). Tắt mặc định vì cần cài ClamAV (clamd) trong mạng nội bộ.</summary>
public sealed class AntivirusOptions
{
    public bool Enabled { get; set; }
    public string Host { get; set; } = "127.0.0.1";
    public int Port { get; set; } = 3310;
    /// <summary>Tổng thời gian tối đa cho một lần quét (kết nối, gửi tệp, nhận kết quả).</summary>
    public int TimeoutSeconds { get; set; } = 60;
    /// <summary>true = máy quét hỏng thì vẫn nhận tệp (ghi cảnh báo). Mặc định false: không quét được thì không nhận, để mã độc không lọt qua lúc máy quét sập.</summary>
    public bool FailOpen { get; set; }
}

/// <summary>
/// Quét bằng ClamAV qua giao thức <c>INSTREAM</c> của clamd (TCP): gửi lệnh <c>zINSTREAM\0</c>, rồi từng đoạn "độ dài 4 byte (big-endian) + dữ liệu",
/// kết thúc bằng đoạn dài 0; clamd trả "stream: OK" hoặc "stream: &lt;tên&gt; FOUND" hoặc "... ERROR".
/// Lưu ý cấu hình clamd: <c>StreamMaxLength</c> phải không nhỏ hơn giới hạn tải lên (<c>Limits:UploadMaxBytes</c>), nếu không tệp lớn bị clamd từ chối (tính là máy quét lỗi).
/// </summary>
public sealed class ClamAvScanner(IOptions<AntivirusOptions> options, ILogger<ClamAvScanner> logger) : IVirusScanner
{
    private const int ChunkBytes = 64 * 1024;

    public bool Enabled => options.Value.Enabled;
    public bool FailOpen => options.Value.FailOpen;

    public async Task<VirusScanResult> ScanAsync(Stream content, CancellationToken cancellationToken)
    {
        if (!Enabled) return VirusScanResult.Ok;
        var o = options.Value;
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, o.TimeoutSeconds)));
        try
        {
            using var client = new TcpClient();
            await client.ConnectAsync(o.Host, o.Port, timeout.Token);
            await using var network = client.GetStream();

            await network.WriteAsync("zINSTREAM\0"u8.ToArray(), timeout.Token);
            var buffer = new byte[4 + ChunkBytes];
            int read;
            while ((read = await content.ReadAsync(buffer.AsMemory(4, ChunkBytes), timeout.Token)) > 0)
            {
                BinaryPrimitives.WriteUInt32BigEndian(buffer, (uint)read);
                await network.WriteAsync(buffer.AsMemory(0, 4 + read), timeout.Token);
            }
            await network.WriteAsync(new byte[4], timeout.Token);          // đoạn dài 0: hết dữ liệu
            await network.FlushAsync(timeout.Token);

            using var reply = new MemoryStream();
            var one = new byte[1];
            while (reply.Length < 4096 && await network.ReadAsync(one, timeout.Token) == 1 && one[0] != 0 && one[0] != (byte)'\n') reply.WriteByte(one[0]);
            return Parse(Encoding.UTF8.GetString(reply.ToArray()).Trim());
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning("antivirus_timeout {Seconds}", o.TimeoutSeconds);
            return VirusScanResult.Failed("máy quét không trả lời kịp");
        }
        catch (Exception exception) when (exception is IOException or SocketException or InvalidOperationException)
        {
            logger.LogWarning(exception, "antivirus_unreachable {Host} {Port}", o.Host, o.Port);
            return VirusScanResult.Failed("không kết nối được máy quét");
        }
    }

    /// <summary>"stream: OK" · "stream: Win.Test.EICAR_HDB-1 FOUND" · "INSTREAM size limit exceeded. ERROR" · "...".</summary>
    internal static VirusScanResult Parse(string reply)
    {
        if (reply.EndsWith(" FOUND", StringComparison.Ordinal))
        {
            var name = reply[..^" FOUND".Length];
            var colon = name.IndexOf(':');
            return VirusScanResult.Infected((colon >= 0 ? name[(colon + 1)..] : name).Trim());
        }
        if (reply.EndsWith(" OK", StringComparison.Ordinal) || reply == "OK") return VirusScanResult.Ok;
        return VirusScanResult.Failed(reply.Length == 0 ? "máy quét không trả kết quả" : "máy quét báo lỗi: " + (reply.Length > 120 ? reply[..120] : reply));
    }
}
