using System.Globalization;
using System.Text.RegularExpressions;
using HoSoSo.Application.Common;
using HoSoSo.Application.Dossiers;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Documents;

/// <summary>
/// BE-47–50: đối chiếu giấy tờ. AI chỉ GỢI Ý (ai_suggestions); giá trị chỉ vào document_field_values khi người dùng chấp nhận,
/// luôn kèm needs_review=true cho tới khi người dùng xác nhận từng trường.
/// </summary>
public sealed partial class ReviewHandler(IHoSoDb db, IScopeFilter scope, ICurrentUser user, IClock clock, IAccessLog access)
{
    private static readonly string[] EditableDossierStatuses = ["draft", "returned"];

    /// <summary>Ngày/tháng/năm, có thể kèm giờ ("20/01/2026 14:30", "20/01/2026, 14h30"); chỉ phần ngày được chuẩn hóa, giờ nằm lại ở chuỗi gốc.</summary>
    [GeneratedRegex(@"^\s*(\d{1,2})/(\d{1,2})/(\d{4})(?:[\s,]+(?:lúc\s+)?\d{1,2}\s*[:hH]\s*\d{2})?\s*$")]
    private static partial Regex VietnameseDate();

    public async Task<DocumentDetail> GetAsync(Guid id, CancellationToken ct)
    {
        var detail = await DetailAsync(id, ct);
        access.Record("view", "document", id);
        return detail;
    }

    public async Task<ReviewData> ReviewAsync(Guid id, CancellationToken ct)
    {
        var document = await DetailAsync(id, ct);
        var (canEdit, reason) = await EditStateAsync(id, document.Origin, document.IntakeStatus, ct);
        var suggestion = await db.Read<AiSuggestion>().Where(s => s.DocumentId == id)
            .OrderByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id).FirstOrDefaultAsync(ct);

        // Trường lấy theo loại đã xác nhận; chưa xác nhận thì hiển thị theo gợi ý để người dùng xem trước.
        var typeCode = document.Classification?.DocumentTypeCode ?? suggestion?.DocumentTypeCode;
        var fields = typeCode is null ? [] : await BuildFieldsAsync(id, typeCode, suggestion, ct);

        ReviewSuggestion? suggestionDto = null;
        if (suggestion is not null)
        {
            var groupTitle = suggestion.WorkGroupCode is null ? null : await db.Read<WorkGroup>().Where(g => g.Code == suggestion.WorkGroupCode).Select(g => g.Title).SingleOrDefaultAsync(ct);
            var typeName = suggestion.DocumentTypeCode is null ? null : await db.Read<DocumentType>().Where(t => t.Code == suggestion.DocumentTypeCode).Select(t => t.Name).SingleOrDefaultAsync(ct);
            suggestionDto = new ReviewSuggestion(suggestion.Id, suggestion.WorkGroupCode, groupTitle, suggestion.DocumentTypeCode, typeName,
                suggestion.DocumentForm, suggestion.Title, suggestion.Reason, suggestion.Quote, suggestion.EvidenceVerified, suggestion.MixedDocuments, suggestion.Decision, suggestion.ModelKey);
        }

