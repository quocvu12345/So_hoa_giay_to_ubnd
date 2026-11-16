using System.Buffers.Binary;
using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Text;

namespace HoSoSo.Api.IntegrationTests.Support;

/// <summary>
/// Máy chủ clamd giả nói đúng giao thức INSTREAM (lệnh zINSTREAM\0, đoạn dữ liệu có tiền tố độ dài 4 byte big-endian, kết thúc bằng đoạn dài 0, trả lời kết thúc bằng \0).
/// Nhận ra chuỗi thử EICAR. Ghi lại vi phạm giao thức để test kiểm khách hàng nói đúng. Không thay ClamAV thật.
/// </summary>
public sealed class FakeClamd : IAsyncDisposable
{
    public const string EicarMarker = "EICAR-STANDARD-ANTIVIRUS-TEST-FILE";
    private readonly TcpListener _listener = new(IPAddress.Loopback, 0);
    private readonly CancellationTokenSource _stop = new();
    private readonly Task _loop;

    public int Port => ((IPEndPoint)_listener.LocalEndpoint).Port;
    public ConcurrentQueue<string> ProtocolViolations { get; } = new();
    public int Scans;
    public long LastBytes;
    public int LastChunks;
    /// <summary>Số byte tối đa nhận (mô phỏng StreamMaxLength của clamd); quá thì trả lỗi như clamd thật. 0 = không giới hạn.</summary>
    public long StreamMaxLength { get; set; }
    /// <summary>Làm máy quét "treo": nhận kết nối nhưng không trả lời.</summary>
    public bool Hang { get; set; }

    public FakeClamd()
    {
        _listener.Start();
        _loop = Task.Run(AcceptLoopAsync);
    }

    private async Task AcceptLoopAsync()
    {
        try
        {
            while (!_stop.IsCancellationRequested)
            {
                var client = await _listener.AcceptTcpClientAsync(_stop.Token);
                _ = Task.Run(() => HandleAsync(client));
            }
        }
        catch (OperationCanceledException) { }
    }

    private async Task HandleAsync(TcpClient client)
    {
        using (client)
        {
            try
            {
                var stream = client.GetStream();
                var command = new byte[10];
                await stream.ReadExactlyAsync(command, _stop.Token);
                if (Encoding.ASCII.GetString(command) != "zINSTREAM\0") ProtocolViolations.Enqueue("lệnh đầu không phải zINSTREAM\\0");
                var header = new byte[4];
                await stream.ReadExactlyAsync(header, _stop.Token);

                var total = new MemoryStream();
                var chunks = 0;
                while (true)
                {
                    var length = BinaryPrimitives.ReadUInt32BigEndian(header);
                    if (length == 0) break;
                    if (length > 1_000_000) { ProtocolViolations.Enqueue($"đoạn dài bất thường {length}"); return; }
                    var data = new byte[length];
                    await stream.ReadExactlyAsync(data, _stop.Token);
                    total.Write(data);
                    chunks++;
                    await stream.ReadExactlyAsync(header, _stop.Token);
                }
                Interlocked.Increment(ref Scans);
                LastBytes = total.Length;
                LastChunks = chunks;
                if (Hang) { await Task.Delay(Timeout.Infinite, _stop.Token); return; }

                string reply;
                if (StreamMaxLength > 0 && total.Length > StreamMaxLength) reply = "INSTREAM size limit exceeded. ERROR";
                else if (Encoding.Latin1.GetString(total.ToArray()).Contains(EicarMarker, StringComparison.Ordinal)) reply = "stream: Win.Test.EICAR_HDB-1 FOUND";
                else reply = "stream: OK";
                await stream.WriteAsync(Encoding.ASCII.GetBytes(reply + "\0"), _stop.Token);
            }
            catch (Exception e) when (e is IOException or OperationCanceledException or EndOfStreamException) { }
        }
    }

    public async ValueTask DisposeAsync()
    {
        await _stop.CancelAsync();
        _listener.Stop();
        try { await _loop; } catch (Exception) { /* đang tắt */ }
        _stop.Dispose();
    }
}
