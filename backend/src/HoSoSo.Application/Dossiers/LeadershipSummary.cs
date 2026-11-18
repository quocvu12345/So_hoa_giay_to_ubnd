using HoSoSo.Application.Common;
using HoSoSo.Domain.Entities;
using HoSoSo.Domain.Identity;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Dossiers;

/// <summary>
/// Số hồ sơ theo giai đoạn. <c>Preparing</c> = đang chuẩn bị + yêu cầu bổ sung (chuyên viên còn phải làm); <c>AwaitingCheck</c> = chờ trưởng phòng/Ban kiểm tra;
/// <c>AwaitingOpinion</c> = chờ lãnh đạo cho ý kiến; <c>AwaitingArchive</c> = chờ tiếp nhận nộp lưu; <c>Overdue</c> = quá hạn nội bộ (hạn trước hôm nay giờ Việt Nam,
/// chưa lưu trữ), TÍNH TRONG số hồ sơ đang xử lý nên không cộng thêm; <c>Open</c> = mọi hồ sơ chưa lưu trữ.
/// </summary>
public sealed record StageCounts(int Preparing, int AwaitingCheck, int AwaitingOpinion, int AwaitingArchive, int Overdue, int Open);

/// <summary>Một phòng/ban trong bảng của Chủ tịch UBND.</summary>
public sealed record DepartmentSummary(string DepartmentCode, string DepartmentName, StageCounts Counts);

/// <summary>Một hoạt động trong bảng của lãnh đạo HĐND: <c>Activity</c> là mã ổn định (session, review, oversight, other), <c>WorkGroupCodes</c> là các nhóm hồ sơ thuộc hoạt động đó.</summary>
public sealed record ActivitySummary(string Activity, string Label, IReadOnlyList<string> WorkGroupCodes, StageCounts Counts);

/// <summary>
/// BE-115. Số liệu tổng hợp cho lãnh đạo theo ĐÚNG phân công đang dùng: <c>Departments</c> chỉ có với Chủ tịch UBND, <c>Activities</c> chỉ có với lãnh đạo HĐND.
/// <c>Totals</c> cộng mọi hồ sơ trong phạm vi (kể cả hồ sơ không thuộc phòng/hoạt động nào được liệt kê).
/// </summary>
public sealed record LeadershipSummary(string Role, string? OrganizationCode, DateOnly AsOf, StageCounts Totals,
    IReadOnlyList<DepartmentSummary> Departments, IReadOnlyList<ActivitySummary> Activities);

/// <summary>
/// Bảng ánh xạ nhóm hồ sơ HĐND → ba lối vào của lãnh đạo HĐND (nghiep-vu-vai-tro.html mục 05). ĐÂY LÀ QUYẾT ĐỊNH NGHIỆP VỤ cần chủ nghiệp vụ xác nhận;
/// đổi ở đây là đủ, giao diện đọc mã hoạt động và nhãn từ API. Nhóm không có trong bảng (và nhóm mới thêm vào danh mục) rơi vào "other" nên không bao giờ bị mất khỏi tổng.
/// </summary>
public static class HdndActivities
{
    public static readonly IReadOnlyList<(string Activity, string Label, string[] WorkGroups)> Map =
    [
        ("session", "Kỳ họp và nghị quyết", ["H01", "H02"]),
        ("review", "Thẩm tra của các Ban", ["H03", "H04"]),
        ("oversight", "Giám sát và kiến nghị", ["H05", "H06", "H07", "H08"]),
    ];

    public const string OtherActivity = "other";
    public const string OtherLabel = "Hoạt động khác (đại biểu, chương trình công tác)";
}

public sealed partial class DossierQueries
{
    private sealed record GroupRow(string DepartmentCode, string WorkGroupCode, int Draft, int Returned, int Review, int Leadership, int Ready, int Overdue, int Open);

    /// <summary>
    /// BE-115. Một truy vấn gom nhóm trên <c>scope.Dossiers</c> (cùng quy tắc phạm vi với mọi danh sách): mỗi con số chỉ đếm hồ sơ người dùng thấy được
    /// với phân công đang dùng. Chỉ Chủ tịch và lãnh đạo HĐND có quyền gọi (<c>dossier.decide</c>).
    /// </summary>
    public async Task<LeadershipSummary> LeadershipAsync(CancellationToken ct)
    {
        var today = clock.Today();
        var rows = await scope.Dossiers(db.Read<Dossier>())
            .GroupBy(d => new { d.DepartmentCode, d.WorkGroupCode })
            .Select(g => new GroupRow(g.Key.DepartmentCode, g.Key.WorkGroupCode,
                g.Count(d => d.Status == "draft"), g.Count(d => d.Status == "returned"), g.Count(d => d.Status == "department_review"),
                g.Count(d => d.Status == "leadership_review"), g.Count(d => d.Status == "ready_archive"),
                g.Count(d => d.Status != "archived" && d.InternalDueOn != null && d.InternalDueOn < today),
                g.Count(d => d.Status != "archived")))
            .ToListAsync(ct);

        var role = user.Role ?? "";
        var organization = user.OrganizationCode;
        var departments = new List<DepartmentSummary>();
        var activities = new List<ActivitySummary>();

        if (role == RoleCode.Chair)
        {
            // Mọi phòng/ban của cơ quan, kể cả phòng chưa có hồ sơ nào (0 cũng là thông tin cho Chủ tịch).
            var names = await (from s in db.Read<DepartmentScope>() join d in db.Read<Department>() on s.DepartmentCode equals d.Code
                               where s.OrganizationCode == organization orderby d.Name select new { d.Code, d.Name }).ToListAsync(ct);
            var known = names.Select(n => n.Code).ToHashSet();
            foreach (var n in names) departments.Add(new DepartmentSummary(n.Code, n.Name, Sum(rows.Where(r => r.DepartmentCode == n.Code))));
            // Hồ sơ của phòng không có trong danh sách phạm vi: vẫn hiện, để tổng khớp với các dòng.
            foreach (var extra in rows.Where(r => !known.Contains(r.DepartmentCode)).GroupBy(r => r.DepartmentCode))
                departments.Add(new DepartmentSummary(extra.Key, extra.Key, Sum(extra)));
        }
        else if (role == RoleCode.Council)
        {
            var mapped = HdndActivities.Map.SelectMany(m => m.WorkGroups).ToHashSet();
            foreach (var (activity, label, groups) in HdndActivities.Map)
                activities.Add(new ActivitySummary(activity, label, groups, Sum(rows.Where(r => groups.Contains(r.WorkGroupCode)))));
            var other = rows.Where(r => !mapped.Contains(r.WorkGroupCode)).ToList();
            activities.Add(new ActivitySummary(HdndActivities.OtherActivity, HdndActivities.OtherLabel,
                other.Select(r => r.WorkGroupCode).Distinct().OrderBy(c => c, StringComparer.Ordinal).ToList(), Sum(other)));
        }
        return new LeadershipSummary(role, organization, today, Sum(rows), departments, activities);
    }

    private static StageCounts Sum(IEnumerable<GroupRow> rows)
    {
        var list = rows as IReadOnlyCollection<GroupRow> ?? rows.ToList();
        return new StageCounts(list.Sum(r => r.Draft + r.Returned), list.Sum(r => r.Review), list.Sum(r => r.Leadership), list.Sum(r => r.Ready), list.Sum(r => r.Overdue), list.Sum(r => r.Open));
    }
}
