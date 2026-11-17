using HoSoSo.Application.Intake;
using HoSoSo.Application.Operations;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace HoSoSo.Infrastructure.Messaging;

/// <summary>BE-101. Danh sách xóa đã commit trước khi chạy. Mất tiến trình/COMMIT lỗi chỉ cần xóa lại cùng khóa.</summary>
internal sealed class DisposalProcessor(NpgsqlDataSource data, IFileStorage storage, ILogger<DisposalProcessor> logger)
    : BackgroundService, IDisposalProcessor
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var ids = new List<Guid>();
                await using (var command = data.CreateCommand("""
                    SELECT id FROM hoso.disposal_requests r WHERE status = 'executing'
                    AND (NOT EXISTS (SELECT 1 FROM hoso.disposal_blob_deletions d WHERE d.request_id=r.id AND d.completed_at IS NULL)
                         OR EXISTS (SELECT 1 FROM hoso.disposal_blob_deletions d WHERE d.request_id=r.id AND d.completed_at IS NULL AND d.next_attempt_at <= now()))
                    ORDER BY requested_at LIMIT 20
                    """))
                await using (var reader = await command.ExecuteReaderAsync(stoppingToken))
                    while (await reader.ReadAsync(stoppingToken)) ids.Add(reader.GetGuid(0));
                foreach (var id in ids) await ProcessAsync(id, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception e) { logger.LogWarning(e, "disposal_worker_failed"); }
            try { await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    public async Task ProcessAsync(Guid requestId, CancellationToken ct)
    {
        try { await ProcessCoreAsync(requestId, ct); }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception e)
        {
            // Yêu cầu đã được nhận bền vững. DB/kho lỗi thì trạng thái vẫn executing để worker thử lại.
            logger.LogWarning(e, "disposal_pending_retry {RequestId}", requestId);
        }
    }

    private async Task ProcessCoreAsync(Guid id, CancellationToken ct)
    {
        await using var connection = await data.OpenConnectionAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(ct);
        await using var claim = new NpgsqlCommand("SELECT executed_by FROM hoso.disposal_requests WHERE id=$1 AND status='executing' FOR UPDATE SKIP LOCKED", connection, transaction);
        claim.Parameters.AddWithValue(id);
        if (await claim.ExecuteScalarAsync(ct) is not Guid actor) return;
        await using (var context = new NpgsqlCommand("SELECT set_config('hoso.actor_subject', $1, true)", connection, transaction))
        {
            context.Parameters.AddWithValue(actor.ToString());
            await context.ExecuteNonQueryAsync(ct);
        }
        var keys = new List<string>();
        await using (var pending = new NpgsqlCommand("SELECT storage_key FROM hoso.disposal_blob_deletions WHERE request_id=$1 AND completed_at IS NULL AND next_attempt_at <= now() ORDER BY storage_key", connection, transaction))
        {
            pending.Parameters.AddWithValue(id);
            await using var reader = await pending.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) keys.Add(reader.GetString(0));
        }
        foreach (var key in keys)
        {
            await using var shared = new NpgsqlCommand("""
                SELECT EXISTS(SELECT 1 FROM hoso.files WHERE storage_key=$1 AND disposed_at IS NULL)
                    OR EXISTS(SELECT 1 FROM hoso.page_images WHERE preview_storage_key=$1)
                    OR EXISTS(SELECT 1 FROM hoso.form_templates WHERE storage_key=$1)
                    OR EXISTS(SELECT 1 FROM hoso.export_packages WHERE storage_key=$1 AND status='ready')
                """, connection, transaction);
            shared.Parameters.AddWithValue(key);
            var used = await shared.ExecuteScalarAsync(ct) is true;
            bool deleted;
            try { deleted = !used && await storage.DeleteAsync(key, ct); }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                logger.LogWarning("disposal_blob_retry {RequestId} {ErrorType}", id, e.GetType().Name);
                await using var retry = new NpgsqlCommand("""
                    UPDATE hoso.disposal_blob_deletions SET attempts=attempts+1,
                      next_attempt_at=now()+make_interval(secs => least(3600, 5*power(2,least(attempts,10)))::int), last_error=$3
                    WHERE request_id=$1 AND storage_key=$2
                    """, connection, transaction);
                retry.Parameters.AddWithValue(id);
                retry.Parameters.AddWithValue(key);
                retry.Parameters.AddWithValue(e.GetType().Name);
                await retry.ExecuteNonQueryAsync(ct);
                continue;
            }
            await using var complete = new NpgsqlCommand("UPDATE hoso.disposal_blob_deletions SET completed_at=now(), deleted=$3, attempts=attempts+1, last_error=NULL WHERE request_id=$1 AND storage_key=$2", connection, transaction);
            complete.Parameters.AddWithValue(id);
            complete.Parameters.AddWithValue(key);
            complete.Parameters.AddWithValue(deleted);
            await complete.ExecuteNonQueryAsync(ct);
        }
        await using var finish = new NpgsqlCommand("""
            UPDATE hoso.disposal_requests SET status='executed', executed_at=now()
            WHERE id=$1 AND status='executing'
              AND NOT EXISTS (SELECT 1 FROM hoso.disposal_blob_deletions WHERE request_id=$1 AND completed_at IS NULL)
            """, connection, transaction);
        finish.Parameters.AddWithValue(id);
        await finish.ExecuteNonQueryAsync(ct);
        await transaction.CommitAsync(ct);
    }
}
