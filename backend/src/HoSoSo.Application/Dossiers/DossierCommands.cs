using HoSoSo.Application.Common;
using HoSoSo.Domain.Entities;
using HoSoSo.Domain.Identity;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Dossiers;

/// <summary>BE-61, BE-62, BE-65, BE-67: ghi hồ sơ. Sửa chỉ khi hồ sơ ở bước "đang chuẩn bị" hoặc "yêu cầu bổ sung".</summary>
public sealed class DossierCommands(IHoSoDb db, IScopeFilter scope, ICurrentUser user, IClock clock, DossierQueries queries)
{
    private static readonly string[] EditableStatuses = ["draft", "returned"];
    private static readonly TimeSpan VietnamOffset = TimeSpan.FromHours(7);

    public async Task<DossierDetail> CreateAsync(CreateDossierRequest r, CancellationToken ct)
    {
        var me = user.RequireUserId();
        var role = user.RequireRole();
        var group = await db.Read<WorkGroup>().SingleOrDefaultAsync(g => g.Code == r.WorkGroupCode, ct)
            ?? throw new ValidationFailedException(new Dictionary<string, string[]> { ["workGroupCode"] = ["Nhóm hồ sơ không tồn tại."] });

        // Phân công đang dùng phải phủ đơn vị của nhóm: chuyên viên theo đơn vị, văn thư theo cơ quan.
        var covers = role switch
        {
            RoleCode.Employee or RoleCode.Manager => user.OrganizationCode == group.OrganizationCode && user.DepartmentCode == group.DepartmentCode,
            RoleCode.Clerk => user.OrganizationCode == group.OrganizationCode,
            _ => false,
        };
        if (!covers) throw AppException.OutOfScope();
        var procedureId = string.IsNullOrWhiteSpace(r.ProcedureId) ? null : r.ProcedureId.Trim();
        if (procedureId is not null) await EnsureProcedureSelectableAsync(procedureId, ct);

        var now = clock.UtcNow.ToOffset(VietnamOffset);
        var year = r.Year ?? now.Year;
        var code = (await db.Database.SqlQuery<string>($"SELECT hoso.next_dossier_code({group.OrganizationCode}, {year}) AS \"Value\"").ToListAsync(ct)).Single();
        var dossier = new Dossier
        {
            Code = code, Title = r.Title.Trim(), Year = year,
            OrganizationCode = group.OrganizationCode, DepartmentCode = group.DepartmentCode, WorkGroupCode = group.Code,
            WorkflowCode = r.WorkflowCode ?? "in_progress", AccessLevel = r.AccessLevel ?? "internal",
            Notes = r.Notes?.Trim() ?? "", InternalDueOn = r.InternalDueOn, CreatorOrganizationName = r.CreatorOrganizationName?.Trim(),
            CreatedBy = me, AssigneeId = role == RoleCode.Employee ? me : null, OpenedOn = DateOnly.FromDateTime(now.DateTime),
            ProcedureId = procedureId,
        };
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        db.Set<Dossier>().Add(dossier);
        await db.SaveChangesAsync(ct);
        if (role == RoleCode.Employee)
        {
            db.Set<DossierAssignment>().Add(new DossierAssignment { DossierId = dossier.Id, UserId = me, AssignmentRole = "lead", AssignedBy = me, Note = "Người tạo hồ sơ" });
            await db.SaveChangesAsync(ct);
        }
        await transaction.CommitAsync(ct);
        return await queries.GetAsync(dossier.Id, ct);
    }

    public async Task<DossierDetail> UpdateAsync(Guid id, UpdateDossierRequest r, CancellationToken ct)
    {
        var d = await LoadEditableAsync(id, ct);
        db.Entry(d).Property(x => x.Version).OriginalValue = r.Version; // khác bản đang lưu → DbUpdateConcurrencyException → 409
        if (r.Title is not null) d.Title = r.Title.Trim();
        if (r.Notes is not null) d.Notes = r.Notes.Trim();
        if (r.InternalDueOn is not null) d.InternalDueOn = r.InternalDueOn;
        if (r.AccessLevel is not null) d.AccessLevel = r.AccessLevel;
        if (r.PhysicalLocation is not null) d.PhysicalLocation = r.PhysicalLocation.Trim();
        if (r.ProcedureId is not null)
        {
            var procedureId = string.IsNullOrWhiteSpace(r.ProcedureId) ? null : r.ProcedureId.Trim();
            if (procedureId != d.ProcedureId)
            {
                if (procedureId is not null) await EnsureProcedureSelectableAsync(procedureId, ct);
                d.ProcedureId = procedureId;
                // Giấy tờ đã gán vào thành phần của thủ tục cũ không còn nghĩa với thủ tục mới: gỡ gán, không xóa giấy tờ.
                foreach (var link in await db.Set<DossierDocument>().Where(l => l.DossierId == id && l.ProcedureComponentId != null).ToListAsync(ct))
                    link.ProcedureComponentId = null;
            }
        }
        d.UpdatedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        return await queries.GetAsync(id, ct);
    }

