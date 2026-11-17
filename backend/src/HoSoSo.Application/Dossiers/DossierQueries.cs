using HoSoSo.Application.Common;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Dossiers;

/// <summary>BE-60, BE-64, BE-66, BE-68, BE-69: đọc hồ sơ. Mọi truy vấn đi qua IScopeFilter nên ngoài phạm vi là "không thấy" (404).</summary>
public sealed class DossierQueries(IHoSoDb db, IScopeFilter scope, ICurrentUser user)
{
    public async Task<Page<DossierListItem>> ListAsync(ListDossiersQuery q, CancellationToken ct)
    {
        var limit = Math.Clamp(q.Limit, 1, 100);
        var dossiers = scope.Dossiers(db.Read<Dossier>());
        if (q.Status is { Length: > 0 }) dossiers = dossiers.Where(d => d.Status == q.Status);
        if (q.DepartmentCode is { Length: > 0 }) dossiers = dossiers.Where(d => d.DepartmentCode == q.DepartmentCode);
        if (q.WorkGroupCode is { Length: > 0 }) dossiers = dossiers.Where(d => d.WorkGroupCode == q.WorkGroupCode);
        if (q.Mine) { var me = user.RequireUserId(); dossiers = dossiers.Where(d => d.AssigneeId == me); }
        if (q.Q is { Length: > 1 } text)
        {
            // Tìm không dấu theo tên hoặc mã hồ sơ: "dat dai" khớp "Đất đai".
            dossiers = dossiers.Where(d => HoSoDbContextFunctions.Fold(d.Title).Contains(HoSoDbContextFunctions.Fold(text)) || d.Code.ToLower().Contains(text.ToLower()));
        }
        if (Cursor.Decode(q.Cursor) is var (at, id))
        {
            dossiers = dossiers.Where(d => d.UpdatedAt < at || (d.UpdatedAt == at && d.Id.CompareTo(id) < 0));
        }

        var links = db.Read<DossierDocument>();
        var documents = db.Read<Document>();
        var rows = await (
            from d in dossiers
            join g in db.Read<WorkGroup>() on d.WorkGroupCode equals g.Code
            join s in db.Read<WorkflowState>() on d.Status equals s.Code
            join u in db.Read<User>() on d.AssigneeId equals u.Id into assignees
            from u in assignees.DefaultIfEmpty()
            orderby d.UpdatedAt descending, d.Id descending
            select new DossierListItem(d.Id, d.Code, d.Title, d.Status, s.Label, d.WorkGroupCode, g.Title, d.DepartmentCode,
                u.DisplayName, d.InternalDueOn, d.UpdatedAt,
                links.Count(l => l.DossierId == d.Id && l.RelationKind == "component"),
                links.Count(l => l.DossierId == d.Id && l.RelationKind == "component"
                                 && documents.Any(x => x.Id == l.DocumentId && x.DataReviewStatus == "verified" && x.MetadataStatus != "needs_review" && !db.Read<DocumentFieldValue>().Any(v => v.DocumentId == x.Id && v.NeedsReview))),
                d.Version))
            .Take(limit + 1).ToListAsync(ct);

        var next = rows.Count > limit ? Cursor.Encode(rows[limit - 1].UpdatedAt, rows[limit - 1].Id) : null;
        return new Page<DossierListItem>(rows.Take(limit).ToList(), next);
    }

