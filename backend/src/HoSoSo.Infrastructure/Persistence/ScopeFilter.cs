using HoSoSo.Application.Common;
using HoSoSo.Domain.Entities;
using HoSoSo.Domain.Identity;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Infrastructure.Persistence;

/// <summary>
/// BE-15, BE-90. Không viết lại quy tắc phạm vi bằng LINQ: gọi hoso.scope_matches theo đúng phân công đang dùng để mọi nơi cùng một kết quả.
/// Giấy tờ thấy được khi: là văn bản công khai; hoặc là PDF mình nạp còn trong hộp tiếp nhận; hoặc thuộc một hồ sơ thấy được.
/// </summary>
internal sealed class ScopeFilter(ICurrentUser user, HoSoDbContext db) : IScopeFilter
{
    /// <summary>
    /// Quyết định vẫn là <c>scope_matches</c>. Đứng trước nó là điều kiện CẦN rẻ lấy từ chính phân công đang dùng (cơ quan, phòng, vai trò:
    /// ActiveAssignmentMiddleware đọc cùng một dòng phân công với assignment_scope): quản trị kỹ thuật không thấy gì, khác cơ quan/phòng thì loại,
    /// chuyên viên chỉ hồ sơ mình chủ trì hoặc đang phối hợp. Đây là điều kiện so với tham số nên PostgreSQL xét nó TRƯỚC hàm (thứ tự theo chi phí)
    /// và dùng được chỉ mục; trước đây hàm bị gọi cho mọi dòng đi qua chỉ mục sắp xếp (BE-111: người gần như không thấy hồ sơ nào trong 20.000 mất ~350 ms).
    /// Luôn AND với scope_matches nên không thể làm lộ hồ sơ; nếu quy tắc trong SQL được NỚI (ví dụ chuyên viên thấy cả phòng) mà quên nới ở đây thì
    /// người dùng THIẾU hồ sơ, không bao giờ thừa. ScopePrefilterTests so hai cách cho mọi phân công mẫu, kể cả ủy quyền và phối hợp.
    /// </summary>
    public IQueryable<Dossier> Dossiers(IQueryable<Dossier> query)
    {
        var (userId, assignment) = Actor();
        var (role, organization, department) = (user.Role, user.OrganizationCode, user.DepartmentCode);
        if (role is null || organization is null || role == RoleCode.TechnicalAdmin) return query.Where(_ => false);
        query = query.Where(d => d.OrganizationCode == organization);
        if (department is not null) query = query.Where(d => d.DepartmentCode == department);
        if (role == RoleCode.Employee)
        {
            var coWorking = db.Set<DossierAssignment>();
            query = query.Where(d => d.AssigneeId == userId || coWorking.Any(da => da.DossierId == d.Id && da.UserId == userId && da.EndedAt == null));
        }
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
