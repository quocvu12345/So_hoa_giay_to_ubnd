using System.Text.Json;
using FluentValidation;
using HoSoSo.Application.Common;
using HoSoSo.Application.Intake;
using HoSoSo.Domain.Entities;
using HoSoSo.Domain.Identity;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Operations;

public sealed record CreateExportRequest(IReadOnlyList<Guid>? DossierIds, string? Status, string? WorkGroupCode, DateOnly? ArchivedFrom, DateOnly? ArchivedTo, string? Format);
public sealed record ExportDto(Guid Id, string Status, string Format, int TotalItems, int ProcessedItems, long? ByteSize, string? ManifestSha256,
    DateTimeOffset CreatedAt, DateTimeOffset? ReadyAt, DateTimeOffset? ExpiresAt, string? Error);
public sealed record ExportFile(Stream Content, string FileName, long ByteSize);

/// <summary>
/// BE-86. Gói xuất để bàn giao: người dùng chọn hồ sơ (hoặc điều kiện lọc), hệ thống chốt danh sách hồ sơ trong phạm vi của họ rồi giao cho ExportWorker
/// đóng ZIP nền theo luồng (PDF, metadata.json, danh-muc.csv, manifest.sha256). Gói giữ 7 ngày; chỉ người yêu cầu tải được.
/// BE-91: quyền được kiểm lại MỖI LẦN tải (không chỉ lúc tạo): còn quyền tải tài liệu, đang dùng đúng phân công đã tạo gói, và mọi hồ sơ trong gói còn
/// trong phạm vi. Mất phạm vi thì gói bị thu hồi (410), nội dung bị xóa; kết thúc phân công, thu hồi ủy quyền, khóa tài khoản cũng thu hồi gói (AdminHandler).
/// </summary>
public sealed class ExportHandler(IHoSoDb db, IScopeFilter scope, ICurrentUser user, IClock clock, IFileStorage storage, IAccessLog access)
{
    public const int MaxDossiers = 2000;
    public static readonly string[] Formats = ["zip_pdf_json", "zip_pdf_csv"];
    private static readonly TimeSpan Vietnam = TimeSpan.FromHours(7);

    public async Task<ExportDto> CreateAsync(CreateExportRequest r, CancellationToken ct)
    {
        var me = user.RequireUserId();
        if (!user.Has(Permissions.DocumentDownload))
            throw new AppException(403, ErrorCodes.Forbidden, "Phân công đang dùng không có quyền tải tài liệu nên không xuất gói được.");

        var query = scope.Dossiers(db.Read<Dossier>());
        if (r.DossierIds is { Count: > 0 })
        {
            var wanted = r.DossierIds.Distinct().ToList();
            var found = await query.Where(d => wanted.Contains(d.Id)).Select(d => d.Id).ToListAsync(ct);
            if (found.Count != wanted.Count) throw AppException.NotFound("hồ sơ");   // gồm cả hồ sơ ngoài phạm vi: không để lộ là có tồn tại
            query = query.Where(d => wanted.Contains(d.Id));
        }
        if (r.Status is { Length: > 0 }) query = query.Where(d => d.Status == r.Status);
        if (r.WorkGroupCode is { Length: > 0 }) query = query.Where(d => d.WorkGroupCode == r.WorkGroupCode);
        // Npgsql chỉ nhận thời điểm có offset 0 nên đổi ngày (giờ Việt Nam) sang UTC.
        if (r.ArchivedFrom is { } from) { var start = new DateTimeOffset(from.ToDateTime(TimeOnly.MinValue), Vietnam).ToUniversalTime(); query = query.Where(d => d.ArchivedAt >= start); }
        if (r.ArchivedTo is { } to) { var end = new DateTimeOffset(to.AddDays(1).ToDateTime(TimeOnly.MinValue), Vietnam).ToUniversalTime(); query = query.Where(d => d.ArchivedAt < end); }

        var ids = await query.OrderBy(d => d.Code).Select(d => d.Id).Take(MaxDossiers + 1).ToListAsync(ct);
        if (ids.Count == 0) throw new AppException(422, "export_empty", "Không có hồ sơ nào khớp điều kiện trong phạm vi của bạn.");
        if (ids.Count > MaxDossiers) throw new AppException(422, "export_too_large", $"Quá {MaxDossiers} hồ sơ trong một gói. Thu hẹp điều kiện (nhóm công việc, thời gian lưu trữ) rồi xuất từng phần.");

        var package = new ExportPackage
        {
            RequestedBy = me, RequestedAssignment = user.ActiveAssignmentId, Format = r.Format ?? Formats[0], TotalItems = ids.Count,
            // Chốt danh sách ở lúc yêu cầu: phạm vi của người yêu cầu được kiểm một lần, worker không phải đoán quyền.
            Scope = JsonSerializer.Serialize(new { dossierIds = ids, filter = new { r.Status, r.WorkGroupCode, r.ArchivedFrom, r.ArchivedTo }, organization = user.OrganizationCode, role = user.Role }),
        };
        db.Set<ExportPackage>().Add(package);
        await db.SaveChangesAsync(ct);
        await access.RecordDurableAsync("export", "export_package", package.Id, ct);
        return ToDto(package);
    }

    public async Task<ExportDto> GetAsync(Guid id, CancellationToken ct) => ToDto(await OwnAsync(id, ct));

