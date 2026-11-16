using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;
using System.Text.Json;

namespace HoSoSo.Infrastructure.Messaging;

/// <summary>
/// BE-20, BE-70. Lấy việc từ outbox_messages (ghi cùng giao dịch với thay đổi nghiệp vụ) bằng FOR UPDATE SKIP LOCKED,
/// nên chạy nhiều instance vẫn xử lý mỗi thông điệp đúng một lần. Lỗi thì thử lại sau 5 giây, 30 giây, 5 phút;
/// quá 10 lần thì ghi Error và hoãn 1 ngày để người vận hành xem (không mất thông điệp).
/// </summary>
internal sealed class OutboxDispatcher(NpgsqlDataSource dataSource, ILogger<OutboxDispatcher> logger) : BackgroundService
{
    internal const int MaxAttempts = 10;
    private static readonly TimeSpan[] Backoff = [TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(30), TimeSpan.FromMinutes(5)];
    private static readonly TimeSpan Idle = TimeSpan.FromSeconds(2);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (await ProcessBatchAsync(stoppingToken) > 0) continue;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "outbox_batch_failed");
            }
            try { await Task.Delay(Idle, stoppingToken); } catch (OperationCanceledException) { return; }
        }
    }

    /// <summary>Xử lý tối đa 20 thông điệp đến hạn. Trả số thông điệp đã động tới.</summary>
    internal async Task<int> ProcessBatchAsync(CancellationToken ct)
    {
        await using var connection = await dataSource.OpenConnectionAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(ct);
        var messages = new List<(long Id, string Type, string Payload, int Attempts)>();
        await using (var select = new NpgsqlCommand(
            "SELECT id, type, payload::text, attempts FROM hoso.outbox_messages WHERE processed_at IS NULL AND next_attempt_at <= now() " +
            "ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 20", connection, transaction))
        await using (var reader = await select.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct)) messages.Add((reader.GetInt64(0), reader.GetString(1), reader.GetString(2), reader.GetInt16(3)));
        }

        foreach (var message in messages)
        {
            await transaction.SaveAsync("message", ct);
            try
            {
                await HandleAsync(connection, transaction, message.Type, message.Payload, ct);
                await using var done = new NpgsqlCommand("UPDATE hoso.outbox_messages SET processed_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = $1", connection, transaction);
                done.Parameters.AddWithValue(message.Id);
                await done.ExecuteNonQueryAsync(ct);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                await transaction.RollbackAsync("message", ct);
                var attempts = message.Attempts + 1;
                var wait = attempts >= MaxAttempts ? TimeSpan.FromDays(1) : Backoff[Math.Min(attempts - 1, Backoff.Length - 1)];
                if (attempts >= MaxAttempts) logger.LogError(exception, "outbox_gave_up {MessageId} {Type} {Attempts}", message.Id, message.Type, attempts);
                else logger.LogWarning(exception, "outbox_retry {MessageId} {Type} {Attempts}", message.Id, message.Type, attempts);
                await using var fail = new NpgsqlCommand(
                    "UPDATE hoso.outbox_messages SET attempts = $2, next_attempt_at = now() + make_interval(secs => $3), last_error = left($4, 1000) WHERE id = $1", connection, transaction);
                fail.Parameters.AddWithValue(message.Id);
                fail.Parameters.AddWithValue((short)attempts);
                fail.Parameters.AddWithValue(wait.TotalSeconds);
                fail.Parameters.AddWithValue(exception.Message);
                await fail.ExecuteNonQueryAsync(ct);
            }
        }
        await transaction.CommitAsync(ct);
        return messages.Count;
    }

    private async Task HandleAsync(NpgsqlConnection connection, NpgsqlTransaction transaction, string type, string payload, CancellationToken ct)
    {
        using var doc = JsonDocument.Parse(payload);
        var p = doc.RootElement;
        switch (type)
        {
            case "dossier.transitioned":
                await NotifyTransitionAsync(connection, transaction, p, ct);
                break;
            case "dossier.assigned":
                await InsertAsync(connection, transaction, [p.GetProperty("userId").GetGuid()], p.GetProperty("dossierId").GetGuid(),
                    "dossier.assigned", "Bạn được giao chủ trì một hồ sơ", exclude: p.GetProperty("assignedBy").GetGuid(), note: null, ct);
                break;
            case "loan.requested":
                {
                    var dossierId = p.GetProperty("dossierId").GetGuid();
                    var (organization, _, _) = await DossierAsync(connection, transaction, dossierId, ct);
                    await InsertAsync(connection, transaction, await HoldersAsync(connection, transaction, "clerk", organization, null, ct), dossierId,
                        "loan.requested", "Có đề nghị mượn hồ sơ giấy chờ duyệt", p.GetProperty("borrowerId").GetGuid(), null, ct);
                    break;
                }
            case "loan.approved":
            case "loan.rejected":
            case "loan.lent":
                {
                    var (title, note) = type switch
                    {
                        "loan.approved" => ("Đề nghị mượn hồ sơ của bạn đã được duyệt", (string?)null),
                        "loan.lent" => ("Hồ sơ giấy đã được giao cho bạn", null),
                        _ => ("Đề nghị mượn hồ sơ của bạn bị từ chối", await LoanNoteAsync(connection, transaction, p.GetProperty("loanId").GetGuid(), ct)),
                    };
                    await InsertAsync(connection, transaction, [p.GetProperty("borrowerId").GetGuid()], p.GetProperty("dossierId").GetGuid(), type, title, p.GetProperty("actorId").GetGuid(), note, ct);
                    break;
                }
            case "archive.submitted":
                await InsertSubmissionAsync(connection, transaction, await HoldersAsync(connection, transaction, "clerk", p.GetProperty("organization").GetString()!, null, ct), p,
                    "archive.submitted", "Có đợt nộp lưu chờ tiếp nhận", ct);
                break;
            case "archive.received":
                await InsertSubmissionAsync(connection, transaction, [p.GetProperty("submittedBy").GetGuid()], p, "archive.received", "Đợt nộp lưu đã được tiếp nhận", ct);
                break;
            case "archive.returned":
                await InsertSubmissionAsync(connection, transaction, [p.GetProperty("submittedBy").GetGuid()], p, "archive.returned", "Đợt nộp lưu bị trả lại", ct);
                break;
            case "disposal.requested":
                {
                    var dossierId = p.GetProperty("dossierId").GetGuid();
                    var organization = p.GetProperty("organization").GetString()!;
                    await InsertAsync(connection, transaction, await HoldersAsync(connection, transaction, organization == "tl-hdnd" ? "council" : "chair", organization, null, ct), dossierId,
                        "disposal.requested", "Có đề nghị hủy hồ sơ chờ bạn phê duyệt", p.GetProperty("actorId").GetGuid(), null, ct);
                    break;
                }
            case "disposal.approved":
            case "disposal.rejected":
                {
                    var title = type == "disposal.approved" ? "Đề nghị hủy hồ sơ đã được phê duyệt, có thể thực hiện" : "Đề nghị hủy hồ sơ bị từ chối";
                    var note = type == "disposal.rejected" ? await DisposalNoteAsync(connection, transaction, p.GetProperty("disposalId").GetGuid(), ct) : null;
                    await InsertAsync(connection, transaction, [p.GetProperty("requestedBy").GetGuid()], p.GetProperty("dossierId").GetGuid(), type, title, p.GetProperty("actorId").GetGuid(), note, ct);
                    break;
                }
            default:
                logger.LogWarning("outbox_unknown_type {Type}", type);   // loại lạ: đánh dấu xong, không chặn hàng đợi
                break;
        }
    }

    private async Task NotifyTransitionAsync(NpgsqlConnection connection, NpgsqlTransaction transaction, JsonElement p, CancellationToken ct)
    {
        var dossierId = p.GetProperty("dossierId").GetGuid();
        var to = p.GetProperty("to").GetString()!;
        var actor = p.GetProperty("actorId").GetGuid();
        var (organization, department, assignee) = await DossierAsync(connection, transaction, dossierId, ct);
        var note = await LastNoteAsync(connection, transaction, dossierId, ct);

        switch (to)
        {
            case "department_review":
                await InsertAsync(connection, transaction, await HoldersAsync(connection, transaction, "manager", organization, department, ct), dossierId,
                    "dossier.awaiting_review", "Hồ sơ chờ bạn kiểm tra", actor, null, ct);
                break;
            case "leadership_review":
                await InsertAsync(connection, transaction, await HoldersAsync(connection, transaction, organization == "tl-hdnd" ? "council" : "chair", organization, null, ct), dossierId,
                    "dossier.awaiting_decision", "Hồ sơ chờ bạn cho ý kiến", actor, null, ct);
                break;
            case "ready_archive":
                await InsertAsync(connection, transaction, await HoldersAsync(connection, transaction, "clerk", organization, null, ct), dossierId,
                    "dossier.awaiting_archive", "Hồ sơ chờ tiếp nhận nộp lưu", actor, null, ct);
                if (assignee is { } a1) await InsertAsync(connection, transaction, [a1], dossierId, "dossier.accepted", "Hồ sơ đã đạt, chuyển nộp lưu", actor, null, ct);
                break;
            case "returned":
                if (assignee is { } a2) await InsertAsync(connection, transaction, [a2], dossierId, "dossier.returned", "Hồ sơ bị trả lại để bổ sung", actor, note, ct);
                break;
            case "archived":
                if (assignee is { } a3) await InsertAsync(connection, transaction, [a3], dossierId, "dossier.archived", "Hồ sơ đã nộp lưu", actor, null, ct);
                break;
        }
    }

    private static async Task<(string Organization, string Department, Guid? Assignee)> DossierAsync(NpgsqlConnection c, NpgsqlTransaction t, Guid id, CancellationToken ct)
    {
        await using var command = new NpgsqlCommand("SELECT organization_code, department_code, assignee_id FROM hoso.dossiers WHERE id = $1", c, t);
        command.Parameters.AddWithValue(id);
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) throw new InvalidOperationException($"Hồ sơ {id} không còn tồn tại.");
        return (reader.GetString(0), reader.GetString(1), reader.IsDBNull(2) ? null : reader.GetGuid(2));
    }

    private static async Task<string?> DisposalNoteAsync(NpgsqlConnection c, NpgsqlTransaction t, Guid id, CancellationToken ct)
    {
        await using var command = new NpgsqlCommand("SELECT nullif(decision_note, '') FROM hoso.disposal_requests WHERE id = $1", c, t);
        command.Parameters.AddWithValue(id);
        return await command.ExecuteScalarAsync(ct) as string;
    }

    private static async Task<string?> LoanNoteAsync(NpgsqlConnection c, NpgsqlTransaction t, Guid id, CancellationToken ct)
    {
        await using var command = new NpgsqlCommand("SELECT nullif(decision_note, '') FROM hoso.loans WHERE id = $1", c, t);
        command.Parameters.AddWithValue(id);
        return await command.ExecuteScalarAsync(ct) as string;
    }

    private static async Task<string?> LastNoteAsync(NpgsqlConnection c, NpgsqlTransaction t, Guid id, CancellationToken ct)
    {
        await using var command = new NpgsqlCommand("SELECT note FROM hoso.workflow_events WHERE dossier_id = $1 ORDER BY id DESC LIMIT 1", c, t);
        command.Parameters.AddWithValue(id);
        return await command.ExecuteScalarAsync(ct) as string;
    }

    /// <summary>Người đang giữ vai trò (còn hiệu lực, còn hoạt động) trong cơ quan, và đơn vị nếu vai trò gắn đơn vị.</summary>
    private static async Task<List<Guid>> HoldersAsync(NpgsqlConnection c, NpgsqlTransaction t, string role, string organization, string? department, CancellationToken ct)
    {
        await using var command = new NpgsqlCommand(
            "SELECT DISTINCT ur.user_id FROM hoso.user_roles ur JOIN hoso.users u ON u.id = ur.user_id AND u.active " +
            "WHERE ur.role_code = $1 AND ur.organization_code = $2 AND ($3::text IS NULL OR ur.department_code IS NULL OR ur.department_code = $3) " +
            "AND ur.valid_from <= now() AND (ur.valid_until IS NULL OR ur.valid_until > now())", c, t);
        command.Parameters.AddWithValue(role);
        command.Parameters.AddWithValue(organization);
        command.Parameters.Add(new NpgsqlParameter { Value = (object?)department ?? DBNull.Value, NpgsqlDbType = NpgsqlTypes.NpgsqlDbType.Text });
        var users = new List<Guid>();
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) users.Add(reader.GetGuid(0));
        return users;
    }

    /// <summary>Thông báo về một đợt nộp lưu (không gắn một hồ sơ cụ thể); người thực hiện không tự nhận thông báo của mình.</summary>
    private static async Task InsertSubmissionAsync(NpgsqlConnection c, NpgsqlTransaction t, IReadOnlyCollection<Guid> users, JsonElement p, string kind, string title, CancellationToken ct)
    {
        var submission = p.GetProperty("submissionId").GetGuid();
        var actor = p.GetProperty("actorId").GetGuid();
        foreach (var user in users.Where(u => u != actor).Distinct())
        {
            await using var command = new NpgsqlCommand(
                "INSERT INTO hoso.notifications(user_id, kind, title, body, link) " +
                "SELECT $1, $2, $3, s.code || coalesce(E'\\nÝ kiến: ' || nullif(s.return_note, ''), ''), '/nop-luu/' || s.id FROM hoso.archive_submissions s WHERE s.id = $4", c, t);
            command.Parameters.AddWithValue(user);
            command.Parameters.AddWithValue(kind);
            command.Parameters.AddWithValue(title);
            command.Parameters.AddWithValue(submission);
            await command.ExecuteNonQueryAsync(ct);
        }
    }

    private static async Task InsertAsync(NpgsqlConnection c, NpgsqlTransaction t, IReadOnlyCollection<Guid> users, Guid dossierId, string kind, string title, Guid exclude, string? note, CancellationToken ct)
    {
        foreach (var user in users.Where(u => u != exclude).Distinct())
        {
            await using var command = new NpgsqlCommand(
                "INSERT INTO hoso.notifications(user_id, kind, title, body, link, dossier_id) " +
                "SELECT $1, $2, $3, d.code || ' · ' || d.title || coalesce(E'\\nÝ kiến: ' || $4, ''), '/ho-so/' || d.id, d.id FROM hoso.dossiers d WHERE d.id = $5", c, t);
            command.Parameters.AddWithValue(user);
            command.Parameters.AddWithValue(kind);
            command.Parameters.AddWithValue(title);
            command.Parameters.Add(new NpgsqlParameter { Value = (object?)note ?? DBNull.Value, NpgsqlDbType = NpgsqlTypes.NpgsqlDbType.Text });
            command.Parameters.AddWithValue(dossierId);
            await command.ExecuteNonQueryAsync(ct);
        }
    }
}
