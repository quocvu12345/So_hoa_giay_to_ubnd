using HoSoSo.Application.Common;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Infrastructure.Persistence;

/// <summary>
/// BE-15, BE-90. Không viết lại quy tắc phạm vi bằng LINQ: gọi hoso.scope_matches theo đúng phân công đang dùng để mọi nơi cùng một kết quả.
/// Giấy tờ thấy được khi: là văn bản công khai; hoặc là PDF mình nạp còn trong hộp tiếp nhận; hoặc thuộc một hồ sơ thấy được.
/// </summary>
internal sealed class ScopeFilter(ICurrentUser user, HoSoDbContext db) : IScopeFilter
{
    public IQueryable<Dossier> Dossiers(IQueryable<Dossier> query)
    {
        var (userId, assignment) = Actor();
        return query.Where(d => HoSoDbContext.ScopeMatches(userId, d.Id, assignment));
    }

    public IQueryable<Document> Documents(IQueryable<Document> query)
    {
        var (userId, assignment) = Actor();
        var links = db.Set<DossierDocument>();
        return query.Where(doc =>
            doc.Origin == "public_source"
            || (doc.UploadedBy == userId && (doc.IntakeStatus == IntakeStatus.Inbox || doc.IntakeStatus == IntakeStatus.Discarded))
            || links.Any(l => l.DocumentId == doc.Id && HoSoDbContext.ScopeMatches(userId, l.DossierId, assignment)));
    }

    private (Guid UserId, string Assignment) Actor() => (user.RequireUserId(), user.RequireAssignment());
}
