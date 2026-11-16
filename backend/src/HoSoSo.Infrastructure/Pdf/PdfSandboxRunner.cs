using System.ComponentModel;
using System.Diagnostics;
using System.Text.Json;
using HoSoSo.Application.Common;
using HoSoSo.Application.Documents;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HoSoSo.Infrastructure.Pdf;

/// <summary>
/// Mục "PdfSandbox" của cấu hình (BE-93). <c>Mode</c>: "Process" (mặc định, bắt buộc ở Production) chạy mã xử lý PDF trong tiến trình con có hạn giờ và bộ nhớ;
/// "InProcess" chạy ngay trong API (chỉ để phát triển và kiểm thử nhanh: một PDF độc hại có thể treo hay làm sập cả API).
/// </summary>
public sealed class PdfSandboxOptions
{
    public string Mode { get; set; } = "Process";
    /// <summary>Thời gian tối đa của một lệnh (đếm trang, cắt, đọc chữ ký, dựng ảnh một trang); quá thì giết tiến trình.</summary>
    public int TimeoutSeconds { get; set; } = 30;
    /// <summary>Bộ nhớ làm việc tối đa của tiến trình con (MB); quá thì giết. Kiểm mỗi 100 ms nên là rào chắn thô; Production nên thêm giới hạn của hệ điều hành (systemd MemoryMax).</summary>
    public int MaxMemoryMb { get; set; } = 1536;
    /// <summary>Số tiến trình con chạy cùng lúc; vượt thì chờ, chờ quá hạn thì báo bận (503).</summary>
    public int MaxConcurrency { get; set; } = 2;
    /// <summary>Dung lượng kết quả tối đa tiến trình con được trả (MB).</summary>
    public int MaxOutputMb { get; set; } = 64;
    /// <summary>Lệnh khởi chạy tiến trình con thay cho mặc định (ví dụ "systemd-run --scope -p MemoryMax=2G /opt/hoso/api/HoSoSo.Api"); tham số của lệnh được nối thêm vào sau. Dùng cho vận hành và kiểm thử.</summary>
    public string? Command { get; set; }

    public bool InProcess => string.Equals(Mode, "InProcess", StringComparison.OrdinalIgnoreCase);
}

/// <summary>
/// BE-93. Máy khách của sandbox PDF: chạy <c>HoSoSo.Api pdf-sandbox &lt;lệnh&gt;</c> trong tiến trình con, truyền PDF qua stdin, nhận kết quả qua stdout.
/// Cưỡng chế: hạn giờ, bộ nhớ làm việc, dung lượng kết quả, số tiến trình đồng thời; môi trường của con được lọc (không thừa hưởng chuỗi kết nối, bí mật OIDC,
/// khóa S3, khóa máy sao lưu). Tiến trình con bị giết thì ném <see cref="PdfLimitExceededException"/> (tệp được coi là vượt giới hạn xử lý), API vẫn khỏe.
/// </summary>
internal sealed class PdfSandboxRunner(IOptions<PdfSandboxOptions> options, ILogger<PdfSandboxRunner> logger) : IDisposable
{
    private static readonly HashSet<string> KeptVariables = new(StringComparer.Ordinal)
        { "PATH", "HOME", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "SYSTEMROOT", "USERPROFILE" };

    private readonly SemaphoreSlim _gate = new(Math.Max(1, options.Value.MaxConcurrency));

    public byte[] Run(string[] arguments, Stream input)
    {
        var o = options.Value;
        if (!_gate.Wait(TimeSpan.FromSeconds(o.TimeoutSeconds)))
            throw new AppException(503, "pdf_sandbox_busy", "Hệ thống đang xử lý nhiều PDF cùng lúc. Thử lại sau ít phút.");
        try { return RunCore(arguments, input, o); }
        finally { _gate.Release(); }
    }