        ReviewJob? job = null;
        if (document.File is { } file)
        {
            job = await db.Read<OcrJob>().Where(j => j.FileId == file.Id && j.JobType == "read_classify")
                .OrderByDescending(j => j.CreatedAt).Select(j => new ReviewJob(j.Id, j.Status, j.Stage, j.ProcessedPages, j.PageCount, j.ErrorMessage)).FirstOrDefaultAsync(ct);
        }
        return new ReviewData(document, suggestionDto, fields, job, canEdit, reason);
    }

    public async Task<ReviewData> ClassifyAsync(Guid id, ClassifyRequest r, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await MutationLocks.DocumentAndDossiersAsync(db, id, ct);
        var doc = await EditableDocumentAsync(id, ct);
        var type = await db.Read<DocumentType>().SingleOrDefaultAsync(t => t.Code == r.DocumentTypeCode && t.WorkGroupCode == r.WorkGroupCode && t.Active
                && db.Set<WorkGroup>().Any(g => g.Code == t.WorkGroupCode && g.Active), ct)
            ?? throw new ValidationFailedException(new Dictionary<string, string[]> { ["documentTypeCode"] = ["Loại giấy tờ không thuộc nhóm hồ sơ đã chọn, hoặc đã ngừng dùng."] });

        var current = await db.Set<DocumentClassification>().Where(c => c.DocumentId == id).ToListAsync(ct);
        var unchanged = current.Any(c => c.WorkGroupCode == r.WorkGroupCode && c.DocumentTypeCode == r.DocumentTypeCode);
        var suggestion = await db.Set<AiSuggestion>().Where(s => s.DocumentId == id).OrderByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id).FirstOrDefaultAsync(ct);
        var matches = suggestion is not null && suggestion.WorkGroupCode == r.WorkGroupCode && suggestion.DocumentTypeCode == r.DocumentTypeCode;

        if (!unchanged)
        {
            if (current.Count > 0)
            {
                if (await db.Read<DocumentFieldValue>().AnyAsync(v => v.DocumentId == id && !v.NeedsReview, ct))
                    throw AppException.Conflict("Giấy tờ đã có trường được xác nhận. Xóa các giá trị đã xác nhận trước khi đổi loại giấy tờ.");
                db.Set<DocumentFieldValue>().RemoveRange(db.Set<DocumentFieldValue>().Where(v => v.DocumentId == id));
                db.Set<DocumentClassification>().RemoveRange(current);
                await db.SaveChangesAsync(ct);
            }
            db.Set<DocumentClassification>().Add(new DocumentClassification
            {
                DocumentId = id, WorkGroupCode = r.WorkGroupCode, DocumentTypeCode = r.DocumentTypeCode, ClassificationStatus = "confirmed",
                Basis = matches ? $"Chấp nhận gợi ý của mô hình {suggestion!.ModelKey}" : "Người dùng chọn loại giấy tờ",
            });
            await db.SaveChangesAsync(ct);
        }

        if (suggestion is not null)
        {
            suggestion.Decision = matches ? "accepted" : "changed";
            suggestion.DecidedBy = user.RequireUserId();
            suggestion.DecidedAt = clock.UtcNow;
        }
        if (matches)
        {
            // Không ghi đè thông tin đầu văn bản mà người dùng đã xác nhận.
            if (doc.MetadataReviewedAt is null)
            {
                if (suggestion!.DocumentForm.Length > 0) doc.DocumentForm = suggestion.DocumentForm;
                if (suggestion.Title.Length > 0) doc.Title = suggestion.Title;
            }
            var fileId = await db.Read<FileRecord>().Where(f => f.DocumentId == id && f.FileRole == "scan").Select(f => (Guid?)f.Id).FirstOrDefaultAsync(ct);
            var existing = (await db.Read<DocumentFieldValue>().Where(v => v.DocumentId == id).Select(v => v.FieldDefinitionCode).ToListAsync(ct)).ToHashSet();
            var typeFields = await db.Read<FieldDefinition>().Where(f => f.DocumentTypeCode == type.Code).ToDictionaryAsync(f => f.Code, ct);
            var suggested = await db.Read<AiFieldSuggestion>().Where(f => f.SuggestionId == suggestion!.Id).ToListAsync(ct);
            foreach (var field in suggested.Where(f => typeFields.ContainsKey(f.FieldDefinitionCode) && !existing.Contains(f.FieldDefinitionCode)))
            {
                // Giá trị AI sao sang bảng chính nhưng LUÔN chờ đối chiếu; nguồn trang/vùng được giữ để người dùng kiểm tra.
                db.Set<DocumentFieldValue>().Add(new DocumentFieldValue
                {
                    DocumentId = id, FieldDefinitionCode = field.FieldDefinitionCode, ValueText = field.Value.Length > 0 ? field.Value : null,
                    ValueNormalized = Normalize(field.Value, IsDate(typeFields[field.FieldDefinitionCode])), ValueOrigin = "ocr", Confidence = field.Confidence,
                    SourceFileId = fileId is not null && field.SourcePages.Length > 0 ? fileId : null,
                    SourcePage = field.SourcePages.Length > 0 && fileId is not null ? field.SourcePages[0] : null,
                    NeedsReview = true, AiFieldSuggestionId = field.Id,
                });
            }
        }
        doc.UpdatedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return await ReviewAsync(id, ct);
    }

    public async Task<ReviewData> EditFieldsAsync(Guid id, EditFieldsRequest r, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await MutationLocks.DocumentAndDossiersAsync(db, id, ct);
        var doc = await EditableDocumentAsync(id, ct);
        var typeCode = await db.Read<DocumentClassification>().Where(c => c.DocumentId == id).Select(c => c.DocumentTypeCode).FirstOrDefaultAsync(ct)
            ?? throw AppException.Conflict("Chọn loại giấy tờ trước khi nhập trường dữ liệu.");
        var definitions = await db.Read<FieldDefinition>().Where(f => f.DocumentTypeCode == typeCode).ToDictionaryAsync(f => f.Code, ct);
        var values = await db.Set<DocumentFieldValue>().Where(v => v.DocumentId == id).ToDictionaryAsync(v => v.FieldDefinitionCode, ct);
        var latest = await db.Read<AiSuggestion>().Where(s => s.DocumentId == id).OrderByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id).Select(s => (long?)s.Id).FirstOrDefaultAsync(ct);
        var suggested = latest is null ? [] : await db.Read<AiFieldSuggestion>().Where(f => f.SuggestionId == latest).ToDictionaryAsync(f => f.FieldDefinitionCode, ct);
        var fileId = await db.Read<FileRecord>().Where(f => f.DocumentId == id && f.FileRole == "scan").Select(f => (Guid?)f.Id).FirstOrDefaultAsync(ct);
        var me = user.RequireUserId();
        var now = clock.UtcNow;

        var errors = new Dictionary<string, string[]>();
        for (var i = 0; i < r.Fields.Count; i++)
        {
            if (!definitions.ContainsKey(r.Fields[i].FieldCode)) errors[$"fields[{i}].fieldCode"] = ["Trường không thuộc loại giấy tờ này."];
        }
        if (errors.Count > 0) throw new ValidationFailedException(errors);

        foreach (var edit in r.Fields)
        {
            var value = string.IsNullOrWhiteSpace(edit.Value) ? null : edit.Value.Trim();
            if (value is { Length: > 2000 }) throw new ValidationFailedException(new Dictionary<string, string[]> { ["fields"] = ["Giá trị một trường tối đa 2000 ký tự."] });
            if (!values.TryGetValue(edit.FieldCode, out var fv))
            {
                fv = new DocumentFieldValue { DocumentId = id, FieldDefinitionCode = edit.FieldCode, ValueOrigin = "manual", SourceFileId = null };
                db.Set<DocumentFieldValue>().Add(fv);
                values[edit.FieldCode] = fv;
            }
            fv.ValueText = value;
            fv.ValueNormalized = Normalize(value ?? "", IsDate(definitions[edit.FieldCode]));
            fv.ValueOrigin = suggested.TryGetValue(edit.FieldCode, out var s) && string.Equals(HoSoText.Fold(s.Value), HoSoText.Fold(value ?? ""), StringComparison.Ordinal) ? "ocr" : "manual";
            fv.NeedsReview = !edit.Verify;
            fv.VerifiedBy = edit.Verify ? me : null;
            fv.VerifiedAt = edit.Verify ? now : null;
        }
        // Sửa dữ liệu sau khi đã xác nhận giấy tờ thì phải xác nhận lại.
        if (doc.DataReviewStatus == "verified") { doc.DataReviewStatus = "pending"; doc.ReviewedBy = null; doc.ReviewedAt = null; }
        doc.UpdatedAt = now;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return await ReviewAsync(id, ct);
    }

    public async Task<ReviewData> ReviewMetadataAsync(Guid id, ReviewMetadataRequest r, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await MutationLocks.DocumentAndDossiersAsync(db, id, ct);
        var doc = await EditableDocumentAsync(id, ct);
        if (doc.Version != r.Version) throw AppException.Conflict("Giấy tờ vừa được cập nhật. Tải lại trước khi xác nhận thông tin.");
        var title = r.Title.Trim();
        var form = r.DocumentForm.Trim();
        var number = string.IsNullOrWhiteSpace(r.DocumentNumber) ? null : r.DocumentNumber.Trim();
        if (doc.Title != title || doc.DocumentForm != form || doc.DocumentNumber != number || doc.IssuedOn != r.IssuedOn)
        {
            doc.DataReviewStatus = "pending";
            doc.ReviewedBy = null;
            doc.ReviewedAt = null;
        }
        doc.Title = title;
        doc.DocumentForm = form;
        doc.DocumentNumber = number;
        doc.IssuedOn = r.IssuedOn;
        doc.MetadataStatus = "header_checked";
        doc.MetadataReviewedBy = user.RequireUserId();
        doc.MetadataReviewedAt = clock.UtcNow;
        doc.MetadataReviewNote = r.Note?.Trim() ?? "";
        doc.UpdatedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return await ReviewAsync(id, ct);
    }

    public async Task<ReviewData> VerifyAsync(Guid id, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await MutationLocks.DocumentAndDossiersAsync(db, id, ct);
        var doc = await EditableDocumentAsync(id, ct);
        var typeCode = await db.Read<DocumentClassification>().Where(c => c.DocumentId == id).Select(c => c.DocumentTypeCode).FirstOrDefaultAsync(ct)
            ?? throw new AppException(422, "review_incomplete", "Chưa chọn loại giấy tờ nên chưa xác nhận được.");
        var required = await db.Read<FieldDefinition>().Where(f => f.DocumentTypeCode == typeCode && f.RequiredForReview).ToListAsync(ct);
        var values = await db.Read<DocumentFieldValue>().Where(v => v.DocumentId == id).ToDictionaryAsync(v => v.FieldDefinitionCode, ct);
        var pending = required.Where(f => !values.TryGetValue(f.Code, out var v) || v.NeedsReview).Select(f => f.Label)
            .Concat(values.Values.Where(v => v.NeedsReview && required.All(f => f.Code != v.FieldDefinitionCode)).Select(v => v.FieldDefinitionCode)).Distinct().ToList();
        if (pending.Count > 0)
            throw new AppException(422, "review_incomplete", $"Còn {pending.Count} trường chưa đối chiếu: {string.Join(", ", pending.Take(5))}{(pending.Count > 5 ? "…" : "")}.", new { fields = pending });
        doc.DataReviewStatus = "verified";
        doc.ReviewedBy = user.RequireUserId();
        doc.ReviewedAt = clock.UtcNow;
        doc.UpdatedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return await ReviewAsync(id, ct);
    }

    // ---- nội bộ ----
    private async Task<DocumentDetail> DetailAsync(Guid id, CancellationToken ct)
    {
        var d = await scope.Documents(db.Read<Document>()).SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw AppException.NotFound("giấy tờ");
        var file = await db.Read<FileRecord>().Where(f => f.DocumentId == id && f.FileRole != "derivative").OrderBy(f => f.VersionNo)
            .Select(f => new FileInfoDto(f.Id, f.OriginalName, f.MediaType, f.ByteSize, f.PageCount, f.Sha256)).FirstOrDefaultAsync(ct);
        var classification = await (from c in db.Read<DocumentClassification>()
                                    join g in db.Read<WorkGroup>() on c.WorkGroupCode equals g.Code
                                    join t in db.Read<DocumentType>() on c.DocumentTypeCode equals t.Code into types
                                    from t in types.DefaultIfEmpty()
                                    where c.DocumentId == id
                                    select new ClassificationDto(c.WorkGroupCode, g.Title, c.DocumentTypeCode, t.Name, c.ClassificationStatus)).FirstOrDefaultAsync(ct);
        var dossiers = await (from l in db.Read<DossierDocument>()
                              join x in scope.Dossiers(db.Read<Dossier>()) on l.DossierId equals x.Id
                              where l.DocumentId == id
                              select new DossierRef(x.Id, x.Code, x.Title, x.Status)).ToListAsync(ct);
        return new DocumentDetail(d.Id, d.Title, d.DocumentForm, d.DocumentNumber, d.IssuedOn, d.Origin, d.IntakeStatus, d.DataReviewStatus, d.MetadataStatus, d.Version, file, classification, dossiers, d.MetadataReviewedBy, d.MetadataReviewedAt, d.MetadataReviewNote);
    }

    private async Task<(bool CanEdit, string? Reason)> EditStateAsync(Guid id, string origin, string intakeStatus, CancellationToken ct)
    {
        if (!user.Has(HoSoSo.Domain.Identity.Permissions.DocumentEdit)) return (false, "Phân công đang dùng không có quyền sửa giấy tờ.");
        if (origin == "public_source") return (false, "Văn bản công khai lấy từ nguồn chính thức, không sửa tại đây.");
        if (intakeStatus is IntakeStatus.Discarded or IntakeStatus.Split) return (false, "Giấy tờ đã bị bỏ hoặc đã tách.");
        var locked = await (from l in db.Read<DossierDocument>()
                            join d in db.Read<Dossier>() on l.DossierId equals d.Id
                            where l.DocumentId == id && !EditableDossierStatuses.Contains(d.Status)
                            select d.Code).FirstOrDefaultAsync(ct);
        return locked is null ? (true, null) : (false, $"Giấy tờ đang nằm trong hồ sơ {locked} ở bước chờ xử lý nên không sửa được.");
    }

    private async Task<Document> EditableDocumentAsync(Guid id, CancellationToken ct)
    {
        var doc = await scope.Documents(db.Set<Document>()).SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw AppException.NotFound("giấy tờ");
        var (canEdit, reason) = await EditStateAsync(id, doc.Origin, doc.IntakeStatus, ct);
        if (!canEdit) throw AppException.Conflict(reason!);
        return doc;
    }

    private async Task<IReadOnlyList<ReviewField>> BuildFieldsAsync(Guid documentId, string typeCode, AiSuggestion? suggestion, CancellationToken ct)
    {
        var definitions = await db.Read<FieldDefinition>().Where(f => f.DocumentTypeCode == typeCode).OrderBy(f => f.Position).ToListAsync(ct);
        var values = await db.Read<DocumentFieldValue>().Where(v => v.DocumentId == documentId).ToDictionaryAsync(v => v.FieldDefinitionCode, ct);
        var suggested = suggestion is null ? [] : await db.Read<AiFieldSuggestion>().Where(f => f.SuggestionId == suggestion!.Id).ToDictionaryAsync(f => f.FieldDefinitionCode, ct);
        var result = new List<ReviewField>();
        foreach (var f in definitions)
        {
            suggested.TryGetValue(f.Code, out var s);
            values.TryGetValue(f.Code, out var v);
            var current = v is not null ? v.ValueText : s?.Value is { Length: > 0 } sv ? sv : null;
            result.Add(new ReviewField(f.Code, f.Label, f.Position, f.ValueType, f.RequiredForReview,
                s?.Value is { Length: > 0 } ? s.Value : null, s?.Quote is { Length: > 0 } ? s.Quote : null, s?.SourcePages ?? [], s?.QuoteVerified ?? false,
                v?.ValueText, v?.NeedsReview ?? true, v is { NeedsReview: false }, Attention(f, s, current)));
        }
        return result;
    }

    /// <summary>Lý do người dùng cần xem kỹ trường này (hiển thị ở khung đối chiếu).</summary>
    private static string? Attention(FieldDefinition f, AiFieldSuggestion? s, string? current)
    {
        if (string.IsNullOrWhiteSpace(current))
            return f.RequiredForReview ? "AI không tìm thấy trường này. Để trống nếu tài liệu không có, không suy đoán." : null;
        if (s is { Value.Length: > 0, QuoteVerified: false })
            return "Chưa tìm thấy đoạn trích dẫn trong văn bản gốc. Kiểm tra trực tiếp trên ảnh trang.";
        if (IsDate(f) && !VietnameseDate().IsMatch(current))
            return "Ngày chưa đúng dạng ngày/tháng/năm.";
        return null;
    }

    /// <summary>Trường ngày theo kiểu của danh mục (migration 028 gán `date` cho mọi trường có nhãn bắt đầu bằng "Ngày").</summary>
    private static bool IsDate(FieldDefinition f) => f.ValueType == "date";

    /// <summary>value_normalized: ngày dạng ISO (2026-01-20) nếu là trường ngày và đọc được; value_text luôn giữ nguyên chuỗi gốc.</summary>
    internal static string? Normalize(string value, bool isDate)
    {
        if (!isDate || string.IsNullOrWhiteSpace(value)) return null;
        var m = VietnameseDate().Match(value);
        if (!m.Success) return null;
        var (d, mo, y) = (int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture), int.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture), int.Parse(m.Groups[3].Value, CultureInfo.InvariantCulture));
        return DateOnly.TryParseExact($"{y:0000}-{mo:00}-{d:00}", "yyyy-MM-dd", out var date) ? date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) : null;
    }
}

/// <summary>Chuẩn hóa chữ để so khớp: bỏ khoảng trắng thừa, không phân biệt hoa thường.</summary>
internal static class HoSoText
{
    public static string Fold(string value) => string.Join(' ', value.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).ToLowerInvariant();
}
