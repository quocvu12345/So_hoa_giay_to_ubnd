using HoSoSo.Application.Common;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Documents;

/// <summary>
/// BE-126. Một giấy tờ có thể có nhiều bản quét (bản gốc, các bản thay thế nối thành chuỗi qua <c>replaces_file_id</c>).
/// Bản HIỆN HÀNH là bản quét chưa bị bản nào thay. Mọi chỗ cần "bản quét của giấy tờ" (chi tiết, đối chiếu, tách, hộp tiếp nhận) dùng định nghĩa này.
/// </summary>
public static class DocumentFiles
{
    public const string Scan = "scan";

    /// <summary>Các bản quét chưa bị thay (mỗi giấy tờ một bản, trừ dữ liệu cũ lỗi).</summary>
    public static IQueryable<FileRecord> CurrentScans(IQueryable<FileRecord> files) =>
        files.Where(f => f.FileRole == Scan && !files.Any(n => n.ReplacesFileId == f.Id));

    /// <summary>Mã bản quét hiện hành của giấy tờ, hoặc null nếu giấy tờ không có bản quét.</summary>
    public static Task<Guid?> CurrentScanIdAsync(IHoSoDb db, Guid documentId, CancellationToken ct) =>
        CurrentScans(db.Read<FileRecord>()).Where(f => f.DocumentId == documentId)
            .OrderByDescending(f => f.VersionNo).Select(f => (Guid?)f.Id).FirstOrDefaultAsync(ct);
}

/// <summary>Khi nào giấy tờ không sửa được (dữ liệu, đầu văn bản, bản quét). Quyền <c>document.edit</c> kiểm riêng ở nơi gọi.</summary>
internal static class DocumentEditRules
{
    public static readonly string[] EditableDossierStatuses = ["draft", "returned"];

    public static async Task<string?> LockReasonAsync(IHoSoDb db, Guid id, string origin, string intakeStatus, CancellationToken ct)
    {
        if (origin == "public_source") return "Văn bản công khai lấy từ nguồn chính thức, không sửa tại đây.";
        if (intakeStatus is IntakeStatus.Discarded or IntakeStatus.Split) return "Giấy tờ đã bị bỏ hoặc đã tách.";
        var locked = await (from l in db.Read<DossierDocument>()
                            join d in db.Read<Dossier>() on l.DossierId equals d.Id
                            where l.DocumentId == id && !EditableDossierStatuses.Contains(d.Status)
                            select d.Code).FirstOrDefaultAsync(ct);
        return locked is null ? null : $"Giấy tờ đang nằm trong hồ sơ {locked} ở bước chờ xử lý nên không sửa được.";
    }
}
