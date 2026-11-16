using HoSoSo.Application.Common;
using HoSoSo.Domain.Catalog;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Catalog;

public sealed record OrganizationDto(string Code, string Name, string Kind, string Locality);
public sealed record DepartmentDto(string Code, string Name, string Kind, string Note, string VerificationStatus, IReadOnlyList<string> OrganizationCodes);
public sealed record WorkGroupDto(string Code, string OrganizationCode, string DepartmentCode, string Title, string Responsibility, string FilingRule, string VerificationStatus, int DocumentTypeCount, bool Active = true);
public sealed record FieldDto(string Code, string Label, int Position, string ValueType, bool RequiredForReview, bool IsKeyField = false, string? FieldGroup = null, string? ValidationPattern = null);
public sealed record DocumentTypeDto(string Code, string Name, IReadOnlyList<FieldDto> Fields, bool Active = true, string? DocumentForm = null, bool RequiredInDossier = false, int MinCount = 1);

/// <summary>BE-31. Danh mục chỉ đọc cho mọi người dùng đã đăng nhập; sửa danh mục là BE-32 (quyền catalog.manage).</summary>
public sealed class CatalogHandler(IHoSoDb db, ICurrentUser user)
{
    /// <summary>Mục đã ngừng dùng chỉ hiện cho người quản lý danh mục; người dùng khác không thể chọn chúng.</summary>
    private bool CanSeeInactive => user.Has(HoSoSo.Domain.Identity.Permissions.CatalogManage);

    public async Task<IReadOnlyList<OrganizationDto>> OrganizationsAsync(CancellationToken ct) =>
        await db.Read<Organization>().OrderBy(o => o.Code).Select(o => new OrganizationDto(o.Code, o.Name, o.Kind, o.Locality)).ToListAsync(ct);

    public async Task<IReadOnlyList<DepartmentDto>> DepartmentsAsync(string? organizationCode, CancellationToken ct)
    {
        var scopes = db.Read<DepartmentScope>();
        var departments = db.Read<Department>();
        if (organizationCode is not null)
        {
            departments = departments.Where(d => scopes.Any(s => s.DepartmentCode == d.Code && s.OrganizationCode == organizationCode));
        }
        var rows = await departments.OrderBy(d => d.Code).ToListAsync(ct);
        var links = await scopes.ToListAsync(ct);
        return rows.Select(d => new DepartmentDto(d.Code, d.Name, d.Kind, d.AssignmentNote, d.VerificationStatus,
            links.Where(l => l.DepartmentCode == d.Code).Select(l => l.OrganizationCode).Order().ToList())).ToList();
    }

    public async Task<IReadOnlyList<WorkGroupDto>> WorkGroupsAsync(string? organizationCode, string? departmentCode, CancellationToken ct)
    {
        var query = db.Read<WorkGroup>();
        if (!CanSeeInactive) query = query.Where(g => g.Active);
        if (organizationCode is not null) query = query.Where(g => g.OrganizationCode == organizationCode);
        if (departmentCode is not null) query = query.Where(g => g.DepartmentCode == departmentCode);
        var types = db.Read<DocumentType>().Where(t => t.Active || CanSeeInactive);
        return await query.OrderBy(g => g.Code).Select(g => new WorkGroupDto(g.Code, g.OrganizationCode, g.DepartmentCode, g.Title,
            g.Responsibility, g.FilingRule, g.VerificationStatus, types.Count(t => t.WorkGroupCode == g.Code), g.Active)).ToListAsync(ct);
    }

    public async Task<IReadOnlyList<DocumentTypeDto>> DocumentTypesAsync(string workGroupCode, CancellationToken ct)
    {
        if (!await db.Read<WorkGroup>().AnyAsync(g => g.Code == workGroupCode, ct)) throw AppException.NotFound("nhóm hồ sơ");
        var types = await db.Read<DocumentType>().Where(t => t.WorkGroupCode == workGroupCode && (t.Active || CanSeeInactive)).OrderBy(t => t.Code).ToListAsync(ct);
        var codes = types.Select(t => t.Code).ToList();
        var fields = await db.Read<FieldDefinition>().Where(f => codes.Contains(f.DocumentTypeCode)).OrderBy(f => f.Position).ToListAsync(ct);
        return types.Select(t => new DocumentTypeDto(t.Code, t.Name,
            fields.Where(f => f.DocumentTypeCode == t.Code).Select(f => new FieldDto(f.Code, f.Label, f.Position, f.ValueType, f.RequiredForReview, f.IsKeyField, f.FieldGroup, f.ValidationPattern)).ToList(),
            t.Active, t.DocumentForm, t.RequiredInDossier, t.MinCount)).ToList();
    }
}
