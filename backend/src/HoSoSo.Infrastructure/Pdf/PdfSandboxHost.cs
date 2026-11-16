using System.Text.Json;
using HoSoSo.Application.Documents;
using Microsoft.Extensions.Configuration;

namespace HoSoSo.Infrastructure.Pdf;

/// <summary>
/// BE-93. Phía TIẾN TRÌNH CON của sandbox PDF: <c>HoSoSo.Api pdf-sandbox &lt;lệnh&gt; [--max-pages N]</c>. Đọc PDF từ stdin, ghi kết quả ra stdout, báo lỗi dạng
/// một dòng JSON ra stderr. Chạy mã phân tích PDF thật (PdfPig, PDFium) nên một tệp độc hại làm tiến trình này treo, tràn bộ nhớ hay sập thì chỉ mất tiến trình con;
/// API (máy khách: <see cref="PdfSandboxRunner"/>) giết nó đúng hạn.
/// Lệnh: <c>count</c> → {"pages":N} · <c>extract FROM TO</c> → PDF mới · <c>signatures</c> → JSON · <c>render PAGE WIDTH</c> → WebP.
/// Mã thoát: 0 đạt · 2 lỗi có cấu trúc ({"kind":"invalid"|"limit","message":...}) · 1 sự cố bất ngờ · 64 lệnh sai.
/// </summary>
public static class PdfSandboxHost
{
    public static async Task<int> RunAsync(string[] args, Stream input, Stream output, TextWriter error)
    {
        var arguments = args.ToList();
        var maxPages = 500;
        if (arguments.IndexOf("--max-pages") is var at and >= 0 && at + 1 < arguments.Count && int.TryParse(arguments[at + 1], out var parsed))
        {
            maxPages = parsed;
            arguments.RemoveRange(at, 2);
        }
        if (arguments.Count == 0) { error.WriteLine("thiếu lệnh"); return 64; }

        try
        {
            var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Limits:MaxPdfPages"] = maxPages.ToString() }).Build();
            var tools = new PdfTools(configuration);
            using var pdf = new MemoryStream();
            await input.CopyToAsync(pdf);
            pdf.Position = 0;

            switch (arguments[0])
            {
                case "count" when arguments.Count == 1:
                    await JsonSerializer.SerializeAsync(output, new { pages = tools.CountPages(pdf) });
                    break;
                case "extract" when arguments.Count == 3:
                    await output.WriteAsync(tools.ExtractPages(pdf, int.Parse(arguments[1]), int.Parse(arguments[2])));
                    break;
                case "signatures" when arguments.Count == 1:
                    await JsonSerializer.SerializeAsync(output, tools.ReadSignatures(pdf));
                    break;
                case "render" when arguments.Count == 3:
                    await output.WriteAsync(new PdfiumPreviewRenderer().RenderWebp(pdf, int.Parse(arguments[1]), int.Parse(arguments[2])));
                    break;
                default:
                    error.WriteLine("lệnh không hợp lệ");
                    return 64;
            }
            await output.FlushAsync();
            return 0;
        }
        catch (PdfLimitExceededException exception) { error.WriteLine(Json("limit", exception.Message)); return 2; }
        catch (InvalidPdfException exception) { error.WriteLine(Json("invalid", exception.Message)); return 2; }
        catch (Exception exception)
        {
            // Chỉ ghi loại lỗi: thông điệp có thể chứa một phần nội dung tệp.
            error.WriteLine(Json("crash", exception.GetType().Name));
            return 1;
        }
    }

    private static string Json(string kind, string message) => JsonSerializer.Serialize(new { kind, message });
}