    private byte[] RunCore(string[] arguments, Stream input, PdfSandboxOptions o)
    {
        var (file, prefix) = Launcher(o);
        var start = new ProcessStartInfo(file)
        {
            RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true,
        };
        foreach (var argument in prefix) start.ArgumentList.Add(argument);
        start.ArgumentList.Add("pdf-sandbox");
        foreach (var argument in arguments) start.ArgumentList.Add(argument);

        start.Environment.Clear();
        foreach (System.Collections.DictionaryEntry variable in Environment.GetEnvironmentVariables())
        {
            var name = (string)variable.Key;
            if ((KeptVariables.Contains(name) || name.StartsWith("DOTNET_", StringComparison.Ordinal)) && variable.Value is string value) start.Environment[name] = value;
        }
        start.Environment["DOTNET_NOLOGO"] = "1";
        start.Environment["DOTNET_CLI_TELEMETRY_OPTOUT"] = "1";
        start.Environment["DOTNET_GCHeapHardLimit"] = ((long)o.MaxMemoryMb * 1024 * 1024 * 3 / 4).ToString("X");   // heap được quản lý chiếm tối đa 3/4; còn lại cho mã gốc (PDFium)

        using var process = new Process { StartInfo = start };
        try { process.Start(); }
        catch (Exception e) when (e is Win32Exception or FileNotFoundException or InvalidOperationException)
        {
            logger.LogError(e, "pdf_sandbox_start_failed {File}", file);
            throw new AppException(503, "pdf_sandbox_unavailable", "Chưa khởi động được bộ xử lý PDF an toàn của hệ thống. Báo quản trị.");
        }

        var cap = (long)o.MaxOutputMb * 1024 * 1024;
        var overflow = false;
        var output = new MemoryStream();
        var outputTask = Task.Run(async () =>
        {
            var buffer = new byte[81920];
            int read;
            while ((read = await process.StandardOutput.BaseStream.ReadAsync(buffer)) > 0)
            {
                if (output.Length + read > cap) { overflow = true; return; }
                output.Write(buffer, 0, read);
            }
        });
        var errors = new MemoryStream();
        var errorTask = Task.Run(async () =>
        {
            var buffer = new byte[4096];
            int read;
            while ((read = await process.StandardError.BaseStream.ReadAsync(buffer)) > 0) if (errors.Length < 8192) errors.Write(buffer, 0, read);
        });
        Exception? inputError = null;
        var inputTask = Task.Run(async () =>
        {
            try { await input.CopyToAsync(process.StandardInput.BaseStream); }
            catch (IOException) { /* tiến trình con thoát sớm (đã có kết luận): bỏ qua */ }
            catch (Exception e) { inputError = e; }
            finally { try { process.StandardInput.Close(); } catch (IOException) { } }
        });

        var clock = Stopwatch.StartNew();
        string? killedFor = null;
        while (!process.WaitForExit(100))
        {
            if (clock.Elapsed > TimeSpan.FromSeconds(o.TimeoutSeconds)) killedFor = $"quá {o.TimeoutSeconds} giây";
            else if (overflow) killedFor = "kết quả quá lớn";
            else if (inputError is not null) killedFor = "không đọc được tệp nguồn";
            else
            {
                process.Refresh();
                if (process.WorkingSet64 > (long)o.MaxMemoryMb * 1024 * 1024) killedFor = $"dùng quá {o.MaxMemoryMb} MB bộ nhớ";
            }
            if (killedFor is not null)
            {
                try { process.Kill(entireProcessTree: true); } catch (InvalidOperationException) { /* vừa tự thoát */ }
                process.WaitForExit();
                break;
            }
        }
        Task.WaitAll([outputTask, errorTask, inputTask], TimeSpan.FromSeconds(5));
        if (inputError is not null && killedFor is "không đọc được tệp nguồn") throw inputError;     // lỗi đọc kho tệp là lỗi của hệ thống, không phải của tệp PDF

        if (killedFor is not null)
        {
            logger.LogWarning("pdf_sandbox_killed {Reason} {Command}", killedFor, arguments.FirstOrDefault());
            throw new PdfLimitExceededException($"PDF này quá phức tạp để xử lý an toàn ({killedFor}). Xuất lại tệp từ máy quét hoặc chia nhỏ rồi tải lại.");
        }

        var message = System.Text.Encoding.UTF8.GetString(errors.ToArray()).Trim();
        switch (process.ExitCode)
        {
            case 0:
                return output.ToArray();
            case 2:
                {
                    string kind = "invalid", text = "Không đọc được PDF này (tệp hỏng hoặc không đúng định dạng).";
                    try
                    {
                        using var json = JsonDocument.Parse(message);
                        kind = json.RootElement.GetProperty("kind").GetString() ?? kind;
                        text = json.RootElement.GetProperty("message").GetString() ?? text;
                    }
                    catch (JsonException) { /* giữ thông điệp mặc định */ }
                    throw kind == "limit" ? new PdfLimitExceededException(text) : new InvalidPdfException(text);
                }
            default:
                logger.LogWarning("pdf_sandbox_crashed {ExitCode} {Detail}", process.ExitCode, message.Length > 200 ? message[..200] : message);
                throw new InvalidPdfException("Không xử lý được PDF này (bộ xử lý PDF gặp lỗi). Xuất lại tệp rồi thử lại.");
        }
    }

