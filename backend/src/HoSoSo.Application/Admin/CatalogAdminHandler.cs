using System.Text.RegularExpressions;
using FluentValidation;
using HoSoSo.Application.Catalog;
using HoSoSo.Application.Common;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Admin;

public sealed record CreateWorkGroupRequest(string Code, string OrganizationCode, string DepartmentCode, string Title, string Responsibility, string FilingRule, string BusinessFields);
public sealed record UpdateWorkGroupRequest(string? Title, string? Responsibility, string? FilingRule, string? BusinessFields, string? VerificationStatus, bool? Active);
public sealed record CreateDocumentTypeRequest(string WorkGroupCode, string Name, string? DocumentForm, bool? RequiredInDossier, short? MinCount);
public sealed record UpdateDocumentTypeRequest(string? Name, string? DocumentForm, bool? RequiredInDossier, short? MinCount, bool? Active);
public sealed record CreateFieldRequest(string DocumentTypeCode, string Label, string? ValueType, bool? RequiredForReview, bool? IsKeyField, string? FieldGroup, string? ValidationPattern);
public sealed record UpdateFieldRequest(string? Label, string? ValueType, bool? RequiredForReview, bool? IsKeyField, string? FieldGroup, string? ValidationPattern);
public sealed record CreateRetentionRequest(string WorkGroupCode, string? DocumentTypeCode, string RetentionLabel, short? RetentionYears, string? LegalReference);
public sealed record ConfirmRetentionRequest(string LegalReference);
public sealed record RetentionRuleDto(Guid Id, string WorkGroupCode, string? DocumentTypeCode, string RetentionLabel, short? RetentionYears, string? LegalReference,
    string Status, DateTimeOffset? ConfirmedAt);

/// <summary>
/// BE-32, BE-35. Sửa danh mục (quyền catalog.manage). Danh mục hiện là ĐỀ XUẤT: thêm/sửa được, đánh dấu "confirmed" khi cơ quan phê duyệt.
/// Mục đã có giấy tờ, hồ sơ hay kết quả AI tham chiếu thì KHÔNG xóa được (409 in_use, kèm hướng dẫn "ngừng dùng"): ngừng dùng ẩn mục khỏi
/// lựa chọn mới nhưng giữ nguyên dữ liệu cũ. Thời hạn bảo quản chỉ có hiệu lực khi được xác nhận kèm căn cứ pháp lý; hệ thống không tự đặt.
/// Mọi thay đổi được trigger audit_change ghi vết.
/// </summary>
public sealed partial class CatalogAdminHandler(IHoSoDb db, ICurrentUser user, IClock clock)
{
    private static readonly string[] ValueTypes = ["text", "date", "number", "boolean"];

    [GeneratedRegex(@"-D(\d+)$")] private static partial Regex TypeSuffix();
    [GeneratedRegex(@"-F(\d+)$")] private static partial Regex FieldSuffix();

    // ---- nhóm hồ sơ ----
    public async Task<WorkGroupDto> CreateWorkGroupAsync(CreateWorkGroupRequest r, CancellationToken ct)
    {
        var entity = new WorkGroup
        {
            Code = r.Code.Trim().ToUpperInvariant(), OrganizationCode = r.OrganizationCode, DepartmentCode = r.DepartmentCode,
            Title = r.Title.Trim(), Responsibility = r.Responsibility.Trim(), FilingRule = r.FilingRule.Trim(), BusinessFields = r.BusinessFields.Trim(),
        };
        db.Set<WorkGroup>().Add(entity);
        await db.SaveChangesAsync(ct);    // trùng mã: 409; đơn vị không thuộc cơ quan: 422
        return Dto(entity, 0);
    }

    public async Task<WorkGroupDto> UpdateWorkGroupAsync(string code, UpdateWorkGroupRequest r, CancellationToken ct)
    {
        var g = await db.Set<WorkGroup>().SingleOrDefaultAsync(x => x.Code == code, ct) ?? throw AppException.NotFound("nhóm hồ sơ");
        if (r.Title is not null) g.Title = r.Title.Trim();
        if (r.Responsibility is not null) g.Responsibility = r.Responsibility.Trim();
        if (r.FilingRule is not null) g.FilingRule = r.FilingRule.Trim();
        if (r.BusinessFields is not null) g.BusinessFields = r.BusinessFields.Trim();
        if (r.VerificationStatus is not null) g.VerificationStatus = r.VerificationStatus;
        if (r.Active is { } active) g.Active = active;
        await db.SaveChangesAsync(ct);
        return Dto(g, await db.Read<DocumentType>().CountAsync(t => t.WorkGroupCode == code, ct));
    }

