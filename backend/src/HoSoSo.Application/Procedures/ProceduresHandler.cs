using System.Text.Json;
using HoSoSo.Application.Common;
using HoSoSo.Application.Dossiers;
using HoSoSo.Application.Intake;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Procedures;

public sealed record ProcedureListItem(string Id, string? ProcedureCode, string Name, string? Domain, string? ManagingAgency, string? ExecutionLevel, string LifecycleStatus, int ComponentCount);
public sealed record ProcedurePage(IReadOnlyList<ProcedureListItem> Items, int Total);
public sealed record DomainCount(string Domain, int Count);
/// <summary>BE-122. Cấp thực hiện và số thủ tục; dữ liệu nguồn ghi không thống nhất hoa/thường ("Cấp xã", "Cấp Xã") nên gộp không phân biệt hoa thường.</summary>
public sealed record LevelCount(string Level, int Count);
public sealed record TemplateDto(Guid Id, string Kind, string Filename, long ByteSize, string MediaType, bool Downloadable);
public sealed record ComponentDto(Guid Id, string Section, int Position, string Name, string? PaperCode, int OriginalQuantity, int CopyQuantity,
    bool RequiredAsPublished, bool HasElectronicForm, IReadOnlyList<TemplateDto> Templates);
public sealed record LifecycleDto(string Status, string Label, string Note, JsonElement Evidence, DateOnly? EffectiveFrom, DateOnly? ReviewedOn);
public sealed record ProcedureDetail(string Id, string? ProcedureCode, string Name, string? Domain, string? ManagingAgency, string? ExecutionLevel, string? CompetentAuthority,
    string? Fees, string? ReceivingLocation, string? MinistryDecision, string? HanoiDecision, string? WorkflowDecision, string? DelegationDecision, string? DelegationExpiry,
    string? SourceUrl, string LifecycleStatus, string? Warning, IReadOnlyList<ComponentDto> Components, IReadOnlyList<LifecycleDto> Lifecycle,
    IReadOnlyList<TemplateDto> ProcedureFiles);
public sealed record TemplateFile(Stream Stream, string FileName, string MediaType);

