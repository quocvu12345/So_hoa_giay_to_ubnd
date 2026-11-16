using HoSoSo.Application.Common;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace HoSoSo.Application.Admin;

/// <summary>Ngưỡng cảnh báo sao lưu (cấu hình <c>Backup:*</c>). Mặc định theo docs/06-log-va-giam-sat.md: quá 26 giờ không có bản thành công là cảnh báo cao.</summary>
public sealed class BackupPolicy
{
    public int MaxAgeHours { get; set; } = 26;

    /// <summary>Diễn tập khôi phục hằng quý (docs/02): quá 100 ngày chưa có lần diễn tập nào là nhắc.</summary>
    public int RestoreTestMaxDays { get; set; } = 100;

    /// <summary>Lần sao lưu ở trạng thái "đang chạy" lâu hơn mức này coi là treo.</summary>
    public int StuckRunningHours { get; set; } = 12;
}

/// <summary>Tình trạng một loại sao lưu. <c>Required</c>: cơ sở dữ liệu và kho tệp phải có hằng ngày; cấu hình chỉ để tham khảo.</summary>
public sealed record BackupKindStatus(string Kind, bool Required, DateTimeOffset? LastSuccessAt, double? AgeHours, bool Overdue,
    string? LastRunStatus, DateTimeOffset? LastRunAt);

public sealed record BackupStatus(bool Healthy, IReadOnlyList<BackupKindStatus> Kinds, DateTimeOffset? LastRestoreTestedAt, bool RestoreTestOverdue,
    IReadOnlyList<string> Problems);

/// <summary>
/// BE-89. Đọc <c>backup_runs</c> và nói sao lưu có đang ổn không: bản thành công gần nhất của cơ sở dữ liệu và kho tệp, lần chạy gần nhất có lỗi hay treo không,
/// và đã diễn tập khôi phục trong quý chưa. Dùng cho màn Vận hành, cho dịch vụ nền gửi cảnh báo và cho chỉ số theo dõi.
/// </summary>
public sealed class BackupMonitor(IHoSoDb db, IClock clock, IOptions<BackupPolicy> options)
{
    private static readonly (string Kind, string Label, bool Required)[] Kinds =
        [("database", "cơ sở dữ liệu", true), ("files", "kho tệp", true), ("config", "cấu hình", false)];

    public async Task<BackupStatus> StatusAsync(CancellationToken ct)
    {
        var policy = options.Value;
        var now = clock.UtcNow;
        var runs = db.Read<BackupRun>();
        var problems = new List<string>();
        var statuses = new List<BackupKindStatus>();

        foreach (var (kind, label, required) in Kinds)
        {
            var lastSuccess = await runs.Where(b => b.Kind == kind && b.Status == "succeeded").MaxAsync(b => b.FinishedAt, ct);
            var last = await runs.Where(b => b.Kind == kind).OrderByDescending(b => b.StartedAt).ThenByDescending(b => b.Id)
                .Select(b => new { b.Status, b.StartedAt, b.Note }).FirstOrDefaultAsync(ct);
            var age = lastSuccess is { } ok ? (now - ok).TotalHours : (double?)null;
            var overdue = required && (age is null || age > policy.MaxAgeHours);
            statuses.Add(new BackupKindStatus(kind, required, lastSuccess, age is null ? null : Math.Round(age.Value, 1), overdue, last?.Status, last?.StartedAt));

            if (required && age is null) problems.Add($"Chưa có bản sao lưu {label} nào thành công.");
            else if (overdue) problems.Add($"Bản sao lưu {label} thành công gần nhất cách {Math.Floor(age!.Value)} giờ (ngưỡng {policy.MaxAgeHours} giờ).");
            if (last is { Status: "failed" } && (lastSuccess is null || last.StartedAt > lastSuccess))
                problems.Add($"Lần sao lưu {label} gần nhất thất bại{(last.Note.Length > 0 ? ": " + Shorten(last.Note) : ".")}");
            if (last is { Status: "running" } && now - last.StartedAt > TimeSpan.FromHours(policy.StuckRunningHours))
                problems.Add($"Lần sao lưu {label} bắt đầu từ {last.StartedAt.ToOffset(TimeSpan.FromHours(7)):dd/MM HH:mm} vẫn chưa kết thúc.");
        }

        // Diễn tập khôi phục: hệ thống mới chạy chưa đủ lâu thì chưa tính là quá hạn.
        var restoreTested = await runs.MaxAsync(b => b.RestoreTestedAt, ct);
        var firstSuccess = await runs.Where(b => b.Kind == "database" && b.Status == "succeeded").MinAsync(b => b.FinishedAt, ct);
        var window = TimeSpan.FromDays(policy.RestoreTestMaxDays);
        var restoreOverdue = restoreTested is { } tested ? now - tested > window : firstSuccess is { } first && now - first > window;
        if (restoreOverdue)
            problems.Add(restoreTested is null
                ? $"Chưa từng diễn tập khôi phục từ bản sao lưu (đã chạy hơn {policy.RestoreTestMaxDays} ngày)."
                : $"Lần diễn tập khôi phục gần nhất cách hơn {policy.RestoreTestMaxDays} ngày.");

        return new BackupStatus(problems.Count == 0, statuses, restoreTested, restoreOverdue, problems);
    }

    private static string Shorten(string note) => note.Length <= 200 ? note : note[..200] + "…";
}