    public async Task DeleteWorkGroupAsync(string code, CancellationToken ct)
    {
        var g = await db.Set<WorkGroup>().SingleOrDefaultAsync(x => x.Code == code, ct) ?? throw AppException.NotFound("nhóm hồ sơ");
        var types = await db.Read<DocumentType>().CountAsync(t => t.WorkGroupCode == code, ct);
        var dossiers = await db.Read<Dossier>().CountAsync(d => d.WorkGroupCode == code, ct);
        var classified = await db.Read<DocumentClassification>().CountAsync(c => c.WorkGroupCode == code, ct);
        if (types + dossiers + classified > 0) throw InUse($"Nhóm {code}", $"{types} loại giấy tờ, {dossiers} hồ sơ, {classified} giấy tờ đã phân loại");
        db.Set<WorkGroup>().Remove(g);
        await db.SaveChangesAsync(ct);
    }

    // ---- loại giấy tờ ----
    public async Task<DocumentTypeDto> CreateDocumentTypeAsync(CreateDocumentTypeRequest r, CancellationToken ct)
    {
        if (!await db.Read<WorkGroup>().AnyAsync(g => g.Code == r.WorkGroupCode, ct))
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["workGroupCode"] = ["Nhóm hồ sơ không tồn tại."] });
        var codes = await db.Read<DocumentType>().Where(t => t.WorkGroupCode == r.WorkGroupCode).Select(t => t.Code).ToListAsync(ct);
        var entity = new DocumentType
        {
            Code = $"{r.WorkGroupCode}-D{Next(codes, TypeSuffix()):00}", WorkGroupCode = r.WorkGroupCode, Name = r.Name.Trim(),
            DocumentForm = r.DocumentForm?.Trim(), RequiredInDossier = r.RequiredInDossier ?? false, MinCount = r.MinCount ?? 1,
        };
        db.Set<DocumentType>().Add(entity);
        await db.SaveChangesAsync(ct);
        return new DocumentTypeDto(entity.Code, entity.Name, [], entity.Active, entity.DocumentForm, entity.RequiredInDossier, entity.MinCount);
    }

    public async Task<DocumentTypeDto> UpdateDocumentTypeAsync(string code, UpdateDocumentTypeRequest r, CancellationToken ct)
    {
        var t = await db.Set<DocumentType>().SingleOrDefaultAsync(x => x.Code == code, ct) ?? throw AppException.NotFound("loại giấy tờ");
        if (r.Name is not null) t.Name = r.Name.Trim();
        if (r.DocumentForm is not null) t.DocumentForm = r.DocumentForm.Trim().Length == 0 ? null : r.DocumentForm.Trim();
        if (r.RequiredInDossier is { } req) t.RequiredInDossier = req;
        if (r.MinCount is { } min) t.MinCount = min;
        if (r.Active is { } active) t.Active = active;
        await db.SaveChangesAsync(ct);
        var fields = await db.Read<FieldDefinition>().Where(f => f.DocumentTypeCode == code).OrderBy(f => f.Position)
            .Select(f => new FieldDto(f.Code, f.Label, f.Position, f.ValueType, f.RequiredForReview, f.IsKeyField, f.FieldGroup, f.ValidationPattern)).ToListAsync(ct);
        return new DocumentTypeDto(t.Code, t.Name, fields, t.Active, t.DocumentForm, t.RequiredInDossier, t.MinCount);
    }

    public async Task DeleteDocumentTypeAsync(string code, CancellationToken ct)
    {
        var t = await db.Set<DocumentType>().SingleOrDefaultAsync(x => x.Code == code, ct) ?? throw AppException.NotFound("loại giấy tờ");
        var classified = await db.Read<DocumentClassification>().CountAsync(c => c.DocumentTypeCode == code, ct);
        var suggested = await db.Read<AiSuggestion>().CountAsync(s => s.DocumentTypeCode == code, ct);
        var retention = await db.Read<RetentionRule>().CountAsync(x => x.DocumentTypeCode == code, ct);
        if (classified + suggested + retention > 0) throw InUse($"Loại giấy tờ {code}", $"{classified} giấy tờ đã phân loại, {suggested} gợi ý AI, {retention} quy tắc bảo quản");
        db.Set<FieldDefinition>().RemoveRange(db.Set<FieldDefinition>().Where(f => f.DocumentTypeCode == code));
        db.Set<DocumentType>().Remove(t);
        await db.SaveChangesAsync(ct);
    }

    // ---- trường dữ liệu ----
    public async Task<FieldDto> CreateFieldAsync(CreateFieldRequest r, CancellationToken ct)
    {
        if (!await db.Read<DocumentType>().AnyAsync(t => t.Code == r.DocumentTypeCode, ct))
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["documentTypeCode"] = ["Loại giấy tờ không tồn tại."] });
        var existing = await db.Read<FieldDefinition>().Where(f => f.DocumentTypeCode == r.DocumentTypeCode).Select(f => new { f.Code, f.Position }).ToListAsync(ct);
        var entity = new FieldDefinition
        {
            Code = $"{r.DocumentTypeCode}-F{Next(existing.Select(e => e.Code).ToList(), FieldSuffix()):00}", DocumentTypeCode = r.DocumentTypeCode, Label = r.Label.Trim(),
            Position = (existing.Count == 0 ? 0 : existing.Max(e => e.Position)) + 1, ValueType = r.ValueType ?? "text", RequiredForReview = r.RequiredForReview ?? false,
            IsKeyField = r.IsKeyField ?? false, FieldGroup = r.FieldGroup?.Trim(), ValidationPattern = r.ValidationPattern?.Trim(),
        };
        db.Set<FieldDefinition>().Add(entity);
        await db.SaveChangesAsync(ct);
        return new FieldDto(entity.Code, entity.Label, entity.Position, entity.ValueType, entity.RequiredForReview, entity.IsKeyField, entity.FieldGroup, entity.ValidationPattern);
    }

    public async Task<FieldDto> UpdateFieldAsync(string code, UpdateFieldRequest r, CancellationToken ct)
    {
        var f = await db.Set<FieldDefinition>().SingleOrDefaultAsync(x => x.Code == code, ct) ?? throw AppException.NotFound("trường dữ liệu");
        if (r.Label is not null) f.Label = r.Label.Trim();
        if (r.ValueType is not null) f.ValueType = r.ValueType;
        if (r.RequiredForReview is { } rr) f.RequiredForReview = rr;
        if (r.IsKeyField is { } key) f.IsKeyField = key;
        if (r.FieldGroup is not null) f.FieldGroup = r.FieldGroup.Trim().Length == 0 ? null : r.FieldGroup.Trim();
        if (r.ValidationPattern is not null) f.ValidationPattern = r.ValidationPattern.Trim().Length == 0 ? null : r.ValidationPattern.Trim();
        await db.SaveChangesAsync(ct);
        return new FieldDto(f.Code, f.Label, f.Position, f.ValueType, f.RequiredForReview, f.IsKeyField, f.FieldGroup, f.ValidationPattern);
    }

    public async Task DeleteFieldAsync(string code, CancellationToken ct)
    {
        var f = await db.Set<FieldDefinition>().SingleOrDefaultAsync(x => x.Code == code, ct) ?? throw AppException.NotFound("trường dữ liệu");
        var values = await db.Read<DocumentFieldValue>().CountAsync(v => v.FieldDefinitionCode == code, ct);
        var suggested = await db.Read<AiFieldSuggestion>().CountAsync(s => s.FieldDefinitionCode == code, ct);
        if (values + suggested > 0) throw InUse($"Trường {code}", $"{values} giá trị đã nhập, {suggested} gợi ý AI");
        db.Set<FieldDefinition>().Remove(f);
        await db.SaveChangesAsync(ct);
    }

    // ---- thời hạn bảo quản ----
    public async Task<IReadOnlyList<RetentionRuleDto>> RetentionAsync(string? workGroupCode, CancellationToken ct) =>
        await db.Read<RetentionRule>().Where(x => workGroupCode == null || x.WorkGroupCode == workGroupCode).OrderBy(x => x.WorkGroupCode).ThenBy(x => x.DocumentTypeCode)
            .Select(x => new RetentionRuleDto(x.Id, x.WorkGroupCode, x.DocumentTypeCode, x.RetentionLabel, x.RetentionYears, x.LegalReference, x.Status, x.ConfirmedAt)).ToListAsync(ct);

    public async Task<RetentionRuleDto> ProposeRetentionAsync(CreateRetentionRequest r, CancellationToken ct)
    {
        var rule = new RetentionRule
        {
            WorkGroupCode = r.WorkGroupCode, DocumentTypeCode = r.DocumentTypeCode, RetentionLabel = r.RetentionLabel.Trim(), RetentionYears = r.RetentionYears,
            LegalReference = r.LegalReference?.Trim(), ProposedBy = user.RequireUserId(),
        };
        db.Set<RetentionRule>().Add(rule);
        await db.SaveChangesAsync(ct);
        return ToDto(rule);
    }

    /// <summary>Xác nhận cần căn cứ pháp lý cụ thể (số hiệu văn bản, điều khoản); không có căn cứ thì không xác nhận được.</summary>
    public async Task<RetentionRuleDto> ConfirmRetentionAsync(Guid id, ConfirmRetentionRequest r, CancellationToken ct)
    {
        var rule = await db.Set<RetentionRule>().SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw AppException.NotFound("quy tắc bảo quản");
        if (rule.Status == "confirmed") throw AppException.Conflict("Quy tắc này đã được xác nhận.");
        rule.LegalReference = r.LegalReference.Trim();
        rule.Status = "confirmed";
        rule.ConfirmedBy = user.RequireUserId();
        rule.ConfirmedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        return ToDto(rule);
    }

    public async Task DeleteRetentionAsync(Guid id, CancellationToken ct)
    {
        var rule = await db.Set<RetentionRule>().SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw AppException.NotFound("quy tắc bảo quản");
        if (rule.Status == "confirmed") throw AppException.Conflict("Quy tắc đã xác nhận không xóa được vì có thể đã áp dụng cho hồ sơ. Tạo quy tắc mới thay thế.");
        db.Set<RetentionRule>().Remove(rule);
        await db.SaveChangesAsync(ct);
    }

    // ---- nội bộ ----
    private static WorkGroupDto Dto(WorkGroup g, int types) => new(g.Code, g.OrganizationCode, g.DepartmentCode, g.Title, g.Responsibility, g.FilingRule, g.VerificationStatus, types, g.Active);
    private static RetentionRuleDto ToDto(RetentionRule x) => new(x.Id, x.WorkGroupCode, x.DocumentTypeCode, x.RetentionLabel, x.RetentionYears, x.LegalReference, x.Status, x.ConfirmedAt);

    private static int Next(IReadOnlyCollection<string> codes, Regex suffix) =>
        codes.Select(c => suffix.Match(c)).Where(m => m.Success).Select(m => int.Parse(m.Groups[1].Value)).DefaultIfEmpty(0).Max() + 1;

    private static AppException InUse(string what, string usage) => new(409, "in_use",
        $"{what} đang được dùng ({usage}) nên không xóa được. Hãy ngừng dùng (active=false) để ẩn khỏi lựa chọn mới mà vẫn giữ dữ liệu cũ.");

    internal static bool IsValidPattern(string pattern)
    {
        try { _ = new Regex(pattern, RegexOptions.None, TimeSpan.FromMilliseconds(100)); return true; }
        catch (ArgumentException) { return false; }
    }
}

