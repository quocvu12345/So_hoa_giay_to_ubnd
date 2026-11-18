using HoSoSo.Application.Common;
using HoSoSo.Domain.Entities;
using HoSoSo.Domain.Identity;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Dossiers;

/// <summary>BE-60, BE-64, BE-66, BE-68, BE-69: đọc hồ sơ. Mọi truy vấn đi qua IScopeFilter nên ngoài phạm vi là "không thấy" (404).</summary>
public sealed partial class DossierQueries(IHoSoDb db, IScopeFilter scope, ICurrentUser user, IClock clock)
{
    public static readonly string[] SortColumns = ["updated", "code", "title", "due"];
    /// <summary>Số hồ sơ tối đa một lần xuất CSV. Vượt thì từ chối thay vì cắt bớt âm thầm (người dùng sẽ tưởng bản xuất đầy đủ).</summary>
    public const int MaxExportRows = 10_000;

    /// <summary>
    /// Bộ lọc dùng chung cho danh sách và xuất CSV (BE-60, BE-111), luôn qua phạm vi của phân công đang dùng. Năm, người chủ trì, quá hạn
    /// (hạn nội bộ trước hôm nay giờ Việt Nam, hồ sơ chưa lưu trữ), vị trí kho (gồm mọi vị trí con) đều AND với các bộ lọc còn lại.
    /// </summary>
    private async Task<IQueryable<Dossier>> FilteredAsync(ListDossiersQuery q, CancellationToken ct)
    {
        var dossiers = scope.Dossiers(db.Read<Dossier>());
        if (Values(q.Status, "status") is { Count: > 0 } statuses) dossiers = statuses.Count == 1 ? dossiers.Where(d => d.Status == statuses[0]) : dossiers.Where(d => statuses.Contains(d.Status));
        if (q.DepartmentCode is { Length: > 0 }) dossiers = dossiers.Where(d => d.DepartmentCode == q.DepartmentCode);
        if (Values(q.WorkGroupCode, "workGroup") is { Count: > 0 } groups) dossiers = groups.Count == 1 ? dossiers.Where(d => d.WorkGroupCode == groups[0]) : dossiers.Where(d => groups.Contains(d.WorkGroupCode));
        if (q.Year is { } year) dossiers = dossiers.Where(d => d.Year == year);
        if (q.AssigneeId is { } assignee) dossiers = dossiers.Where(d => d.AssigneeId == assignee);
        if (q.Overdue)
        {
            var today = clock.Today();
            dossiers = dossiers.Where(d => d.InternalDueOn != null && d.InternalDueOn < today && d.Status != "archived");
        }
        if (q.LocationId is { } location)
        {
            var ids = await LocationWithDescendantsAsync(location, ct);
            dossiers = dossiers.Where(d => d.StorageLocationId != null && ids.Contains(d.StorageLocationId.Value));
        }
        if (q.Mine) { var me = user.RequireUserId(); dossiers = dossiers.Where(d => d.AssigneeId == me); }
        if (q.Q is { Length: > 1 } text)
        {
            // Tìm không dấu theo tên hoặc mã hồ sơ: "dat dai" khớp "Đất đai".
            dossiers = dossiers.Where(d => HoSoDbContextFunctions.Fold(d.Title).Contains(HoSoDbContextFunctions.Fold(text)) || d.Code.ToLower().Contains(text.ToLower()));
        }
        return dossiers;
    }

    /// <summary>
    /// Bộ lọc nhận một hoặc nhiều giá trị cách nhau dấu phẩy ("draft,returned"), để một liên kết từ bảng tổng hợp ra đúng con số (BE-115).
    /// Tối đa 12 giá trị, mỗi giá trị tối đa 40 ký tự; vượt thì 400 thay vì tạo truy vấn lớn tùy ý.
    /// </summary>
    private static List<string> Values(string? text, string field)
    {
        if (string.IsNullOrWhiteSpace(text)) return [];
        var values = text.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Distinct(StringComparer.Ordinal).ToList();
        if (values.Count > 12 || values.Any(v => v.Length > 40))
            throw new ValidationFailedException(new Dictionary<string, string[]> { [field] = ["Tối đa 12 giá trị, mỗi giá trị tối đa 40 ký tự, cách nhau bằng dấu phẩy."] });
        return values;
    }

    /// <summary>Cây vị trí chỉ có 5 cấp (kho › phòng › tủ › kệ › hộp), nên đi từng cấp vài truy vấn nhỏ thay cho truy vấn đệ quy.</summary>
    private async Task<List<Guid>> LocationWithDescendantsAsync(Guid root, CancellationToken ct)
    {
        var all = new List<Guid> { root };
        var level = new List<Guid> { root };
        for (var depth = 0; depth < 5 && level.Count > 0; depth++)
        {
            level = await db.Read<StorageLocation>().Where(l => l.ParentId != null && level.Contains(l.ParentId.Value)).Select(l => l.Id).ToListAsync(ct);
            all.AddRange(level);
        }
        return all;
    }

