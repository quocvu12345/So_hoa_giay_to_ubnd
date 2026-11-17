using System.Security.Cryptography;
using HoSoSo.Application.Common;
using HoSoSo.Application.Intake;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Documents;

/// <summary>Dựng ảnh một trang PDF thành WebP. Phân tích PDF là bề mặt tấn công nên triển khai chạy có giới hạn đồng thời và thời gian.</summary>
public interface IPagePreviewRenderer
{
    /// <summary>Trang <paramref name="page"/> (từ 1) rộng <paramref name="width"/> điểm ảnh. Ném InvalidPdfException khi tệp hoặc trang không dựng được.</summary>
    byte[] RenderWebp(Stream pdf, int page, int width);
}

public sealed record PagePreview(Stream Content, string ETag);

/// <summary>
/// BE-43. Ảnh xem trước một trang (thumbnail và trang đang xem). Chỉ bản rộng mặc định (800) được lưu vào kho tệp và ghi nhận ở
/// <c>page_images.preview_storage_key</c> (khóa là mã băm nội dung nên dùng chung được); các bề rộng khác dựng theo yêu cầu, không lưu.
/// Phạm vi xem kiểm như tải tệp; chỉ ghi nhật ký truy cập khi xem trang cỡ đọc (≥ 600 px), không ghi từng thumbnail.
/// </summary>
public sealed class PreviewHandler(IHoSoDb db, IScopeFilter scope, IFileStorage storage, IPagePreviewRenderer renderer, IPdfTools pdfTools, IAccessLog access)
{
    public const int DefaultWidth = 800, MinWidth = 120, MaxWidth = 1600, ReadingWidth = 600;
    private static readonly SemaphoreSlim Gate = new(2);   // dựng ảnh tốn CPU/RAM: tối đa 2 trang cùng lúc mỗi instance

    public async Task<PagePreview> GetAsync(Guid fileId, int page, int? width, CancellationToken ct)
    {
        var w = Math.Clamp(width ?? DefaultWidth, MinWidth, MaxWidth);
        if (page < 1) throw new ValidationFailedException(new Dictionary<string, string[]> { ["page"] = ["Số trang bắt đầu từ 1."] });
        var file = await (from f in db.Read<FileRecord>()
                          join d in scope.Documents(db.Read<Document>()) on f.DocumentId equals d.Id
                          where f.Id == fileId select f).SingleOrDefaultAsync(ct) ?? throw AppException.NotFound("tệp");
        if (file.StorageKey is null) throw AppException.NotFound("nội dung tệp");
        if (file.MediaType != "application/pdf") throw new AppException(422, "preview_unsupported", "Chỉ xem trước được tệp PDF.");
        // Tệp mới tải lên chưa có số trang (worker điền sau): đếm để trang không có trả 404 thay vì "không dựng được".
        var pages = file.PageCount;
        if (pages is null)
        {
            try
            {
                await using var counting = await storage.OpenReadAsync(file.StorageKey, ct);
                pages = pdfTools.CountPages(counting);
            }
            catch (InvalidPdfException) { /* tệp hỏng: để bước dựng ảnh báo lỗi rõ hơn */ }
        }
        if (pages is { } count && page > count) throw AppException.NotFound("trang");

        if (w >= ReadingWidth) await access.RecordDurableAsync("view", "file", fileId, ct);

        if (w == DefaultWidth)
        {
            var cached = await db.Read<PageImage>().Where(p => p.FileId == fileId && p.PageNo == page).Select(p => p.PreviewStorageKey).SingleOrDefaultAsync(ct);
            if (cached is not null && await storage.ExistsAsync(cached, ct)) return new PagePreview(await storage.OpenReadAsync(cached, ct), ETag(cached));
        }

        byte[] bytes;
        await Gate.WaitAsync(ct);
        try
        {
            await using var pdf = await storage.OpenReadAsync(file.StorageKey, ct);
            bytes = await Task.Run(() => renderer.RenderWebp(pdf, page, w), ct);
        }
        catch (InvalidPdfException e)
        {
            throw new AppException(422, "preview_failed", $"Không dựng được ảnh trang {page}: {e.Message}");
        }
        finally { Gate.Release(); }

        if (w != DefaultWidth)
            return new PagePreview(new MemoryStream(bytes), "\"" + Convert.ToHexStringLower(SHA256.HashData(bytes)) + "\"");

        // Hủy hồ sơ cũng khóa dòng tệp: không tạo cache sau khi nội dung đã bị chặn.
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var available = await db.Database.SqlQuery<Guid>($"SELECT id AS \"Value\" FROM hoso.files WHERE id = {fileId} AND disposed_at IS NULL AND storage_key IS NOT NULL FOR UPDATE").ToListAsync(ct);
        if (available.Count == 0) throw AppException.NotFound("nội dung tệp");
        await using var content = new MemoryStream(bytes);
        var stored = await storage.SaveAsync(content, ct);
        if (w == DefaultWidth)
            await db.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO hoso.page_images(file_id, page_no, preview_storage_key) VALUES ({fileId}, {page}, {stored.StorageKey})
                ON CONFLICT (file_id, page_no) DO UPDATE SET preview_storage_key = EXCLUDED.preview_storage_key
                """, ct);
        await transaction.CommitAsync(ct);
        return new PagePreview(new MemoryStream(bytes), ETag(stored.StorageKey));
    }

    private static string ETag(string storageKey) => "\"" + storageKey[(storageKey.LastIndexOf('/') + 1)..] + "\"";
}