public sealed class CreateWorkGroupValidator : AbstractValidator<CreateWorkGroupRequest>
{
    public CreateWorkGroupValidator()
    {
        RuleFor(x => x.Code).Matches("^[A-Za-z][A-Za-z0-9]{1,9}$").WithMessage("Mã nhóm 2–10 ký tự gồm chữ và số, bắt đầu bằng chữ (ví dụ U35).");
        RuleFor(x => x.OrganizationCode).NotEmpty().WithMessage("Chọn cơ quan.");
        RuleFor(x => x.DepartmentCode).NotEmpty().WithMessage("Chọn đơn vị phụ trách.");
        RuleFor(x => x.Title).NotEmpty().WithMessage("Nhập tên nhóm hồ sơ.").MaximumLength(300).WithMessage("Tên nhóm tối đa 300 ký tự.");
        RuleFor(x => x.Responsibility).NotNull().WithMessage("Nhập trách nhiệm (có thể để trống nội dung).");
        RuleFor(x => x.FilingRule).NotNull().WithMessage("Nhập quy tắc lập hồ sơ (có thể để trống nội dung).");
        RuleFor(x => x.BusinessFields).NotNull().WithMessage("Nhập lĩnh vực nghiệp vụ (có thể để trống nội dung).");
    }
}

