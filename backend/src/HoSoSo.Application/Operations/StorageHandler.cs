using System.Text.RegularExpressions;
using FluentValidation;
using HoSoSo.Application.Common;
using HoSoSo.Application.Documents;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Operations;

public sealed record LocationNode(Guid Id, Guid? ParentId, string Kind, string Code, string Name, string Path, int Depth, bool Active, string QrPayload, int DossierCount);
public sealed record CreateLocationRequest(Guid? ParentId, string Kind, string Code, string Name, string? CapacityNote);
public sealed record UpdateLocationRequest(string? Name, string? CapacityNote, bool? Active);
public sealed record PlaceDossierRequest(Guid? LocationId, string? Note);
public sealed record DossierLocationDto(Guid DossierId, Guid? LocationId, string? Path);

/// <summary>
/// BE-81, BE-82. Kho bản giấy: cây vị trí (kho › phòng › tủ › kệ › hộp), mã QR dán lên hộp, nhãn in A4 hàng loạt và vị trí từng hồ sơ có lịch sử.
/// Vị trí thuộc về cơ quan: văn thư chỉ thấy và đặt hồ sơ vào kho của cơ quan mình.
/// </summary>
public sealed partial class StorageHandler(IHoSoDb db, IScopeFilter scope, ICurrentUser user, IDocumentRenderer renderer)
{
    public const string QrPrefix = "HOSO-LOC:";

    [GeneratedRegex("^[A-Z0-9][A-Z0-9._-]{0,39}$")]
    private static partial Regex CodePattern();

    private sealed record NodeRow(Guid id, Guid? parent_id, string kind, string code, string name, string path, int depth, bool active, string qr_payload, long dossier_count);

    /// <summary>Cả cây của cơ quan, theo thứ tự duyệt (cha trước con). Đường dẫn dựng bằng CTE đệ quy.</summary>
    public async Task<IReadOnlyList<LocationNode>> TreeAsync(bool includeInactive, CancellationToken ct)
    {
        var organization = RequireOrganization();
        var rows = await db.Database.SqlQuery<NodeRow>($"""
            WITH RECURSIVE tree AS (
              SELECT l.id, l.parent_id, l.kind, l.code, l.name, l.name AS path, 1 AS depth, l.active, l.qr_payload, ARRAY[l.name] AS sort_key
              FROM hoso.storage_locations l WHERE l.parent_id IS NULL AND l.organization_code = {organization}
              UNION ALL
              SELECT c.id, c.parent_id, c.kind, c.code, c.name, t.path || ' › ' || c.name, t.depth + 1, c.active, c.qr_payload, t.sort_key || c.name
              FROM hoso.storage_locations c JOIN tree t ON c.parent_id = t.id
            )
            SELECT t.id, t.parent_id, t.kind, t.code, t.name, t.path, t.depth, t.active, t.qr_payload,
                   (SELECT count(*) FROM hoso.dossiers d WHERE d.storage_location_id = t.id) AS dossier_count
            FROM tree t WHERE ({includeInactive} OR t.active) ORDER BY t.sort_key
            """).ToListAsync(ct);
        return rows.Select(r => new LocationNode(r.id, r.parent_id, r.kind, r.code, r.name, r.path, r.depth, r.active, r.qr_payload, (int)r.dossier_count)).ToList();
    }

    public async Task<LocationNode> GetAsync(Guid id, CancellationToken ct) =>
        (await TreeAsync(true, ct)).FirstOrDefault(n => n.Id == id) ?? throw AppException.NotFound("vị trí");

    public async Task<LocationNode> ResolveQrAsync(string payload, CancellationToken ct)
    {
        if (!payload.StartsWith(QrPrefix, StringComparison.Ordinal)) throw AppException.NotFound("vị trí");
        return (await TreeAsync(true, ct)).FirstOrDefault(n => n.QrPayload == payload) ?? throw AppException.NotFound("vị trí");
    }

    public async Task<LocationNode> CreateAsync(CreateLocationRequest r, CancellationToken ct)
    {
        var organization = RequireOrganization();
        var code = r.Code.Trim().ToUpperInvariant();
        var entity = new StorageLocation
        {
            ParentId = r.ParentId, Kind = r.Kind, Code = code, Name = r.Name.Trim(), OrganizationCode = organization, QrPayload = QrPrefix + code, CapacityNote = r.CapacityNote?.Trim(),
        };
        db.Set<StorageLocation>().Add(entity);
        await db.SaveChangesAsync(ct);   // trùng mã: 409; sai cấp hoặc khác cơ quan với cha: 422 (trigger)
        return await GetAsync(entity.Id, ct);
    }