/// <summary>
/// BE-33. Tra cứu thủ tục hành chính cấp xã (nạp từ data/official-forms): tìm không dấu, lọc lĩnh vực và hiệu lực, thành phần hồ sơ, mẫu biểu.
/// Thủ tục đã bãi bỏ hoặc thay thế vẫn tra được (để đối chiếu hồ sơ cũ) nhưng luôn kèm cảnh báo: không dùng mẫu cũ làm mẫu hiện hành.
/// </summary>
public sealed class ProceduresHandler(IHoSoDb db, IFileStorage storage, IAccessLog access)
{
    public async Task<ProcedurePage> SearchAsync(string? q, string? domain, string? status, int page, int pageSize, CancellationToken ct, string? level = null)
    {
        pageSize = Math.Clamp(pageSize, 1, 100);
        page = Math.Max(1, page);
        var query = db.Read<Procedure>();
        if (domain is { Length: > 0 }) query = query.Where(p => p.Domain == domain);
        if (level is { Length: > 0 })
        {
            var wanted = level.Trim().ToLower();
            query = query.Where(p => p.ExecutionLevel != null && p.ExecutionLevel.Trim().ToLower() == wanted);
        }
        if (status is { Length: > 0 }) query = query.Where(p => p.LifecycleStatus == status);
        if (q is { Length: > 1 } text)
        {
            var lower = text.Trim().ToLower();
            query = query.Where(p => HoSoDbContextFunctions.Fold(p.Name).Contains(HoSoDbContextFunctions.Fold(text.Trim())) || (p.ProcedureCode != null && p.ProcedureCode.ToLower().Contains(lower)));
        }
        var total = await query.CountAsync(ct);
        var components = db.Read<ProcedureComponent>();
        var items = await query.OrderBy(p => p.LifecycleStatus == "repealed" || p.LifecycleStatus == "replaced").ThenBy(p => p.Name).ThenBy(p => p.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(p => new ProcedureListItem(p.Id, p.ProcedureCode, p.Name, p.Domain, p.ManagingAgency, p.ExecutionLevel, p.LifecycleStatus, components.Count(c => c.ProcedureId == p.Id)))
            .ToListAsync(ct);
        return new ProcedurePage(items, total);
    }

    public async Task<IReadOnlyList<DomainCount>> DomainsAsync(CancellationToken ct) =>
        await db.Read<Procedure>().Where(p => p.Domain != null).GroupBy(p => p.Domain!).OrderBy(g => g.Key).Select(g => new DomainCount(g.Key, g.Count())).ToListAsync(ct);

    /// <summary>Nhãn của mỗi nhóm là cách ghi phổ biến nhất trong dữ liệu; lọc bằng nhãn này (không phân biệt hoa thường).</summary>
    public async Task<IReadOnlyList<LevelCount>> LevelsAsync(CancellationToken ct)
    {
        var raw = await db.Read<Procedure>().Where(p => p.ExecutionLevel != null && p.ExecutionLevel.Trim() != "")
            .GroupBy(p => p.ExecutionLevel!.Trim()).Select(g => new { Level = g.Key, N = g.Count() }).ToListAsync(ct);
        return raw.GroupBy(x => x.Level.ToLowerInvariant())
            .Select(g => new LevelCount(g.OrderByDescending(x => x.N).ThenBy(x => x.Level, StringComparer.Ordinal).First().Level, g.Sum(x => x.N)))
            .OrderByDescending(l => l.Count).ThenBy(l => l.Level, StringComparer.Ordinal).ToList();
    }

    public async Task<ProcedureDetail> GetAsync(string id, CancellationToken ct)
    {
        var p = await db.Read<Procedure>().SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw AppException.NotFound("thủ tục");
        var components = await db.Read<ProcedureComponent>().Where(c => c.ProcedureId == id).OrderBy(c => c.Section).ThenBy(c => c.Position).ToListAsync(ct);
        var ids = components.Select(c => c.Id).ToList();
        var templates = await (from l in db.Read<ProcedureComponentTemplate>() join t in db.Read<FormTemplate>() on l.TemplateId equals t.Id
                               where ids.Contains(l.ComponentId) select new { l.ComponentId, Template = new TemplateDto(t.Id, t.Kind, t.Filename, t.ByteSize, t.MediaType, t.StorageKey != null) }).ToListAsync(ct);
        var lifecycle = p.ProcedureCode is null ? [] : await db.Read<ProcedureLifecycleEvent>().Where(e => e.ProcedureCode == p.ProcedureCode).OrderByDescending(e => e.ReviewedOn).ToListAsync(ct);
        var procedureFiles = await (from l in db.Read<ProcedureTemplate>() join x in db.Read<FormTemplate>() on l.TemplateId equals x.Id where l.ProcedureId == id orderby x.Kind, x.Filename
                                    select new TemplateDto(x.Id, x.Kind, x.Filename, x.ByteSize, x.MediaType, x.StorageKey != null)).ToListAsync(ct);
        string? warning = p.LifecycleStatus switch
        {
            "repealed" => "Thủ tục này đã có quyết định bãi bỏ. Chỉ dùng để đối chiếu hồ sơ cũ; không dùng mẫu cũ làm mẫu hiện hành.",
            "replaced" => "Thủ tục này đã có quyết định thay thế. Chỉ dùng để đối chiếu hồ sơ cũ; không dùng mẫu cũ làm mẫu hiện hành.",
            "unverified" => "Chưa đối chiếu được chi tiết thủ tục với nguồn công bố; thành phần hồ sơ có thể chưa đầy đủ.",
            _ => null,
        };
        return new ProcedureDetail(p.Id, p.ProcedureCode, p.Name, p.Domain, p.ManagingAgency, p.ExecutionLevel, p.CompetentAuthority, p.Fees, p.ReceivingLocation,
            p.MinistryDecision, p.HanoiDecision, p.WorkflowDecision, p.DelegationDecision, p.DelegationExpiry, p.SourceUrl, p.LifecycleStatus, warning,
            components.Select(c => new ComponentDto(c.Id, c.Section, c.Position, c.Name, c.PaperCode, c.OriginalQuantity, c.CopyQuantity, c.RequiredAsPublished, c.HasElectronicForm,
                templates.Where(t => t.ComponentId == c.Id).Select(t => t.Template).OrderBy(t => t.Filename).ToList())).ToList(),
            lifecycle.Select(e => new LifecycleDto(e.Status, e.Label, e.Note, JsonDocument.Parse(e.Evidence).RootElement.Clone(), e.EffectiveFrom, e.ReviewedOn)).ToList(),
            procedureFiles);
    }

    public async Task<TemplateFile> OpenTemplateAsync(Guid id, CancellationToken ct)
    {
        var t = await db.Read<FormTemplate>().SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw AppException.NotFound("mẫu biểu");
        if (t.StorageKey is null) throw new AppException(404, ErrorCodes.NotFound, "Mẫu này có trong danh mục nhưng nguồn công bố trả về tệp rỗng hoặc chưa tải được. Dùng bản PDF trích nếu có.");
        if (!await storage.ExistsAsync(t.StorageKey, ct)) throw new AppException(404, ErrorCodes.NotFound, "Tệp mẫu không còn trên kho lưu trữ. Báo quản trị để khôi phục từ bản sao lưu.");
        access.Record("download", "form_template", t.Id);
        return new TemplateFile(await storage.OpenReadAsync(t.StorageKey, ct), t.Filename, t.MediaType);
    }
}