public sealed class UpdateWorkGroupValidator : AbstractValidator<UpdateWorkGroupRequest>
{
    public UpdateWorkGroupValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(300).When(x => x.Title is not null).WithMessage("Tên nhóm từ 1 đến 300 ký tự.");
        RuleFor(x => x.VerificationStatus).Must(v => v is "proposed" or "confirmed").When(x => x.VerificationStatus is not null).WithMessage("Trạng thái chỉ nhận proposed hoặc confirmed.");
    }
}

public sealed class CreateDocumentTypeValidator : AbstractValidator<CreateDocumentTypeRequest>
{
    public CreateDocumentTypeValidator()
    {
        RuleFor(x => x.WorkGroupCode).NotEmpty().WithMessage("Chọn nhóm hồ sơ.");
        RuleFor(x => x.Name).NotEmpty().WithMessage("Nhập tên loại giấy tờ.").MaximumLength(300).WithMessage("Tên tối đa 300 ký tự.");
        RuleFor(x => x.MinCount).InclusiveBetween((short)0, (short)100).When(x => x.MinCount is not null).WithMessage("Số lượng tối thiểu từ 0 đến 100.");
    }
}

public sealed class UpdateDocumentTypeValidator : AbstractValidator<UpdateDocumentTypeRequest>
{
    public UpdateDocumentTypeValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(300).When(x => x.Name is not null).WithMessage("Tên từ 1 đến 300 ký tự.");
        RuleFor(x => x.MinCount).InclusiveBetween((short)0, (short)100).When(x => x.MinCount is not null).WithMessage("Số lượng tối thiểu từ 0 đến 100.");
    }
}