    private static (string Sort, bool Descending) Ordering(ListDossiersQuery q)
    {
        var sort = string.IsNullOrWhiteSpace(q.Sort) ? "updated" : q.Sort.Trim().ToLowerInvariant();
        if (!SortColumns.Contains(sort))
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["sort"] = [$"Chỉ sắp xếp theo: {string.Join(", ", SortColumns)}."] });
        if (q.Dir is { Length: > 0 } dir && dir.ToLowerInvariant() is not ("asc" or "desc"))
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["dir"] = ["Chiều sắp xếp là asc hoặc desc."] });
        // Mặc định: mới cập nhật trước; các cột còn lại tăng dần (hạn gần nhất trước).
        var descending = q.Dir is { Length: > 0 } d ? d.Equals("desc", StringComparison.OrdinalIgnoreCase) : sort == "updated";
        return (sort, descending);
    }

    private static IOrderedQueryable<Dossier> Sorted(IQueryable<Dossier> dossiers, string sort, bool descending) => (sort, descending) switch
    {
        ("code", false) => dossiers.OrderBy(d => d.Code).ThenBy(d => d.Id),
        ("code", true) => dossiers.OrderByDescending(d => d.Code).ThenByDescending(d => d.Id),
        ("title", false) => dossiers.OrderBy(d => d.Title).ThenBy(d => d.Id),
        ("title", true) => dossiers.OrderByDescending(d => d.Title).ThenByDescending(d => d.Id),
        // Hồ sơ chưa có hạn luôn xếp CUỐI, cả khi sắp giảm dần (PostgreSQL mặc định đặt NULL đầu khi giảm dần).
        ("due", false) => dossiers.OrderBy(d => d.InternalDueOn == null).ThenBy(d => d.InternalDueOn).ThenBy(d => d.Id),
        ("due", true) => dossiers.OrderBy(d => d.InternalDueOn == null).ThenByDescending(d => d.InternalDueOn).ThenByDescending(d => d.Id),
        (_, false) => dossiers.OrderBy(d => d.UpdatedAt).ThenBy(d => d.Id),
        _ => dossiers.OrderByDescending(d => d.UpdatedAt).ThenByDescending(d => d.Id),
    };

    /// <summary>Lấy các hồ sơ đứng SAU điểm cursor theo đúng thứ tự đang sắp (keyset: không lặp, không sót, nhanh ở trang sâu).</summary>
    private static IQueryable<Dossier> After(IQueryable<Dossier> dossiers, string sort, bool descending, SortCursor c)
    {
        var id = c.Id;
        switch (sort)
        {
            case "code":
                var code = c.Key ?? "";
                return descending ? dossiers.Where(d => string.Compare(d.Code, code) < 0 || (d.Code == code && d.Id.CompareTo(id) < 0))
                                  : dossiers.Where(d => string.Compare(d.Code, code) > 0 || (d.Code == code && d.Id.CompareTo(id) > 0));
            case "title":
                var title = c.Key ?? "";
                return descending ? dossiers.Where(d => string.Compare(d.Title, title) < 0 || (d.Title == title && d.Id.CompareTo(id) < 0))
                                  : dossiers.Where(d => string.Compare(d.Title, title) > 0 || (d.Title == title && d.Id.CompareTo(id) > 0));
            case "due":
                if (c.Key is null)      // đang ở nhóm chưa có hạn (cuối danh sách): chỉ còn các hồ sơ chưa có hạn đứng sau theo Id
                    return dossiers.Where(d => d.InternalDueOn == null && (descending ? d.Id.CompareTo(id) < 0 : d.Id.CompareTo(id) > 0));
                var due = DateOnly.ParseExact(c.Key, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);
                return descending
                    ? dossiers.Where(d => d.InternalDueOn == null || d.InternalDueOn < due || (d.InternalDueOn == due && d.Id.CompareTo(id) < 0))
                    : dossiers.Where(d => d.InternalDueOn == null || d.InternalDueOn > due || (d.InternalDueOn == due && d.Id.CompareTo(id) > 0));
            default:
                var at = new DateTimeOffset(long.Parse(c.Key ?? "0", System.Globalization.CultureInfo.InvariantCulture), TimeSpan.Zero);
                return descending ? dossiers.Where(d => d.UpdatedAt < at || (d.UpdatedAt == at && d.Id.CompareTo(id) < 0))
                                  : dossiers.Where(d => d.UpdatedAt > at || (d.UpdatedAt == at && d.Id.CompareTo(id) > 0));
        }
    }

    private static string KeyOf(string sort, DossierListItem item) => sort switch
    {
        "code" => item.Code,
        "title" => item.Title,
        "due" => item.DueOn?.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture)!,
        _ => item.UpdatedAt.UtcTicks.ToString(System.Globalization.CultureInfo.InvariantCulture),
    };

    public async Task<Page<DossierListItem>> ListAsync(ListDossiersQuery q, CancellationToken ct)
    {
        var limit = Math.Clamp(q.Limit, 1, 100);
        var (sort, descending) = Ordering(q);
        var dossiers = await FilteredAsync(q, ct);
        if (SortCursor.Decode(q.Cursor, sort, descending) is { } cursor) dossiers = After(dossiers, sort, descending, cursor);

        var links = db.Read<DossierDocument>();
        var documents = db.Read<Document>();
        var ordered = Sorted(dossiers, sort, descending);
        var rows = await (
            from d in ordered
            join g in db.Read<WorkGroup>() on d.WorkGroupCode equals g.Code
            join s in db.Read<WorkflowState>() on d.Status equals s.Code
            join u in db.Read<User>() on d.AssigneeId equals u.Id into assignees
            from u in assignees.DefaultIfEmpty()
            select new DossierListItem(d.Id, d.Code, d.Title, d.Status, s.Label, d.WorkGroupCode, g.Title, d.DepartmentCode,
                u.DisplayName, d.InternalDueOn, d.UpdatedAt,
                links.Count(l => l.DossierId == d.Id && l.RelationKind == "component"),
                links.Count(l => l.DossierId == d.Id && l.RelationKind == "component"
                                 && documents.Any(x => x.Id == l.DocumentId && x.DataReviewStatus == "verified" && x.MetadataStatus != "needs_review" && !db.Read<DocumentFieldValue>().Any(v => v.DocumentId == x.Id && v.NeedsReview))),
                d.Version))
            .Take(limit + 1).ToListAsync(ct);

        var last = rows.Count > limit ? rows[limit - 1] : null;
        var next = last is null ? null : SortCursor.Encode(sort, descending, KeyOf(sort, last), last.Id);
        return new Page<DossierListItem>(rows.Take(limit).ToList(), next);
    }

    /// <summary>Một dòng của bản xuất CSV: những gì hiển thị ở danh sách cộng vị trí kho. Không có nội dung giấy tờ.</summary>
    public sealed record ExportRow(string Code, string Title, string WorkGroupTitle, string DepartmentCode, string StatusLabel, string? AssigneeName,
        DateOnly? DueOn, DateTimeOffset UpdatedAt, int DocumentCount, string? Location);

    /// <summary>
    /// BE-111. Cùng bộ lọc và thứ tự với danh sách, nhưng không phân trang. Quá <see cref="MaxExportRows"/> hồ sơ thì 422 (thu hẹp bộ lọc),
    /// không cắt bớt: bản xuất thiếu mà tưởng đủ nguy hiểm hơn là không có.
    /// </summary>
    public async Task<IReadOnlyList<ExportRow>> ExportAsync(ListDossiersQuery q, CancellationToken ct)
    {
        var (sort, descending) = Ordering(q);
        var ordered = Sorted(await FilteredAsync(q with { Cursor = null }, ct), sort, descending);
        var links = db.Read<DossierDocument>();
        var rows = await (
            from d in ordered
            join g in db.Read<WorkGroup>() on d.WorkGroupCode equals g.Code
            join s in db.Read<WorkflowState>() on d.Status equals s.Code
            join u in db.Read<User>() on d.AssigneeId equals u.Id into assignees
            from u in assignees.DefaultIfEmpty()
            join l in db.Read<StorageLocation>() on d.StorageLocationId equals l.Id into locations
            from l in locations.DefaultIfEmpty()
            select new ExportRow(d.Code, d.Title, g.Title, d.DepartmentCode, s.Label, u.DisplayName, d.InternalDueOn, d.UpdatedAt,
                links.Count(x => x.DossierId == d.Id && x.RelationKind == "component"),
                l == null ? d.PhysicalLocation : l.Code + " · " + l.Name))
            .Take(MaxExportRows + 1).ToListAsync(ct);
        if (rows.Count > MaxExportRows)
            throw new AppException(422, "export_too_large", $"Có hơn {MaxExportRows:N0} hồ sơ khớp bộ lọc. Thu hẹp bộ lọc (năm, trạng thái, phòng) rồi xuất lại.");
        return rows;
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

    /// <summary>
    /// BE-110. Người có thể giao chủ trì hồ sơ này, cho trưởng phòng chọn. Cùng quy tắc với hàm SQL assign_dossier (nơi quyết định cuối cùng): người dùng còn hoạt động
    /// có phân công RIÊNG "chuyên viên" còn hiệu lực ở đúng cơ quan và phòng của hồ sơ. Ủy quyền không được tính vì assign_dossier từ chối người chỉ có ủy quyền,
    /// nên đưa họ vào danh sách sẽ mời chọn người mà lúc giao bị từ chối. Hồ sơ ngoài phạm vi phân công đang dùng: 404 (không lộ có hồ sơ hay không).
    /// Không trả email, tên đăng nhập hay vai trò khác của người đó: chỉ những gì cần để chọn.
    /// </summary>
    public async Task<IReadOnlyList<AssigneeOption>> AssigneesAsync(Guid dossierId, CancellationToken ct)
    {
        var d = await scope.Dossiers(db.Read<Dossier>()).Where(x => x.Id == dossierId)
            .Select(x => new { x.OrganizationCode, x.DepartmentCode, x.AssigneeId }).SingleOrDefaultAsync(ct) ?? throw AppException.NotFound("hồ sơ");
        var now = clock.UtcNow;
        var today = clock.Today();
        var candidates = await (
            from ur in db.Read<UserRole>()
            join u in db.Read<User>() on ur.UserId equals u.Id
            where u.Active && ur.RoleCode == RoleCode.Employee && ur.OrganizationCode == d.OrganizationCode && ur.DepartmentCode == d.DepartmentCode
                  && ur.ValidFrom <= now && (ur.ValidUntil == null || ur.ValidUntil > now)
            group ur by new { u.Id, u.DisplayName } into g
            select new { g.Key.Id, g.Key.DisplayName, IsDeputy = g.All(x => x.IsDeputy) }).ToListAsync(ct);
        var ids = candidates.Select(c => c.Id).ToList();
        // Đếm trên mọi hồ sơ họ chủ trì, KHÔNG qua phạm vi của người đang xem: trưởng phòng cần biết tải thật của chuyên viên (số liệu, không phải nội dung).
        var held = await db.Read<Dossier>().Where(x => x.AssigneeId != null && ids.Contains(x.AssigneeId.Value) && x.Status != "archived")
            .GroupBy(x => x.AssigneeId!.Value)
            .Select(g => new { UserId = g.Key, Holding = g.Count(), Overdue = g.Count(x => x.InternalDueOn != null && x.InternalDueOn < today) }).ToListAsync(ct);
        var load = held.ToDictionary(x => x.UserId);
        return candidates
            .Select(c => new AssigneeOption(c.Id, c.DisplayName, c.IsDeputy, c.Id == d.AssigneeId,
                load.TryGetValue(c.Id, out var l) ? l.Holding : 0, load.TryGetValue(c.Id, out l) ? l.Overdue : 0))
            .OrderByDescending(a => a.IsCurrent).ThenBy(a => a.Holding).ThenBy(a => a.DisplayName, StringComparer.Create(new System.Globalization.CultureInfo("vi-VN"), true))
            .ToList();
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
            d.InternalDueOn, d.Year, d.CreatedAt, d.UpdatedAt, d.ArchivedAt, d.Version, documents, CompletenessOf(documents), d.ProcedureId, procedureName,
            await RetentionOfAsync(d, ct));
    }

    /// <summary>BE-130. Cùng luật chọn quy tắc với đề nghị hủy (<see cref="HoSoSo.Application.Operations.DisposalHandler.Resolve"/>): chỉ quy tắc đã xác nhận mới có hiệu lực.</summary>
    private async Task<DossierRetention> RetentionOfAsync(Dossier d, CancellationToken ct)
    {
        var rules = await db.Read<RetentionRule>().Where(r => (r.WorkGroupCode == d.WorkGroupCode && r.DocumentTypeCode == null) || r.Id == d.RetentionRuleId).ToListAsync(ct);
        var confirmed = rules.Where(r => r.Status == "confirmed" && r.RetentionYears != null).ToList();
        if (HoSoSo.Application.Operations.DisposalHandler.Resolve(d, confirmed) is { } applied)
        {
            var years = applied.RetentionYears!.Value;
            DateTimeOffset? since = d.ArchivedAt?.AddYears(years);
            return new DossierRetention("confirmed", applied.RetentionLabel, years, applied.LegalReference, since, since is { } s && s <= clock.UtcNow);
        }
        if (confirmed.Count(r => r.DocumentTypeCode is null) > 1) return new DossierRetention("ambiguous", null, null, null, null, false);
        return rules.FirstOrDefault(r => r.Status == "proposed") is { } proposed
            ? new DossierRetention("proposed", proposed.RetentionLabel, proposed.RetentionYears, proposed.LegalReference, null, false)
            : new DossierRetention("none", null, null, null, null, false);
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