    public async Task<IReadOnlyList<DossierDocumentItem>> AddDocumentAsync(Guid id, AddDocumentRequest r, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await MutationLocks.DocumentAsync(db, r.DocumentId, ct);
        await MutationLocks.DossierAsync(db, id, ct);
        var d = await LoadEditableAsync(id, ct);
        var doc = await scope.Documents(db.Set<Document>()).SingleOrDefaultAsync(x => x.Id == r.DocumentId, ct) ?? throw AppException.NotFound("giấy tờ");
        if (await db.Read<FileRecord>().AnyAsync(f => f.DocumentId == doc.Id && f.DisposedAt != null, ct))
            throw AppException.Conflict("Nội dung giấy tờ đã bị hủy nên không xếp vào hồ sơ khác được.");
        if (doc.IntakeStatus is IntakeStatus.Discarded or IntakeStatus.Split)
            throw AppException.Conflict(doc.IntakeStatus == IntakeStatus.Split ? "Giấy tờ này đã được tách thành các văn bản con; hãy xếp các văn bản con." : "Giấy tờ này đã bị bỏ khỏi hộp tiếp nhận. Hoàn tác trước khi xếp vào hồ sơ.");
        var links = db.Set<DossierDocument>();
        if (await links.AnyAsync(l => l.DossierId == id && l.DocumentId == doc.Id, ct)) throw AppException.Conflict("Giấy tờ này đã có trong hồ sơ.");
        if (r.ProcedureComponentId is { } componentId) await EnsureComponentOfProcedureAsync(componentId, d.ProcedureId, ct);
        var position = (await links.Where(l => l.DossierId == id).MaxAsync(l => (int?)l.Position, ct) ?? 0) + 1;
        links.Add(new DossierDocument { DossierId = id, DocumentId = doc.Id, Position = position, Direction = r.Direction, AddedBy = user.RequireUserId(), ProcedureComponentId = r.ProcedureComponentId });
        if (doc.IntakeStatus == IntakeStatus.Inbox) doc.IntakeStatus = IntakeStatus.Filed;
        d.UpdatedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return await queries.DocumentItemsAsync(id, ct);
    }