public sealed class CreateFieldValidator : AbstractValidator<CreateFieldRequest>
{
    public CreateFieldValidator()
    {
        RuleFor(x => x.DocumentTypeCode).NotEmpty().WithMessage("Chọn loại giấy tờ.");
        RuleFor(x => x.Label).NotEmpty().WithMessage("Nhập tên trường.").MaximumLength(200).WithMessage("Tên trường tối đa 200 ký tự.");
        RuleFor(x => x.ValueType).Must(v => v is null || new[] { "text", "date", "number", "boolean" }.Contains(v)).WithMessage("Kiểu giá trị: text, date, number hoặc boolean.");
        RuleFor(x => x.ValidationPattern).Must(v => string.IsNullOrWhiteSpace(v) || CatalogAdminHandler.IsValidPattern(v)).WithMessage("Biểu thức kiểm tra không hợp lệ.");
    }
}

public sealed class UpdateFieldValidator : AbstractValidator<UpdateFieldRequest>
{
    public UpdateFieldValidator()
    {
        RuleFor(x => x.Label).NotEmpty().MaximumLength(200).When(x => x.Label is not null).WithMessage("Tên trường từ 1 đến 200 ký tự.");
        RuleFor(x => x.ValueType).Must(v => v is null || new[] { "text", "date", "number", "boolean" }.Contains(v)).WithMessage("Kiểu giá trị: text, date, number hoặc boolean.");
        RuleFor(x => x.ValidationPattern).Must(v => string.IsNullOrWhiteSpace(v) || CatalogAdminHandler.IsValidPattern(v)).WithMessage("Biểu thức kiểm tra không hợp lệ.");
    }
}

public sealed class CreateRetentionValidator : AbstractValidator<CreateRetentionRequest>
{
    public CreateRetentionValidator()
    {
        RuleFor(x => x.WorkGroupCode).NotEmpty().WithMessage("Chọn nhóm hồ sơ.");
        RuleFor(x => x.RetentionLabel).NotEmpty().WithMessage("Nhập thời hạn bảo quản (ví dụ \"Vĩnh viễn\", \"20 năm\").").MaximumLength(100).WithMessage("Tối đa 100 ký tự.");
        RuleFor(x => x.RetentionYears).InclusiveBetween((short)0, (short)200).When(x => x.RetentionYears is not null).WithMessage("Số năm từ 0 đến 200.");
    }
}

public sealed class ConfirmRetentionValidator : AbstractValidator<ConfirmRetentionRequest>
{
    public ConfirmRetentionValidator() => RuleFor(x => x.LegalReference).Must(v => v is not null && v.Trim().Length >= 5)
        .WithMessage("Xác nhận thời hạn bảo quản cần căn cứ pháp lý cụ thể (số hiệu văn bản, điều khoản) từ 5 ký tự. Hệ thống không tự đặt thời hạn.");
}
