using HoSoSo.Application.Common;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace HoSoSo.Infrastructure.Messaging;

/// <summary>
/// BE-71. Mỗi ngày 7:30 (giờ Việt Nam) nhắc người chủ trì các hồ sơ còn tối đa 2 ngày tới hạn nội bộ hoặc đã quá hạn.
/// Tối đa một nhắc mỗi hồ sơ mỗi ngày (kiểm trong CSDL nên chạy lại hoặc nhiều instance vẫn không nhắc trùng).
/// Hồ sơ đã lưu trữ không bao giờ được nhắc.
/// </summary>
internal sealed class DueReminderService(NpgsqlDataSource dataSource, IClock clock, ILogger<DueReminderService> logger) : BackgroundService
{
    private static readonly TimeSpan Vietnam = TimeSpan.FromHours(7);
    private static readonly TimeSpan RunAt = new(7, 30, 0);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(NextRun(clock.UtcNow) - clock.UtcNow, stoppingToken);
                var created = await RunOnceAsync(clock.UtcNow, stoppingToken);
                logger.LogInformation("due_reminders_sent {Count}", created);
            }
            catch (OperationCanceledException) { return; }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "due_reminders_failed");
                try { await Task.Delay(TimeSpan.FromMinutes(10), stoppingToken); } catch (OperationCanceledException) { return; }
            }
        }
    }

    /// <summary>Lần chạy kế tiếp: 7:30 hôm nay nếu chưa tới, không thì 7:30 ngày mai (giờ Việt Nam).</summary>
    internal static DateTimeOffset NextRun(DateTimeOffset now)
    {
        var local = now.ToOffset(Vietnam);
        var today = new DateTimeOffset(local.Year, local.Month, local.Day, RunAt.Hours, RunAt.Minutes, 0, Vietnam);
        return local < today ? today : today.AddDays(1);
    }

    /// <param name="now">Thời điểm coi là "bây giờ" (đồng hồ giả trong kiểm thử).</param>
    internal async Task<int> RunOnceAsync(DateTimeOffset now, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(now.ToOffset(Vietnam).DateTime);
        var overdue = await MarkOverdueLoansAsync(today, now, ct);
        await using var command = dataSource.CreateCommand("""
            INSERT INTO hoso.notifications(user_id, kind, title, body, link, dossier_id, created_at)
            SELECT d.assignee_id, 'dossier.due',
                   CASE WHEN d.internal_due_on < $1 THEN 'Hồ sơ đã quá hạn nội bộ' ELSE 'Hồ sơ sắp đến hạn nội bộ' END,
                   d.code || ' · ' || d.title || ' · hạn ' || to_char(d.internal_due_on, 'DD/MM/YYYY'),
                   '/ho-so/' || d.id, d.id, $2
            FROM hoso.dossiers d JOIN hoso.users u ON u.id = d.assignee_id AND u.active
            WHERE d.status <> 'archived' AND d.internal_due_on IS NOT NULL AND d.internal_due_on <= $1 + 2
              AND NOT EXISTS (
                SELECT 1 FROM hoso.notifications n WHERE n.dossier_id = d.id AND n.kind = 'dossier.due'
                  AND (n.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = $1)
            """);
        command.Parameters.AddWithValue(today);
        command.Parameters.AddWithValue(now.UtcDateTime);
        return overdue + await command.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// BE-83. Khoản đang mượn quá hạn trả chuyển sang "overdue" và báo cho người mượn cùng các cán bộ có quyền duyệt (văn thư) của cơ quan.
    /// Chỉ khoản "lent" mới chuyển một lần, nên chạy lại hoặc nhiều instance cùng chạy không gửi trùng.
    /// </summary>
    internal async Task<int> MarkOverdueLoansAsync(DateOnly today, DateTimeOffset now, CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand("""
            WITH late AS (
              UPDATE hoso.loans SET status = 'overdue'
              WHERE status = 'lent' AND due_on < $1
              RETURNING id, dossier_id, borrower_id, due_on
            ), targets AS (
              SELECT l.dossier_id, l.borrower_id AS user_id, l.due_on, 'Hồ sơ giấy bạn mượn đã quá hạn trả' AS title FROM late l
              UNION
              SELECT l.dossier_id, ur.user_id, l.due_on, 'Có hồ sơ giấy mượn quá hạn chưa trả'
              FROM late l JOIN hoso.dossiers d ON d.id = l.dossier_id
              JOIN hoso.user_roles ur ON ur.role_code = 'clerk' AND ur.organization_code = d.organization_code
                AND ur.valid_from <= $2 AND (ur.valid_until IS NULL OR ur.valid_until > $2)
              JOIN hoso.users u ON u.id = ur.user_id AND u.active
            )
            INSERT INTO hoso.notifications(user_id, kind, title, body, link, dossier_id, created_at)
            SELECT DISTINCT ON (t.user_id, t.dossier_id) t.user_id, 'loan.overdue', t.title,
                   d.code || ' · ' || d.title || ' · hạn trả ' || to_char(t.due_on, 'DD/MM/YYYY'), '/ho-so/' || d.id, d.id, $2
            FROM targets t JOIN hoso.dossiers d ON d.id = t.dossier_id
            """);
        command.Parameters.AddWithValue(today);
        command.Parameters.AddWithValue(now.UtcDateTime);
        return await command.ExecuteNonQueryAsync(ct);
    }
}