    public async Task<IReadOnlyList<ExportDto>> ListAsync(CancellationToken ct)
    {
        var me = user.RequireUserId();
        var rows = await db.Read<ExportPackage>().Where(p => p.RequestedBy == me).OrderByDescending(p => p.CreatedAt).Take(20).ToListAsync(ct);
        return rows.Select(ToDto).ToList();
    }

    public async Task<ExportFile> OpenAsync(Guid id, CancellationToken ct)
    {
        var p = await OwnAsync(id, ct);
        if (p.Status == "revoked")
            throw new AppException(410, "export_revoked", "Gói xuất đã bị thu hồi vì quyền truy cập thay đổi. Tạo gói mới nếu bạn vẫn có quyền.");
        if (p.Status == "expired" || (p.Status == "ready" && p.ExpiresAt <= clock.UtcNow))
            throw new AppException(410, "export_expired", "Gói xuất đã hết hạn (giữ 7 ngày). Tạo gói mới.");
        if (p.Status != "ready") throw AppException.Conflict(p.Status == "failed" ? "Gói xuất bị lỗi, không có tệp để tải." : "Gói xuất chưa xong. Chờ báo hoàn tất rồi tải.");
        await RequireStillAllowedAsync(p, ct);
        if (!await storage.ExistsAsync(p.StorageKey!, ct))
            throw new AppException(404, ErrorCodes.NotFound, "Gói xuất không còn trên kho lưu trữ. Tạo lại gói mới.");
        await access.RecordDurableAsync("export", "export_package", p.Id, ct);
        return new ExportFile(await storage.OpenReadAsync(p.StorageKey!, ct), $"goi-ban-giao-{p.CreatedAt.ToOffset(Vietnam):yyyyMMdd-HHmm}.zip", p.ByteSize ?? 0);
    }

    /// <summary>BE-91. Kiểm lại quyền ở thời điểm tải. Không đạt do đổi phân công thì chỉ từ chối (chọn lại là tải được); mất phạm vi hồ sơ thì thu hồi gói.</summary>
    private async Task RequireStillAllowedAsync(ExportPackage p, CancellationToken ct)
    {
        if (!user.Has(Permissions.DocumentDownload))
            throw new AppException(403, ErrorCodes.Forbidden, "Phân công đang dùng không còn quyền tải tài liệu nên không tải được gói xuất.");
        if (p.RequestedAssignment is { } created && created != user.ActiveAssignmentId)
            throw new AppException(403, "export_wrong_assignment", "Gói này được tạo bằng một phân công khác. Chọn lại phân công đã dùng khi tạo gói rồi tải.");

        var ids = DossierIds(p);
        var visible = ids.Count == 0 ? 0 : await scope.Dossiers(db.Read<Dossier>()).CountAsync(d => ids.Contains(d.Id), ct);
        if (visible == ids.Count) return;

        await db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE hoso.export_packages SET status = 'revoked', error_message = 'Phạm vi truy cập đã thay đổi: có hồ sơ trong gói không còn trong phạm vi của người yêu cầu.' WHERE id = {p.Id} AND status IN ('queued','running','ready')", ct);
        access.Record("export", "export_package_revoked", p.Id);
        throw new AppException(403, "export_scope_changed", "Có hồ sơ trong gói không còn thuộc phạm vi của bạn nên gói đã bị thu hồi. Tạo gói mới với các hồ sơ bạn còn quyền.");
    }

    private static List<Guid> DossierIds(ExportPackage p)
    {
        using var document = JsonDocument.Parse(p.Scope);
        return document.RootElement.TryGetProperty("dossierIds", out var array)
            ? array.EnumerateArray().Select(e => e.GetGuid()).ToList()
            : [];
    }

    private async Task<ExportPackage> OwnAsync(Guid id, CancellationToken ct)
    {
        var me = user.RequireUserId();
        return await db.Read<ExportPackage>().SingleOrDefaultAsync(p => p.Id == id && p.RequestedBy == me, ct) ?? throw AppException.NotFound("gói xuất");
    }

    private static ExportDto ToDto(ExportPackage p) => new(p.Id, p.Status, p.Format, p.TotalItems, p.ProcessedItems, p.ByteSize, p.ManifestSha256, p.CreatedAt, p.ReadyAt, p.ExpiresAt, p.ErrorMessage);
}

public sealed class CreateExportValidator : AbstractValidator<CreateExportRequest>
{
    public CreateExportValidator()
    {
        RuleFor(x => x).Must(x => x.DossierIds is { Count: > 0 } || x.Status is { Length: > 0 } || x.WorkGroupCode is { Length: > 0 } || x.ArchivedFrom is not null || x.ArchivedTo is not null)
            .WithName("dossierIds").WithMessage("Chọn hồ sơ cần xuất hoặc đặt điều kiện lọc.");
        RuleFor(x => x.Format).Must(f => f is null || ExportHandler.Formats.Contains(f)).WithMessage("Định dạng: zip_pdf_json hoặc zip_pdf_csv.");
        RuleFor(x => x.ArchivedTo).GreaterThanOrEqualTo(x => x.ArchivedFrom).When(x => x.ArchivedFrom is not null && x.ArchivedTo is not null).WithMessage("Ngày kết thúc phải sau ngày bắt đầu.");
    }
}
