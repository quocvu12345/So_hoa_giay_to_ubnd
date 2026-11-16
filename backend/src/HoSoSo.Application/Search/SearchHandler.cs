using System.Text.RegularExpressions;
using HoSoSo.Application.Common;
using HoSoSo.Application.Dossiers;
using HoSoSo.Domain.Entities;
using HoSoSo.Domain.Identity;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Search;

public sealed record SearchHit(string Kind, Guid Id, string Title, string? Subtitle, string? Number, DateOnly? IssuedOn, int? Page, string? Snippet,
    IReadOnlyList<DossierHit> Dossiers);
public sealed record DossierHit(Guid Id, string Code, string Title);

/// <summary><c>Total*</c> là số kết quả trong phạm vi của người dùng (trước khi cắt theo <c>limit</c>); không bao giờ tính giấy tờ hay hồ sơ ngoài phạm vi.</summary>
public sealed record SearchResult(string Query, IReadOnlyList<SearchHit> Hits, int TotalDocuments, int TotalDossiers);

/// <summary>
/// Bộ lọc tra cứu. <c>DocumentType</c>, <c>Form</c>, <c>IssuedFrom</c>, <c>IssuedTo</c> chỉ áp cho giấy tờ (đặt một trong số đó thì bỏ phần hồ sơ);
/// <c>WorkGroup</c>, <c>Department</c> áp cho cả hai (giấy tờ theo nhóm hồ sơ đã phân loại, hồ sơ theo nhóm và đơn vị của hồ sơ).
/// </summary>
public sealed record SearchFilters(string? DocumentType = null, string? WorkGroup = null, string? Department = null, string? Form = null, DateOnly? IssuedFrom = null, DateOnly? IssuedTo = null)
{
    public bool DocumentOnly => DocumentType is { Length: > 0 } || Form is { Length: > 0 } || IssuedFrom is not null || IssuedTo is not null;
}

/// <summary>
/// BE-80. Tìm không dấu trong tiêu đề, số ký hiệu, mã/tên hồ sơ và toàn văn OCR. Kết quả luôn đi qua IScopeFilter:
/// người dùng chỉ thấy giấy tờ và hồ sơ trong phạm vi của phân công đang dùng (kể cả khi có khớp trong OCR của giấy tờ người khác).
/// Phạm vi được áp TRƯỚC khi cắt theo limit và khi đếm tổng, nên số lượng không lộ giấy tờ ngoài phạm vi và giấy tờ của người dùng
/// không bị đẩy ra khỏi danh sách bởi hàng trăm khớp ngoài phạm vi.
/// Số ký hiệu: khớp đúng &gt; chứa chuỗi &gt; gần đúng theo pg_trgm (gõ lệch dấu gạch, khoảng trắng). Tiêu đề và toàn văn OCR: tìm theo từ và tiền tố.
/// Mỗi lần tìm được ghi vào nhật ký truy cập (action search); nhật ký không lưu từ khóa vì từ khóa có thể là tên người hay số định danh.
/// </summary>
public sealed partial class SearchHandler(IHoSoDb db, IScopeFilter scope, ICurrentUser user, IAccessLog access)
{
    /// <summary>Số khớp tối đa lấy từ SQL trước khi lọc phạm vi; tránh một từ quá phổ biến quét cả kho.</summary>
    private const int CandidateCap = 5000;

    [GeneratedRegex(@"[\p{L}\p{N}]+")]
    private static partial Regex Tokens();

    private sealed record Candidate(Guid document_id, double rank, int? page, string? snippet);