    public async Task<IReadOnlyList<DossierDocumentItem>> ArrangeAsync(Guid id, IReadOnlyList<DocumentPlacement> placements, CancellationToken ct)
    {
        var d = await LoadEditableAsync(id, ct);
        var links = await db.Set<DossierDocument>().Where(l => l.DossierId == id).ToListAsync(ct);
        var byDocument = links.ToDictionary(l => l.DocumentId);
        var final = links.ToDictionary(l => l.DocumentId, l => l.Position);
        foreach (var p in placements)
        {
            if (!byDocument.ContainsKey(p.DocumentId)) throw AppException.NotFound("giấy tờ trong hồ sơ");
            if (p.Position is { } position) final[p.DocumentId] = position;
            if (p.ProcedureComponentId is { } componentId) await EnsureComponentOfProcedureAsync(componentId, d.ProcedureId, ct);
        }
        if (final.Values.Distinct().Count() != final.Count)
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["position"] = ["Hai giấy tờ không thể cùng một vị trí."] });

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // Ràng buộc UNIQUE(dossier_id, position) không hoãn được: đưa các dòng đổi vị trí sang vùng tạm trước.
        var moving = links.Where(l => final[l.DocumentId] != l.Position).ToList();
        for (var i = 0; i < moving.Count; i++) moving[i].Position = 100_000 + i;
        if (moving.Count > 0) await db.SaveChangesAsync(ct);
        foreach (var l in links) l.Position = final[l.DocumentId];
        foreach (var p in placements)
        {
            var link = byDocument[p.DocumentId];
            if (p.Direction is not null) link.Direction = p.Direction;
            if (p.RelationKind is not null) link.RelationKind = p.RelationKind;
            if (p.ClearProcedureComponent) link.ProcedureComponentId = null;
            else if (p.ProcedureComponentId is { } componentId) link.ProcedureComponentId = componentId;
        }
        d.UpdatedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return await queries.DocumentItemsAsync(id, ct);
    }

    public async Task RemoveDocumentAsync(Guid id, Guid documentId, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await MutationLocks.DocumentAsync(db, documentId, ct);
        await MutationLocks.DossierAsync(db, id, ct);
        var d = await LoadEditableAsync(id, ct);
        var link = await db.Set<DossierDocument>().SingleOrDefaultAsync(l => l.DossierId == id && l.DocumentId == documentId, ct)
            ?? throw AppException.NotFound("giấy tờ trong hồ sơ");
        db.Set<DossierDocument>().Remove(link);
        // PDF do người dùng tải lên và không còn ở hồ sơ nào thì quay về hộp tiếp nhận để xếp lại.
        var doc = await db.Set<Document>().SingleAsync(x => x.Id == documentId, ct);
        var stillLinked = await db.Set<DossierDocument>().AnyAsync(l => l.DocumentId == documentId && l.DossierId != id, ct);
        if (!stillLinked && doc is { Origin: "internal", UploadedBy: not null, IntakeStatus: IntakeStatus.Filed }) doc.IntakeStatus = IntakeStatus.Inbox;
        d.UpdatedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    public async Task<DossierDetail> AssignAsync(Guid id, AssignRequest r, CancellationToken ct)
    {
        if (!await scope.Dossiers(db.Read<Dossier>()).AnyAsync(x => x.Id == id, ct)) throw AppException.NotFound("hồ sơ");
        var me = user.RequireUserId();
        var assignment = user.RequireAssignment();
        var note = r.Note ?? "";
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT hoso.assign_dossier({id}, {me}, {assignment}, {r.UserId}, {r.DueOn}, {note})", ct);
        return await queries.GetAsync(id, ct);
    }

    public async Task<TransitionResult> TransitionAsync(Guid id, TransitionRequest r, CancellationToken ct)
    {
        if (!await scope.Dossiers(db.Read<Dossier>()).AnyAsync(x => x.Id == id, ct)) throw AppException.NotFound("hồ sơ");
        if (!user.Has(WorkflowRules.PermissionFor(r.Action)))
            throw new AppException(403, ErrorCodes.Forbidden, "Phân công đang dùng không có quyền thực hiện thao tác này.");
        var me = user.RequireUserId();
        var assignment = user.RequireAssignment();
        var note = r.Note ?? "";
        // Luật chuyển bước, kiểm tra phạm vi, đủ thành phần, phiên bản và ghi nhật ký nằm trong một hàm SQL (một giao dịch).
        var status = (await db.Database.SqlQuery<string>(
            $"SELECT hoso.transition_dossier({id}, {me}, {assignment}, {r.Action}, {note}, {r.Version}) AS \"Value\"").ToListAsync(ct)).Single();
        var label = await db.Read<WorkflowState>().Where(s => s.Code == status).Select(s => s.Label).SingleAsync(ct);
        return new TransitionResult(status, label);
    }

    /// <summary>Chỉ chọn được thủ tục có trong danh mục và chưa bị bãi bỏ hoặc thay thế (hồ sơ cũ vẫn tra được nhưng không mở hồ sơ mới theo thủ tục đó).</summary>
    private async Task EnsureProcedureSelectableAsync(string procedureId, CancellationToken ct)
    {
        var lifecycle = await db.Read<Procedure>().Where(p => p.Id == procedureId).Select(p => p.LifecycleStatus).SingleOrDefaultAsync(ct);
        if (lifecycle is null)
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["procedureId"] = ["Thủ tục không có trong danh mục."] });
        if (lifecycle is "repealed" or "replaced")
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["procedureId"] = ["Thủ tục này đã bị bãi bỏ hoặc thay thế, không chọn cho hồ sơ mới. Chọn thủ tục hiện hành."] });
    }

    private async Task EnsureComponentOfProcedureAsync(Guid componentId, string? procedureId, CancellationToken ct)
    {
        if (procedureId is null)
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["procedureComponentId"] = ["Hồ sơ chưa chọn thủ tục nên chưa gán được thành phần."] });
        if (!await db.Read<ProcedureComponent>().AnyAsync(c => c.Id == componentId && c.ProcedureId == procedureId, ct))
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["procedureComponentId"] = ["Thành phần này không thuộc thủ tục của hồ sơ."] });
    }

    private async Task<Dossier> LoadEditableAsync(Guid id, CancellationToken ct)
    {
        var d = await scope.Dossiers(db.Set<Dossier>()).SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw AppException.NotFound("hồ sơ");
        if (!EditableStatuses.Contains(d.Status))
            throw AppException.Conflict("Hồ sơ đang ở bước chờ xử lý nên không sửa được. Chờ kết quả hoặc đề nghị trả lại để bổ sung.");
        return d;
    }
}
