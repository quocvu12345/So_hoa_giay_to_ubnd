using FluentValidation;
using HoSoSo.Application.Common;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Documents;

public sealed record RelationDto(Guid OtherDocumentId, string OtherTitle, string? OtherNumber, string Relation, string Direction, string Note);
public sealed record AddRelationRequest(Guid ToDocumentId, string Relation, string? Note);

/// <summary>
/// BE-52. Liên kết văn bản: phụ lục, thay thế, sửa đổi, trả lời, liên quan.
/// Chặn vòng ở "phụ lục của" và "thay thế" (A là phụ lục của B thì B không thể là phụ lục của A, kể cả gián tiếp).
/// </summary>
public sealed class RelationsHandler(IHoSoDb db, IScopeFilter scope, ICurrentUser user)
{
    public static readonly string[] Kinds = ["appendix_of", "replaces", "amends", "responds_to", "related"];
    private static readonly string[] Acyclic = ["appendix_of", "replaces"];

    public async Task<IReadOnlyList<RelationDto>> ListAsync(Guid documentId, CancellationToken ct)
    {
        await RequireVisibleAsync(documentId, ct);
        var visible = scope.Documents(db.Read<Document>());
        var outgoing = await (from r in db.Read<DocumentRelation>() join d in visible on r.ToDocumentId equals d.Id where r.FromDocumentId == documentId
                              select new RelationDto(d.Id, d.Title, d.DocumentNumber, r.Relation, "outgoing", r.Note)).ToListAsync(ct);
        var incoming = await (from r in db.Read<DocumentRelation>() join d in visible on r.FromDocumentId equals d.Id where r.ToDocumentId == documentId
                              select new RelationDto(d.Id, d.Title, d.DocumentNumber, r.Relation, "incoming", r.Note)).ToListAsync(ct);
        return outgoing.Concat(incoming).OrderBy(r => r.Relation).ThenBy(r => r.OtherTitle).ToList();
    }

    public async Task<IReadOnlyList<RelationDto>> AddAsync(Guid fromId, AddRelationRequest r, CancellationToken ct)
    {
        if (fromId == r.ToDocumentId)
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["toDocumentId"] = ["Không thể liên kết một văn bản với chính nó."] });
        await RequireVisibleAsync(fromId, ct);
        await RequireVisibleAsync(r.ToDocumentId, ct);
        if (Acyclic.Contains(r.Relation) && await ReachesAsync(r.ToDocumentId, fromId, r.Relation, ct))
        {
            var message = r.Relation == "appendix_of" ? "Liên kết này tạo vòng: văn bản kia đã là phụ lục (trực tiếp hoặc gián tiếp) của văn bản này."
                                                      : "Liên kết này tạo vòng thay thế: văn bản kia đã thay thế (trực tiếp hoặc gián tiếp) văn bản này.";
            throw new AppException(422, "relation_cycle", message);
        }
        db.Set<DocumentRelation>().Add(new DocumentRelation { FromDocumentId = fromId, ToDocumentId = r.ToDocumentId, Relation = r.Relation, Note = r.Note?.Trim() ?? "", CreatedBy = user.RequireUserId() });
        await db.SaveChangesAsync(ct);   // đã có liên kết y hệt: unique violation → 409 duplicate_value
        return await ListAsync(fromId, ct);
    }

    public async Task RemoveAsync(Guid fromId, Guid toId, string relation, CancellationToken ct)
    {
        await RequireVisibleAsync(fromId, ct);
        var link = await db.Set<DocumentRelation>().SingleOrDefaultAsync(x => x.FromDocumentId == fromId && x.ToDocumentId == toId && x.Relation == relation, ct)
            ?? throw AppException.NotFound("liên kết");
        db.Set<DocumentRelation>().Remove(link);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Từ <paramref name="start"/> đi theo cạnh cùng loại có tới <paramref name="target"/> không (tìm theo chiều rộng, có chặn lặp).</summary>
    private async Task<bool> ReachesAsync(Guid start, Guid target, string relation, CancellationToken ct)
    {
        var edges = (await db.Read<DocumentRelation>().Where(x => x.Relation == relation).Select(x => new { x.FromDocumentId, x.ToDocumentId }).ToListAsync(ct))
            .ToLookup(x => x.FromDocumentId, x => x.ToDocumentId);
        var seen = new HashSet<Guid> { start };
        var queue = new Queue<Guid>([start]);
        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            if (current == target) return true;
            foreach (var next in edges[current]) if (seen.Add(next)) queue.Enqueue(next);
        }
        return false;
    }

    private async Task RequireVisibleAsync(Guid id, CancellationToken ct)
    {
        if (!await scope.Documents(db.Read<Document>()).AnyAsync(d => d.Id == id && d.IntakeStatus != IntakeStatus.Discarded, ct)) throw AppException.NotFound("giấy tờ");
    }
}

public sealed class AddRelationValidator : AbstractValidator<AddRelationRequest>
{
    public AddRelationValidator()
    {
        RuleFor(x => x.ToDocumentId).NotEmpty().WithMessage("Chọn văn bản cần liên kết.");
        RuleFor(x => x.Relation).Must(v => RelationsHandler.Kinds.Contains(v)).WithMessage("Loại liên kết: appendix_of, replaces, amends, responds_to hoặc related.");
        RuleFor(x => x.Note).MaximumLength(500).WithMessage("Ghi chú tối đa 500 ký tự.");
    }
}
