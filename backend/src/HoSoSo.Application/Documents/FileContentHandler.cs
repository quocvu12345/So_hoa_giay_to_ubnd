using HoSoSo.Application.Common;
using HoSoSo.Application.Intake;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Documents;

public sealed record FileContent(Stream Stream, string FileName, string MediaType);

/// <summary>Mục đích mở tệp, quyết định quyền cần có và dòng nhật ký truy cập (action) được ghi.</summary>
public enum FilePurpose
{
    View,
    Download,
    /// <summary>In (BE-113): quyền <c>document.print</c> riêng, ghi action <c>print</c>.</summary>
    Print,
}

/// <summary>BE-43, BE-113. Mở tệp gốc cho giấy tờ trong phạm vi và ghi nhật ký truy cập (xem, tải hoặc in) trước khi trả nội dung.</summary>
public sealed class FileContentHandler(IHoSoDb db, IScopeFilter scope, IFileStorage storage, IAccessLog access, ICurrentUser user)
{
    public Task<FileContent> OpenAsync(Guid fileId, bool download, CancellationToken ct) => OpenAsync(fileId, download ? FilePurpose.Download : FilePurpose.View, ct);

    public async Task<FileContent> OpenAsync(Guid fileId, FilePurpose purpose, CancellationToken ct)
    {
        // Điểm vào /download nhận cả hai quyền (tải và in) nên phải kiểm lại đúng quyền của mục đích đã chọn: người chỉ có quyền in không được tải về.
        if (purpose == FilePurpose.Print && !user.Has(HoSoSo.Domain.Identity.Permissions.DocumentPrint))
            throw new AppException(403, ErrorCodes.Forbidden, "Phân công đang dùng không có quyền in.");
        if (purpose == FilePurpose.Download && !user.Has(HoSoSo.Domain.Identity.Permissions.DocumentDownload))
            throw new AppException(403, ErrorCodes.Forbidden, "Phân công đang dùng không có quyền tải tệp.");
        var download = purpose != FilePurpose.View;
        var file = await (from f in db.Read<FileRecord>()
                          join d in scope.Documents(db.Read<Document>()) on f.DocumentId equals d.Id
                          where f.Id == fileId select f).SingleOrDefaultAsync(ct) ?? throw AppException.NotFound("tệp");
        if (file.StorageKey is null) throw AppException.NotFound("nội dung tệp");
        if (!await storage.ExistsAsync(file.StorageKey, ct)) throw new AppException(404, ErrorCodes.NotFound, "Tệp có trong hồ sơ nhưng không còn trên kho lưu trữ. Báo quản trị để khôi phục từ bản sao lưu.");
        await access.RecordDurableAsync(purpose switch { FilePurpose.Print => "print", FilePurpose.Download => "download", _ => "view" }, "file", fileId, ct);
        return new FileContent(await storage.OpenReadAsync(file.StorageKey, ct), file.OriginalName, file.MediaType);
    }
}