    /// <summary>
    /// BE-63. Hồ sơ nên xếp giấy tờ này vào: cùng nhóm hồ sơ với gợi ý AI (hoặc loại đã xác nhận), còn ở bước soạn, trong phạm vi
    /// của người dùng, mới cập nhật trước, tối đa 10. Không bao giờ gợi ý hồ sơ đã lưu trữ hoặc đang chờ xử lý.
    /// </summary>
    public async Task<IReadOnlyList<DossierListItem>> SuggestAsync(Guid documentId, CancellationToken ct)
    {
        if (!await scope.Documents(db.Read<Document>()).AnyAsync(d => d.Id == documentId, ct)) throw AppException.NotFound("giấy tờ");
        var suggestedGroup = await db.Read<DocumentClassification>().Where(c => c.DocumentId == documentId).Select(c => c.WorkGroupCode).FirstOrDefaultAsync(ct)
            ?? await db.Read<AiSuggestion>().Where(s => s.DocumentId == documentId && s.WorkGroupCode != null)
                .OrderByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id).Select(s => s.WorkGroupCode).FirstOrDefaultAsync(ct);
        if (suggestedGroup is null) return [];
        var already = db.Read<DossierDocument>().Where(l => l.DocumentId == documentId).Select(l => l.DossierId);
        var links = db.Read<DossierDocument>();
        var documents = db.Read<Document>();
        return await (
            from d in scope.Dossiers(db.Read<Dossier>())
            join g in db.Read<WorkGroup>() on d.WorkGroupCode equals g.Code
            join s in db.Read<WorkflowState>() on d.Status equals s.Code
            join u in db.Read<User>() on d.AssigneeId equals u.Id into assignees
            from u in assignees.DefaultIfEmpty()
            where d.WorkGroupCode == suggestedGroup && (d.Status == "draft" || d.Status == "returned") && !already.Contains(d.Id)
            orderby d.UpdatedAt descending, d.Id descending
            select new DossierListItem(d.Id, d.Code, d.Title, d.Status, s.Label, d.WorkGroupCode, g.Title, d.DepartmentCode, u.DisplayName, d.InternalDueOn, d.UpdatedAt,
                links.Count(l => l.DossierId == d.Id && l.RelationKind == "component"),
                links.Count(l => l.DossierId == d.Id && l.RelationKind == "component" && documents.Any(x => x.Id == l.DocumentId && x.DataReviewStatus == "verified" && x.MetadataStatus != "needs_review" && !db.Read<DocumentFieldValue>().Any(v => v.DocumentId == x.Id && v.NeedsReview))), d.Version))
            .Take(10).ToListAsync(ct);
    }

    public async Task<DossierDetail> GetAsync(Guid id, CancellationToken ct)
    {
        var d = await scope.Dossiers(db.Read<Dossier>()).SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw AppException.NotFound("hồ sơ");
        var group = await db.Read<WorkGroup>().Where(g => g.Code == d.WorkGroupCode).Select(g => g.Title).SingleAsync(ct);
        var statusLabel = await db.Read<WorkflowState>().Where(s => s.Code == d.Status).Select(s => s.Label).SingleAsync(ct);
        var assignee = d.AssigneeId is { } a ? await db.Read<User>().Where(u => u.Id == a).Select(u => u.DisplayName).SingleOrDefaultAsync(ct) : null;
        var documents = await DocumentItemsAsync(id, ct);
        var procedureName = d.ProcedureId is { } pid ? await db.Read<Procedure>().Where(p => p.Id == pid).Select(p => p.Name).SingleOrDefaultAsync(ct) : null;
        return new DossierDetail(d.Id, d.Code, d.Title, d.Status, statusLabel, d.WorkflowCode, d.OrganizationCode, d.DepartmentCode,
            d.WorkGroupCode, group, d.AccessLevel, d.Notes, d.PhysicalLocation, d.CreatorOrganizationName, d.AssigneeId, assignee,
            d.InternalDueOn, d.Year, d.CreatedAt, d.UpdatedAt, d.ArchivedAt, d.Version, documents, CompletenessOf(documents), d.ProcedureId, procedureName);
    }

    public async Task<IReadOnlyList<DossierDocumentItem>> DocumentItemsAsync(Guid dossierId, CancellationToken ct)
    {
        var pending = db.Read<DocumentFieldValue>().Where(f => f.NeedsReview);
        return await (
            from l in db.Read<DossierDocument>()
            join doc in db.Read<Document>() on l.DocumentId equals doc.Id
            where l.DossierId == dossierId
            orderby l.Position
            select new DossierDocumentItem(doc.Id, l.Position, doc.Title, doc.DocumentForm, doc.DocumentNumber, doc.IssuedOn,
                l.Direction, l.RelationKind, doc.DataReviewStatus, doc.IntakeStatus, pending.Count(f => f.DocumentId == doc.Id), l.ProcedureComponentId, doc.MetadataStatus))
            .ToListAsync(ct);
    }

    /// <summary>Đủ để chuyển bước khi có ít nhất một giấy tờ thành phần và tất cả đã đối chiếu, không còn trường chờ xem.</summary>
    internal static Completeness CompletenessOf(IReadOnlyList<DossierDocumentItem> documents)
    {
        var components = documents.Where(x => x.RelationKind == "component").ToList();
        var verified = components.Count(x => x.ReviewStatus == "verified" && x.PendingFields == 0 && x.MetadataStatus != "needs_review");
        var pendingFields = components.Sum(x => x.PendingFields);
        var reasons = new List<string>();
        if (components.Count == 0) reasons.Add("Hồ sơ chưa có giấy tờ thành phần nào.");
        var notReviewed = components.Count(x => x.ReviewStatus != "verified");
        if (notReviewed > 0) reasons.Add($"Còn {notReviewed} giấy tờ chưa đối chiếu xong.");
        if (pendingFields > 0) reasons.Add($"Còn {pendingFields} trường dữ liệu chờ đối chiếu.");
        var metadataPending = components.Count(x => x.MetadataStatus == "needs_review");
        if (metadataPending > 0) reasons.Add($"Còn {metadataPending} giấy tờ cần xác nhận thông tin đầu văn bản.");
        return new Completeness(components.Count, verified, pendingFields, reasons.Count == 0, reasons);
    }

    /// <summary>
    /// BE-64. Hai lớp: (1) từng giấy tờ trong hồ sơ (đã đối chiếu / chờ đối chiếu / chưa phân loại);
    /// (2) nếu hồ sơ thuộc một thủ tục, từng thành phần của thủ tục là <c>ok</c>, <c>pending</c> hoặc <c>missing</c> kèm việc cần làm.
    /// Lớp (2) chỉ cảnh báo; điều kiện cứng để chuyển bước vẫn do hoso.transition_dossier kiểm trên lớp (1).
    /// </summary>
    public async Task<Checklist> ChecklistAsync(Guid id, CancellationToken ct)
    {
        var dossier = await scope.Dossiers(db.Read<Dossier>()).Where(x => x.Id == id).Select(x => new { x.ProcedureId }).SingleOrDefaultAsync(ct)
            ?? throw AppException.NotFound("hồ sơ");
        var documents = await DocumentItemsAsync(id, ct);
        var classified = db.Read<DocumentClassification>();
        var ids = documents.Select(x => x.DocumentId).ToList();
        var classifiedIds = await classified.Where(c => ids.Contains(c.DocumentId)).Select(c => c.DocumentId).Distinct().ToListAsync(ct);
        var items = documents.Where(x => x.RelationKind == "component").Select(x => new ChecklistItem(
            x.DocumentId, x.Title,
            x.ReviewStatus == "verified" && x.PendingFields == 0 && x.MetadataStatus != "needs_review" ? "verified" : classifiedIds.Contains(x.DocumentId) ? "needs_review" : "unclassified",
            x.PendingFields, classifiedIds.Contains(x.DocumentId), x.ProcedureComponentId)).ToList();
        var (name, components, summary) = await ProcedureChecklistAsync(dossier.ProcedureId, documents, ct);
        if (summary is not null) summary = summary with { Enforced = await ProcedureEnforcedAsync(ct) };
        return new Checklist(CompletenessOf(documents), items, dossier.ProcedureId, name, components, summary);
    }

    /// <summary>Cơ quan có bật khóa cứng thành phần thủ tục không (cài đặt <c>dossier.enforce_procedure_components</c>, mặc định tắt). Cổng thật nằm trong hoso.transition_dossier (migration 026); đây chỉ để giao diện báo trước.</summary>
    public const string EnforceSettingKey = "dossier.enforce_procedure_components";

    private async Task<bool> ProcedureEnforcedAsync(CancellationToken ct) =>
        await db.Read<SystemSetting>().Where(s => s.Key == EnforceSettingKey).Select(s => s.Value).SingleOrDefaultAsync(ct) is { } value && value.Trim() == "true";

    private async Task<(string? Name, IReadOnlyList<ChecklistComponent>? Components, ProcedureCompleteness? Summary)> ProcedureChecklistAsync(
        string? procedureId, IReadOnlyList<DossierDocumentItem> documents, CancellationToken ct)
    {
        if (procedureId is null) return (null, null, null);
        var name = await db.Read<Procedure>().Where(p => p.Id == procedureId).Select(p => p.Name).SingleOrDefaultAsync(ct);
        var catalog = await db.Read<ProcedureComponent>().Where(c => c.ProcedureId == procedureId).OrderBy(c => c.Section).ThenBy(c => c.Position).ToListAsync(ct);
        var byComponent = documents.Where(d => d.RelationKind == "component" && d.ProcedureComponentId is not null).ToLookup(d => d.ProcedureComponentId!.Value);

        var components = catalog.Select(c =>
        {
            var linked = byComponent[c.Id].ToList();
            var state = linked.Count == 0 ? "missing"
                : linked.All(d => d.ReviewStatus == "verified" && d.PendingFields == 0 && d.MetadataStatus != "needs_review") ? "ok" : "pending";
            var todo = state switch
            {
                "ok" => "",
                "pending" => $"Đối chiếu {linked.Count(d => d.ReviewStatus != "verified" || d.PendingFields > 0 || d.MetadataStatus == "needs_review")} giấy tờ đã xếp vào mục này.",
                _ when c.RequiredAsPublished => $"Thiếu «{c.Name}»: tải lên rồi xếp giấy tờ vào mục này.",
                _ => "Không bắt buộc theo bản công bố; xếp giấy tờ vào mục này nếu hồ sơ có.",
            };
            return new ChecklistComponent(c.Id, c.Section, c.Position, c.Name, c.RequiredAsPublished, c.OriginalQuantity, c.CopyQuantity, c.HasElectronicForm,
                state, linked.Select(d => d.DocumentId).ToList(), todo);
        }).ToList();

        var required = components.Where(c => c.Required).ToList();
        var missing = required.Count(c => c.State == "missing");
        var pending = required.Count(c => c.State == "pending");
        var warning = missing + pending == 0 ? null
            : $"Theo thủ tục còn {missing} thành phần bắt buộc chưa có giấy tờ và {pending} thành phần chưa đối chiếu xong.";
        return (name, components, new ProcedureCompleteness(required.Count, required.Count(c => c.State == "ok"), pending, missing, missing + pending == 0, warning));
    }

    public async Task<IReadOnlyList<AllowedAction>> ActionsAsync(Guid id, CancellationToken ct)
    {
        var d = await scope.Dossiers(db.Read<Dossier>()).SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw AppException.NotFound("hồ sơ");
        var role = user.RequireRole();
        var rules = await db.Read<WorkflowTransition>()
            .Where(t => t.WorkflowCode == d.WorkflowCode && t.FromState == d.Status && t.ActorRole == role).ToListAsync(ct);
        var documents = await DocumentItemsAsync(id, ct);
        var completeness = CompletenessOf(documents);
        // Thành phần thủ tục còn thiếu: mặc định chỉ cảnh báo; nếu cơ quan bật khóa cứng thì khóa nút như thiếu giấy tờ (CSDL cũng chặn, HS004).
        var needsVerified = rules.Any(t => t.RequiresVerifiedDocuments);
        var procedure = needsVerified ? (await ProcedureChecklistAsync(d.ProcedureId, documents, ct)).Summary : null;
        var procedureIncomplete = procedure is { AllRequiredOk: false };
        var enforced = procedureIncomplete && await ProcedureEnforcedAsync(ct);
        return rules
            .Where(t => user.Has(WorkflowRules.PermissionFor(t.Action)))
            .OrderBy(t => t.Action == "return").ThenBy(t => t.Action)
            .Select(t =>
            {
                var blockedByProcedure = t.RequiresVerifiedDocuments && enforced;
                var blocked = t.RequiresVerifiedDocuments && !completeness.Ready || blockedByProcedure;
                var reasons = completeness.Reasons.Concat(blockedByProcedure && procedure!.Warning is { } w ? [w] : []);
                return new AllowedAction(t.Action, WorkflowRules.Label(t.Action), t.RequiresNote, t.Action != "return", !blocked,
                    blocked ? string.Join(" ", reasons) : null, WorkflowRules.TargetState(t, d.WorkflowCode, d.DepartmentCode, role),
                    t.RequiresVerifiedDocuments && !enforced ? procedure?.Warning : null);
            }).ToList();
    }

    public async Task<IReadOnlyList<HistoryItem>> HistoryAsync(Guid id, CancellationToken ct)
    {
        if (!await scope.Dossiers(db.Read<Dossier>()).AnyAsync(x => x.Id == id, ct)) throw AppException.NotFound("hồ sơ");
        var rows = await (
            from e in db.Read<WorkflowEvent>()
            join u in db.Read<User>() on e.ActorId equals u.Id
            where e.DossierId == id
            orderby e.HappenedAt descending, e.Id descending
            select new { e.Id, e.Action, e.FromState, e.ToState, e.Note, u.DisplayName, e.ActorRole, e.HappenedAt }).ToListAsync(ct);
        var items = rows.Select(e => new HistoryItem(e.Id, e.Action, WorkflowRules.Label(e.Action), e.FromState, e.ToState, e.Note, e.DisplayName, e.ActorRole, e.HappenedAt)).ToList();
        items.AddRange(await LocationMovesAsync(id, ct));
        return items.OrderByDescending(i => i.At).ThenByDescending(i => i.Id).ToList();
    }

    private sealed record PathRow(Guid id, string path);

    /// <summary>BE-82. Lần đặt/chuyển vị trí lưu kho nằm chung dòng thời gian với các bước nghiệp vụ (mã âm để không trùng mã sự kiện).</summary>
    private async Task<List<HistoryItem>> LocationMovesAsync(Guid dossierId, CancellationToken ct)
    {
        var moves = await (
            from m in db.Read<DossierLocationMove>()
            join u in db.Read<User>() on m.MovedBy equals u.Id into actors
            from actor in actors.DefaultIfEmpty()
            where m.DossierId == dossierId
            select new { m.Id, m.FromLocationId, m.ToLocationId, m.Note, m.MovedAt, Actor = actor != null ? actor.DisplayName : "Hệ thống" }).ToListAsync(ct);
        if (moves.Count == 0) return [];
        var ids = moves.SelectMany(m => new[] { m.FromLocationId, m.ToLocationId }).Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToArray();
        var paths = ids.Length == 0 ? [] : (await db.Database.SqlQuery<PathRow>($"""
            WITH RECURSIVE up AS (
              SELECT l.id AS leaf, l.id, l.parent_id, l.name, 1 AS n FROM hoso.storage_locations l WHERE l.id = ANY({ids})
              UNION ALL
              SELECT u.leaf, p.id, p.parent_id, p.name, u.n + 1 FROM hoso.storage_locations p JOIN up u ON p.id = u.parent_id
            )
            SELECT leaf AS id, string_agg(name, ' › ' ORDER BY n DESC) AS path FROM up GROUP BY leaf
            """).ToListAsync(ct)).ToDictionary(r => r.id, r => r.path);
        string Where(Guid? location) => location is { } l && paths.TryGetValue(l, out var path) ? path : "chưa xếp";
        return moves.Select(m => new HistoryItem(-m.Id, "location.moved", m.ToLocationId is null ? "Bỏ vị trí lưu kho" : "Đặt/chuyển vị trí lưu kho", null, "",
            $"{Where(m.FromLocationId)} → {Where(m.ToLocationId)}" + (m.Note.Length > 0 ? $". {m.Note}" : ""), m.Actor, "", m.MovedAt)).ToList();
    }

    public async Task<Workspace> QueueAsync(CancellationToken ct)
    {
        var rows = await QueueRowsAsync(ct);
        var ids = rows.Select(r => r.DossierId).ToList();
        var info = await (from d in db.Read<Dossier>() join s in db.Read<WorkflowState>() on d.Status equals s.Code
                          where ids.Contains(d.Id) select new { d.Id, d.Code, d.Title, d.Status, s.Label }).ToDictionaryAsync(x => x.Id, ct);
        var grouped = rows.GroupBy(r => r.QueueKind).ToDictionary(g => g.Key, g => (IReadOnlyList<QueueItem>)g.Select(r =>
            new QueueItem(r.DossierId, info[r.DossierId].Code, info[r.DossierId].Title, r.Status, info[r.DossierId].Label, r.DueOn, r.UpdatedAt)).ToList());
        return new Workspace(grouped);
    }

    public async Task<WorkspaceSummary> SummaryAsync(CancellationToken ct)
    {
        var counts = (await QueueRowsAsync(ct)).GroupBy(r => r.QueueKind).ToDictionary(g => g.Key, g => g.Count());
        var me = user.RequireUserId();
        var inbox = await db.Read<Document>().CountAsync(x => x.UploadedBy == me && x.IntakeStatus == IntakeStatus.Inbox, ct);
        var unread = await db.Read<Notification>().CountAsync(n => n.UserId == me && n.ReadAt == null, ct);
        return new WorkspaceSummary(counts, inbox, unread);
    }

    // Tên cột snake_case do quy ước đặt tên của EF (cũng áp dụng cho kiểu tạm trong SqlQuery).
    private sealed record QueueRow(Guid DossierId, string QueueKind, string Status, DateOnly? DueOn, DateTimeOffset UpdatedAt);

    private async Task<List<QueueRow>> QueueRowsAsync(CancellationToken ct)
    {
        var me = user.RequireUserId();
        var assignment = user.RequireAssignment();
        return await db.Database.SqlQuery<QueueRow>(
            $"SELECT dossier_id, queue_kind, status, due_on, updated_at FROM hoso.my_queue({me}, {assignment})")
            .ToListAsync(ct);
    }
}
