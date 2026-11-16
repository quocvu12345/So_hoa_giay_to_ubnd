using HoSoSo.Application.Common;
using HoSoSo.Application.Intake;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Documents;

public sealed record FileContent(Stream Stream, string FileName, string MediaType);

/// <summary>BE-43. Mở tệp gốc cho giấy tờ trong phạm vi và ghi nhật ký truy cập (xem hoặc tải).</summary>
public sealed class FileContentHandler(IHoSoDb db, IScopeFilter scope, IFileStorage storage, IAccessLog access)
{
    public async Task<FileContent> OpenAsync(Guid fileId, bool download, CancellationToken ct)
    {
        var file = await (from f in db.Read<FileRecord>()
                          join d in scope.Documents(db.Read<Document>()) on f.DocumentId equals d.Id
                          where f.Id == fileId select f).SingleOrDefaultAsync(ct) ?? throw AppException.NotFound("tệp");
        if (file.StorageKey is null) throw AppException.NotFound("nội dung tệp");
        if (!await storage.ExistsAsync(file.StorageKey, ct)) throw new AppException(404, ErrorCodes.NotFound, "Tệp có trong hồ sơ nhưng không còn trên kho lưu trữ. Báo quản trị để khôi phục từ bản sao lưu.");
        await access.RecordDurableAsync(download ? "download" : "view", "file", fileId, ct);
        return new FileContent(await storage.OpenReadAsync(file.StorageKey, ct), file.OriginalName, file.MediaType);
    }
}