    public async Task<LocationNode> UpdateAsync(Guid id, UpdateLocationRequest r, CancellationToken ct)
    {
        var organization = RequireOrganization();
        var l = await db.Set<StorageLocation>().SingleOrDefaultAsync(x => x.Id == id && x.OrganizationCode == organization, ct) ?? throw AppException.NotFound("vị trí");
        if (r.Name is not null) l.Name = r.Name.Trim();
        if (r.CapacityNote is not null) l.CapacityNote = r.CapacityNote.Trim().Length == 0 ? null : r.CapacityNote.Trim();
        if (r.Active == false && l.Active)
        {
            var dossiers = await db.Read<Dossier>().CountAsync(d => d.StorageLocationId == id, ct);
            var children = await db.Read<StorageLocation>().CountAsync(c => c.ParentId == id && c.Active, ct);
            if (dossiers + children > 0)
                throw AppException.Conflict($"Vị trí còn {dossiers} hồ sơ và {children} vị trí con đang dùng. Chuyển hồ sơ đi và ngừng dùng các vị trí con trước.");
        }
        if (r.Active is { } active) l.Active = active;
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<string> QrSvgAsync(Guid id, CancellationToken ct) => renderer.QrSvg((await GetAsync(id, ct)).QrPayload);

    public async Task<byte[]> LabelsAsync(IReadOnlyList<Guid> ids, CancellationToken ct)
    {
        if (ids.Count == 0 || ids.Count > 240) throw new ValidationFailedException(new Dictionary<string, string[]> { ["ids"] = ["Chọn từ 1 đến 240 vị trí để in nhãn."] });
        var tree = (await TreeAsync(true, ct)).ToDictionary(n => n.Id);
        var missing = ids.Where(i => !tree.ContainsKey(i)).ToList();
        if (missing.Count > 0) throw AppException.NotFound("vị trí");
        return renderer.Labels(ids.Select(i => new LabelItem(tree[i].Code, tree[i].Name, tree[i].Path, tree[i].QrPayload)).ToList());
    }

    /// <summary>BE-82. Đặt hoặc chuyển vị trí hồ sơ; trigger ghi lịch sử (ai, khi nào, từ đâu đến đâu, ghi chú).</summary>
    public async Task<DossierLocationDto> PlaceDossierAsync(Guid dossierId, PlaceDossierRequest r, CancellationToken ct)
    {
        var dossier = await scope.Dossiers(db.Set<Dossier>()).SingleOrDefaultAsync(d => d.Id == dossierId, ct) ?? throw AppException.NotFound("hồ sơ");
        var organization = RequireOrganization();
        string? path = null;
        if (r.LocationId is { } locationId)
        {
            var node = (await TreeAsync(false, ct)).FirstOrDefault(n => n.Id == locationId)
                ?? throw new ValidationFailedException(new Dictionary<string, string[]> { ["locationId"] = ["Vị trí không tồn tại, đã ngừng dùng hoặc không thuộc cơ quan của bạn."] });
            if (node.Kind != "box" && node.Kind != "shelf")
                throw new ValidationFailedException(new Dictionary<string, string[]> { ["locationId"] = ["Hồ sơ phải đặt ở cấp hộp hoặc kệ, không đặt thẳng ở kho, phòng hay tủ."] });
            path = node.Path;
        }
        if (dossier.OrganizationCode != organization) throw AppException.OutOfScope();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // Ghi chú đi vào trigger qua biến cục bộ của giao dịch, không để lọt sang yêu cầu khác.
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT set_config('hoso.move_note', {r.Note?.Trim() ?? ""}, true)", ct);
        dossier.StorageLocationId = r.LocationId;
        dossier.PhysicalLocation = path;
        dossier.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new DossierLocationDto(dossierId, r.LocationId, path);
    }

    private string RequireOrganization() => user.OrganizationCode ?? throw new AppException(403, ErrorCodes.Forbidden, "Phân công đang dùng không gắn với cơ quan nào nên không quản lý được kho.");
}

public sealed class CreateLocationValidator : AbstractValidator<CreateLocationRequest>
{
    public CreateLocationValidator()
    {
        RuleFor(x => x.Kind).Must(k => k is "warehouse" or "room" or "cabinet" or "shelf" or "box").WithMessage("Cấp vị trí: warehouse, room, cabinet, shelf hoặc box.");
        RuleFor(x => x.Code).Matches("(?i)^[A-Z0-9][A-Z0-9._-]{0,39}$").WithMessage("Mã vị trí gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới (tối đa 40 ký tự).");
        RuleFor(x => x.Name).NotEmpty().WithMessage("Nhập tên vị trí.").MaximumLength(200).WithMessage("Tên tối đa 200 ký tự.");
    }
}

public sealed class UpdateLocationValidator : AbstractValidator<UpdateLocationRequest>
{
    public UpdateLocationValidator() => RuleFor(x => x.Name).NotEmpty().MaximumLength(200).When(x => x.Name is not null).WithMessage("Tên từ 1 đến 200 ký tự.");
}