    public async Task<SearchResult> SearchAsync(string? query, string kind, int limit, SearchFilters? filters, CancellationToken ct)
    {
        filters ??= new SearchFilters();
        var text = (query ?? "").Trim();
        var tokens = Tokens().Matches(text).Select(m => m.Value).Where(t => t.Length > 0).Take(8).ToList();
        if (text.Length < 2 || tokens.Count == 0)
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["q"] = ["Nhập ít nhất 2 ký tự để tìm."] });
        if (filters.IssuedFrom is { } from && filters.IssuedTo is { } to && from > to)
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["issuedTo"] = ["Ngày kết thúc phải sau hoặc bằng ngày bắt đầu."] });
        limit = Math.Clamp(limit, 1, 50);
        var hits = new List<SearchHit>();
        int totalDocuments = 0, totalDossiers = 0;

        if (kind is "all" or "documents")
        {
            (hits, totalDocuments) = await SearchDocumentsAsync(text, tokens, limit, filters, ct);
        }

        // Bộ lọc chỉ có nghĩa với giấy tờ (loại giấy tờ, hình thức, ngày ban hành) thì phần hồ sơ không có gì để lọc: bỏ qua thay vì trả hồ sơ không được lọc.
        if (kind is "all" or "dossiers" && !filters.DocumentOnly && user.Has(Permissions.DossierRead))
        {
            var folded = text;
            var dossiers = scope.Dossiers(db.Read<Dossier>())
                .Where(d => HoSoDbContextFunctions.Fold(d.Title).Contains(HoSoDbContextFunctions.Fold(folded)) || d.Code.ToLower().Contains(folded.ToLower()));
            if (filters.Department is { Length: > 0 } department) dossiers = dossiers.Where(d => d.DepartmentCode == department);
            if (filters.WorkGroup is { Length: > 0 } workGroup) dossiers = dossiers.Where(d => d.WorkGroupCode == workGroup);
            totalDossiers = await dossiers.CountAsync(ct);
            var rows = await dossiers.OrderByDescending(d => d.UpdatedAt).ThenBy(d => d.Id).Take(limit).Select(d => new { d.Id, d.Code, d.Title }).ToListAsync(ct);
            hits.AddRange(rows.Select(d => new SearchHit("dossier", d.Id, d.Title, d.Code, d.Code, null, null, null, [])));
        }

        access.Record("search", "search", null);
        return new SearchResult(text, hits, totalDocuments, totalDossiers);
    }

    private async Task<(List<SearchHit> Hits, int Total)> SearchDocumentsAsync(string text, List<string> tokens, int limit, SearchFilters filters, CancellationToken ct)
    {
        // tsquery chỉ dựng từ chữ và số đã lọc (không nhận toán tử người dùng gõ), mỗi từ khớp tiền tố: "kiem tra" → kiem:* & tra:*
        var tsQuery = string.Join(" & ", tokens.Select(t => t + ":*"));
        var like = "%" + text.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
        // Phần SQL chỉ tìm và xếp hạng; phạm vi và bộ lọc ghép bằng LINQ ở dưới để cùng một câu truy vấn.
        var candidates = db.Database.SqlQuery<Candidate>($"""
            WITH q AS (SELECT to_tsquery('simple', hoso.f_unaccent({tsQuery})) AS tsq, hoso.f_fold({text}) AS folded),
            meta AS (
              SELECT d.id AS document_id,
                     (CASE WHEN hoso.f_fold(coalesce(d.document_number, '')) = q.folded THEN 3.0
                           WHEN hoso.f_fold(coalesce(d.document_number, '')) LIKE hoso.f_fold({like}) THEN 2.0
                           ELSE 0.0 END
                      + similarity(hoso.f_fold(coalesce(d.document_number, '')), q.folded)
                      + CASE WHEN to_tsvector('simple', hoso.f_unaccent(coalesce(d.document_number, '') || ' ' || d.title)) @@ q.tsq
                             THEN 1.0 + ts_rank(to_tsvector('simple', hoso.f_unaccent(coalesce(d.document_number, '') || ' ' || d.title)), q.tsq) ELSE 0.0 END)::float8 AS rank,
                     NULL::int AS page, NULL::text AS snippet
              FROM hoso.documents d, q
              WHERE d.intake_status <> 'discarded'
                AND (to_tsvector('simple', hoso.f_unaccent(coalesce(d.document_number, '') || ' ' || d.title)) @@ q.tsq
                     OR hoso.f_fold(coalesce(d.document_number, '')) LIKE hoso.f_fold({like})
                     OR hoso.f_fold(coalesce(d.document_number, '')) % q.folded)
            ),
            body AS (
              SELECT DISTINCT ON (f.document_id) f.document_id, ts_rank(p.search_vector, q.tsq)::float8 AS rank, p.page_no AS page,
                     '…' || substr(p.text, greatest(position(hoso.f_fold({tokens[0]}) in hoso.f_fold(p.text)) - 60, 1), 180) || '…' AS snippet
              FROM hoso.ocr_pages p JOIN hoso.ocr_jobs j ON j.id = p.job_id JOIN hoso.files f ON f.id = j.file_id, q
              WHERE p.search_vector @@ q.tsq
              ORDER BY f.document_id, ts_rank(p.search_vector, q.tsq) DESC
            )
            SELECT document_id, max(rank) AS rank, (array_agg(page ORDER BY rank DESC) FILTER (WHERE page IS NOT NULL))[1] AS page,
                   (array_agg(snippet ORDER BY rank DESC) FILTER (WHERE snippet IS NOT NULL))[1] AS snippet
            FROM (SELECT * FROM meta UNION ALL SELECT * FROM body) u
            GROUP BY document_id ORDER BY max(rank) DESC LIMIT {CandidateCap}
            """);

        var documents = scope.Documents(db.Read<Document>()).Where(d => d.IntakeStatus != IntakeStatus.Discarded);
        if (filters.Form is { Length: > 0 } form) documents = documents.Where(d => d.DocumentForm == form);
        if (filters.IssuedFrom is { } issuedFrom) documents = documents.Where(d => d.IssuedOn != null && d.IssuedOn >= issuedFrom);
        if (filters.IssuedTo is { } issuedTo) documents = documents.Where(d => d.IssuedOn != null && d.IssuedOn <= issuedTo);
        var classifications = db.Read<DocumentClassification>();
        if (filters.DocumentType is { Length: > 0 } type)
            documents = documents.Where(d => classifications.Any(c => c.DocumentId == d.Id && c.DocumentTypeCode == type));
        if (filters.WorkGroup is { Length: > 0 } workGroup)
            documents = documents.Where(d => classifications.Any(c => c.DocumentId == d.Id && c.WorkGroupCode == workGroup));
        if (filters.Department is { Length: > 0 } department)
        {
            var groups = db.Read<WorkGroup>();
            documents = documents.Where(d => classifications.Any(c => c.DocumentId == d.Id && groups.Any(g => g.Code == c.WorkGroupCode && g.DepartmentCode == department)));
        }

        var matched = from c in candidates join d in documents on c.document_id equals d.Id select new { Candidate = c, Document = d };
        var total = await matched.CountAsync(ct);
        var chosen = await matched.OrderByDescending(x => x.Candidate.rank).ThenBy(x => x.Document.Id).Take(limit)
            .Select(x => new { x.Candidate.document_id, x.Candidate.page, x.Candidate.snippet, x.Document.Title, x.Document.DocumentForm, x.Document.DocumentNumber, x.Document.IssuedOn })
            .ToListAsync(ct);

        var chosenIds = chosen.Select(r => r.document_id).ToList();
        var links = await (from l in db.Read<DossierDocument>()
                           join d in scope.Dossiers(db.Read<Dossier>()) on l.DossierId equals d.Id
                           where chosenIds.Contains(l.DocumentId)
                           select new { l.DocumentId, Ref = new DossierHit(d.Id, d.Code, d.Title) }).ToListAsync(ct);
        var hits = chosen.Select(r => new SearchHit("document", r.document_id, r.Title, r.DocumentForm, r.DocumentNumber, r.IssuedOn, r.page, r.snippet,
            links.Where(l => l.DocumentId == r.document_id).Select(l => l.Ref).ToList())).ToList();
        return (hits, total);
    }
}