    /// <summary>Lệnh khởi chạy: cấu hình PdfSandbox:Command nếu có; không thì tệp chạy của chính API cạnh DLL (apphost), hoặc `dotnet HoSoSo.Api.dll`.</summary>
    private static (string File, string[] Prefix) Launcher(PdfSandboxOptions o)
    {
        if (!string.IsNullOrWhiteSpace(o.Command))
        {
            var parts = SplitCommand(o.Command);
            return (parts[0], parts[1..]);
        }
        var directory = AppContext.BaseDirectory;
        var host = Path.Combine(directory, OperatingSystem.IsWindows() ? "HoSoSo.Api.exe" : "HoSoSo.Api");
        if (File.Exists(host)) return (host, []);
        return (Environment.GetEnvironmentVariable("DOTNET_HOST_PATH") is { Length: > 0 } dotnet ? dotnet : "dotnet", [Path.Combine(directory, "HoSoSo.Api.dll")]);
    }

    /// <summary>Tách dòng lệnh theo khoảng trắng, hiểu dấu nháy đơn và kép (không có shell nào ở giữa).</summary>
    internal static string[] SplitCommand(string command)
    {
        var parts = new List<string>();
        var current = new System.Text.StringBuilder();
        char? quote = null;
        var started = false;
        foreach (var c in command)
        {
            if (quote is { } q) { if (c == q) quote = null; else current.Append(c); }
            else if (c is '\'' or '"') { quote = c; started = true; }
            else if (char.IsWhiteSpace(c)) { if (started || current.Length > 0) { parts.Add(current.ToString()); current.Clear(); started = false; } }
            else current.Append(c);
        }
        if (started || current.Length > 0) parts.Add(current.ToString());
        return parts.ToArray();
    }

    public void Dispose() => _gate.Dispose();
}

/// <summary>BE-93. <see cref="IPdfTools"/> chạy trong tiến trình con có hạn giờ và bộ nhớ (xem <see cref="PdfSandboxRunner"/>).</summary>
internal sealed class SandboxedPdfTools(PdfSandboxRunner runner, IConfiguration configuration) : IPdfTools
{
    public int MaxPages => configuration.GetValue("Limits:MaxPdfPages", 500);

    private string[] WithLimit(params string[] arguments) => [.. arguments, "--max-pages", MaxPages.ToString()];

    public int CountPages(Stream pdf)
    {
        using var json = JsonDocument.Parse(runner.Run(WithLimit("count"), pdf));
        return json.RootElement.GetProperty("pages").GetInt32();
    }

    public byte[] ExtractPages(Stream pdf, int from, int to) => runner.Run(WithLimit("extract", from.ToString(), to.ToString()), pdf);

    public IReadOnlyList<PdfSignatureInfo> ReadSignatures(Stream pdf) =>
        JsonSerializer.Deserialize<List<PdfSignatureInfo>>(runner.Run(WithLimit("signatures"), pdf)) ?? [];
}

/// <summary>BE-93. <see cref="IPagePreviewRenderer"/> chạy PDFium trong tiến trình con.</summary>
internal sealed class SandboxedPreviewRenderer(PdfSandboxRunner runner) : IPagePreviewRenderer
{
    public byte[] RenderWebp(Stream pdf, int page, int width) => runner.Run(["render", page.ToString(), width.ToString()], pdf);
}
