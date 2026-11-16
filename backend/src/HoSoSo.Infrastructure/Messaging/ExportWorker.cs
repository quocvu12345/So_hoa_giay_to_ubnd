using System.IO.Compression;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using HoSoSo.Application.Common;
using HoSoSo.Application.Intake;
using HoSoSo.Infrastructure.Storage;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace HoSoSo.Infrastructure.Messaging;

/// <summary>
/// BE-86. Đóng gói xuất nền. Mỗi lần lấy một yêu cầu "queued" (FOR UPDATE SKIP LOCKED nên nhiều instance không đóng trùng),
/// ghi ZIP theo luồng vào tệp tạm: mỗi PDF chép từ kho sang ZIP qua bộ đệm 80 KB và băm SHA-256 ngay lúc chép (bộ nhớ không tăng theo dung lượng gói),
/// đối chiếu với mã băm đã ghi khi tiếp nhận; lệch hoặc mất tệp thì gói báo lỗi thay vì giao một gói thiếu.
/// Cuối gói: metadata.json, danh-muc.csv và manifest.sha256 (dạng `sha256sum -c`).
/// Tiến độ đi qua trigger → pg_notify → SSE. Gói hết hạn sau 7 ngày thì xóa nội dung. Việc treo (mất nhịp 10 phút) được xếp lại.
/// </summary>
internal sealed class ExportWorker(NpgsqlDataSource dataSource, IFileStorage storage, LocalFileStorage local, IClock clock, ILogger<ExportWorker> logger) : BackgroundService
{
    public static readonly TimeSpan Retention = TimeSpan.FromDays(7);
    private static readonly TimeSpan Idle = TimeSpan.FromSeconds(2);

    private sealed record Job(Guid Id, Guid RequestedBy, string Format, Guid[] DossierIds);
    private sealed record Entry(string Path, string Sha256);
    private sealed record DossierRow(Guid Id, string Code, string Title, string Status, string Organization, string Department, string WorkGroup, DateTimeOffset? ArchivedAt, string? Location);
    private sealed record DocRow(Guid DossierId, int Position, string Relation, Guid DocumentId, string Title, string Form, string? Number, DateOnly? IssuedOn, string? TypeCode,
        Guid? FileId, string? OriginalName, string? MediaType, string? StorageKey, string? Sha256, long? ByteSize, int? Pages, DateTimeOffset? DisposedAt);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var lastSweep = DateTimeOffset.MinValue;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (clock.UtcNow - lastSweep > TimeSpan.FromMinutes(1))
                {
                    lastSweep = clock.UtcNow;
                    await RequeueStaleAsync(stoppingToken);
                    await ExpireAsync(stoppingToken);
                }
                if (await ProcessNextAsync(stoppingToken)) continue;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception exception) { logger.LogWarning(exception, "export_loop_failed"); }
            try { await Task.Delay(Idle, stoppingToken); } catch (OperationCanceledException) { return; }
        }
    }

    /// <summary>Xử lý một yêu cầu nếu có. Trả false khi hàng đợi trống.</summary>
    internal async Task<bool> ProcessNextAsync(CancellationToken ct)
    {
        var job = await ClaimAsync(ct);
        if (job is null) return false;
        var temp = local.TempPath($"export-{job.Id:N}");
        try
        {
            await BuildAsync(job, temp, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            await RequeueAsync(job.Id);   // tắt máy chủ giữa chừng: việc quay lại hàng đợi
            throw;
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "export_failed {ExportId}", job.Id);
            await FailAsync(job.Id, exception is ExportException ? exception.Message : "Lỗi hệ thống khi đóng gói. Báo quản trị kèm mã gói xuất.");
        }
        finally
        {
            if (File.Exists(temp)) File.Delete(temp);
        }
        return true;
    }

    private async Task<Job?> ClaimAsync(CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand("""
            UPDATE hoso.export_packages SET status = 'running', started_at = now(), heartbeat_at = now(), error_message = NULL
            WHERE id = (SELECT id FROM hoso.export_packages WHERE status = 'queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
            RETURNING id, requested_by, format, scope::text
            """);
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        using var scope = JsonDocument.Parse(reader.GetString(3));
        var ids = scope.RootElement.GetProperty("dossierIds").EnumerateArray().Select(e => e.GetGuid()).ToArray();
        return new Job(reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), ids);
    }

    private async Task BuildAsync(Job job, string temp, CancellationToken ct)
    {
        var dossiers = await LoadDossiersAsync(job.DossierIds, ct);
        var docs = await LoadDocumentsAsync(job.DossierIds, ct);
        var fields = await LoadFieldsAsync(docs.Select(d => d.DocumentId).Distinct().ToArray(), ct);
        var manifest = new List<Entry>();
        var catalog = new List<string[]>();
        var metadata = new List<object>();

        await using (var file = new FileStream(temp, FileMode.Create, FileAccess.ReadWrite, FileShare.None, 81920, useAsync: true))
        using (var zip = new ZipArchive(file, ZipArchiveMode.Create, leaveOpen: true))
        {
            var processed = 0;
            foreach (var dossier in dossiers)
            {
                ct.ThrowIfCancellationRequested();
                var items = new List<object>();
                foreach (var doc in docs.Where(d => d.DossierId == dossier.Id).OrderBy(d => d.Position))
                {
                    string? path = null;
                    string? note = null;
                    if (doc.FileId is null) note = "Chưa có tệp số";
                    else if (doc.DisposedAt is not null) note = "Tệp đã hủy theo quyết định";
                    else if (doc.StorageKey is null) note = "Chỉ có siêu dữ liệu, chưa có nội dung trong kho";
                    else
                    {
                        path = $"{dossier.Code}/{doc.Position:00}-{Slug(doc.Title)}{Extension(doc.OriginalName, doc.MediaType)}";
                        var sha = await CopyFileAsync(zip, path, doc, ct);
                        manifest.Add(new Entry(path, sha));
                        await HeartbeatAsync(job.Id, processed, ct);
                    }
                    items.Add(new
                    {
                        position = doc.Position, documentId = doc.DocumentId, title = doc.Title, documentForm = doc.Form, documentNumber = doc.Number, issuedOn = doc.IssuedOn,
                        documentTypeCode = doc.TypeCode, relation = doc.Relation, file = path, sha256 = path is null ? null : doc.Sha256, pages = doc.Pages, note,
                        fields = fields.GetValueOrDefault(doc.DocumentId) ?? [],
                    });
                    catalog.Add([dossier.Code, dossier.Title, dossier.Status, dossier.Organization, dossier.Department, dossier.WorkGroup, dossier.Location ?? "",
                        dossier.ArchivedAt?.ToOffset(TimeSpan.FromHours(7)).ToString("dd/MM/yyyy", CultureInfo.InvariantCulture) ?? "",
                        doc.Position.ToString(CultureInfo.InvariantCulture), doc.Title, doc.Form, doc.Number ?? "", doc.IssuedOn?.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture) ?? "",
                        doc.Pages?.ToString(CultureInfo.InvariantCulture) ?? "", path ?? "", path is null ? "" : doc.Sha256 ?? "", note ?? ""]);
                }
                metadata.Add(new
                {
                    code = dossier.Code, title = dossier.Title, status = dossier.Status, organization = dossier.Organization, department = dossier.Department,
                    workGroup = dossier.WorkGroup, location = dossier.Location, archivedAt = dossier.ArchivedAt, documents = items,
                });
                processed++;
                await HeartbeatAsync(job.Id, processed, ct);
            }

            if (job.Format == "zip_pdf_json")
                Add(zip, manifest, "metadata.json", JsonSerializer.SerializeToUtf8Bytes(new { generatedAt = clock.UtcNow, format = job.Format, dossiers = metadata },
                    new JsonSerializerOptions { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping }));
            Add(zip, manifest, "danh-muc.csv", Csv(catalog));

            // manifest.sha256 liệt kê mọi tệp trong gói trừ chính nó; `sha256sum -c manifest.sha256` chạy trong thư mục đã giải nén.
            var manifestBytes = Encoding.UTF8.GetBytes(string.Concat(manifest.OrderBy(e => e.Path, StringComparer.Ordinal).Select(e => $"{e.Sha256}  {e.Path}\n")));
            var entry = zip.CreateEntry("manifest.sha256", CompressionLevel.Optimal);
            await using (var s = entry.Open()) await s.WriteAsync(manifestBytes, ct);
            var manifestSha = Convert.ToHexStringLower(SHA256.HashData(manifestBytes));

            zip.Dispose();
            await file.FlushAsync(ct);
            file.Position = 0;
            var stored = await storage.SaveAsync(file, ct);
            await CompleteAsync(job.Id, stored.StorageKey, manifestSha, stored.ByteSize, ct);
        }
    }

    /// <summary>Chép một tệp từ kho vào ZIP, băm khi chép, và đối chiếu với mã băm đã ghi.</summary>
    private async Task<string> CopyFileAsync(ZipArchive zip, string path, DocRow doc, CancellationToken ct)
    {
        Stream source;
        try { source = await storage.OpenReadAsync(doc.StorageKey!, ct); }
        catch (Exception e) when (e is FileNotFoundException or DirectoryNotFoundException)
        {
            throw new ExportException($"Thiếu nội dung tệp của giấy tờ \"{doc.Title}\" trên kho lưu trữ. Khôi phục từ bản sao lưu rồi xuất lại.");
        }
        await using (source)
        {
            var entry = zip.CreateEntry(path, CompressionLevel.NoCompression);   // PDF vốn đã nén
            using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            await using var target = entry.Open();
            var buffer = new byte[81920];
            int read;
            while ((read = await source.ReadAsync(buffer, ct)) > 0)
            {
                hash.AppendData(buffer, 0, read);
                await target.WriteAsync(buffer.AsMemory(0, read), ct);
            }
            var sha = Convert.ToHexStringLower(hash.GetHashAndReset());
            if (doc.Sha256 is { } expected && !string.Equals(expected, sha, StringComparison.OrdinalIgnoreCase))
                throw new ExportException($"Nội dung tệp của giấy tờ \"{doc.Title}\" không khớp mã băm đã ghi khi tiếp nhận (tệp có thể đã hỏng). Gói không được tạo.");
            return sha;
        }
    }

    private static void Add(ZipArchive zip, List<Entry> manifest, string name, byte[] bytes)
    {
        var entry = zip.CreateEntry(name, CompressionLevel.Optimal);
        using (var s = entry.Open()) s.Write(bytes);
        manifest.Add(new Entry(name, Convert.ToHexStringLower(SHA256.HashData(bytes))));
    }

    private static byte[] Csv(List<string[]> rows)
    {
        string[] header = ["Mã hồ sơ", "Tên hồ sơ", "Trạng thái", "Cơ quan", "Đơn vị", "Nhóm công việc", "Vị trí lưu", "Ngày lưu trữ", "STT", "Tên giấy tờ", "Hình thức", "Số văn bản", "Ngày ban hành", "Số trang", "Tệp", "SHA-256", "Ghi chú"];
        var text = new StringBuilder();
        foreach (var row in rows.Prepend(header)) text.Append(string.Join(',', row.Select(Quote))).Append("\r\n");
        return [.. Encoding.UTF8.GetPreamble(), .. Encoding.UTF8.GetBytes(text.ToString())];   // BOM để Excel mở đúng tiếng Việt
    }

    private static string Quote(string value) => value.IndexOfAny([',', '"', '\r', '\n']) >= 0 ? "\"" + value.Replace("\"", "\"\"") + "\"" : value;

    /// <summary>Tên tệp trong gói: không dấu, chữ thường, gạch nối; giữ ổn định giữa các hệ điều hành.</summary>
    internal static string Slug(string title)
    {
        var folded = new StringBuilder();
        foreach (var c in title.Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
            folded.Append(c is 'đ' or 'Đ' ? 'd' : char.ToLowerInvariant(c));
        }
        var slug = new StringBuilder();
        foreach (var c in folded.ToString())
        {
            if (c is >= 'a' and <= 'z' or >= '0' and <= '9') slug.Append(c);
            else if (slug.Length > 0 && slug[^1] != '-') slug.Append('-');
        }
        var result = slug.ToString().Trim('-');
        if (result.Length > 60) result = result[..60].Trim('-');
        return result.Length == 0 ? "giay-to" : result;
    }

    private static string Extension(string? originalName, string? mediaType)
    {
        if (mediaType == "application/pdf") return ".pdf";
        var ext = Path.GetExtension(originalName ?? "").ToLowerInvariant();
        return ext.Length is > 1 and <= 6 && ext[1..].All(char.IsAsciiLetterOrDigit) ? ext : ".bin";
    }

    // ---- truy vấn ----
    private async Task<List<DossierRow>> LoadDossiersAsync(Guid[] ids, CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand("SELECT id, code, title, status, organization_code, department_code, work_group_code, archived_at, physical_location FROM hoso.dossiers WHERE id = ANY($1) ORDER BY code");
        command.Parameters.AddWithValue(ids);
        var rows = new List<DossierRow>();
        await using var r = await command.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
            rows.Add(new DossierRow(r.GetGuid(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetString(4), r.GetString(5), r.GetString(6),
                r.IsDBNull(7) ? null : r.GetFieldValue<DateTimeOffset>(7), r.IsDBNull(8) ? null : r.GetString(8)));
        return rows;
    }

    private async Task<List<DocRow>> LoadDocumentsAsync(Guid[] ids, CancellationToken ct)
    {
        // Bản mới nhất của mỗi giấy tờ (kể cả đã hủy, để ghi chú rõ lý do không có tệp).
        await using var command = dataSource.CreateCommand("""
            SELECT dd.dossier_id, dd.position, dd.relation_kind, doc.id, doc.title, doc.document_form, doc.document_number, doc.issued_on, c.document_type_code,
                   f.id, f.original_name, f.media_type, f.storage_key, f.sha256, f.byte_size, f.page_count, f.disposed_at
            FROM hoso.dossier_documents dd
            JOIN hoso.documents doc ON doc.id = dd.document_id
            LEFT JOIN hoso.document_classifications c ON c.document_id = doc.id
            LEFT JOIN LATERAL (SELECT * FROM hoso.files WHERE document_id = doc.id ORDER BY version_no DESC LIMIT 1) f ON true
            WHERE dd.dossier_id = ANY($1) ORDER BY dd.dossier_id, dd.position
            """);
        command.Parameters.AddWithValue(ids);
        var rows = new List<DocRow>();
        await using var r = await command.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
        {
            string? S(int i) => r.IsDBNull(i) ? null : r.GetString(i);
            rows.Add(new DocRow(r.GetGuid(0), r.GetInt32(1), r.GetString(2), r.GetGuid(3), r.GetString(4), r.GetString(5), S(6), r.IsDBNull(7) ? null : r.GetFieldValue<DateOnly>(7), S(8),
                r.IsDBNull(9) ? null : r.GetGuid(9), S(10), S(11), S(12), S(13), r.IsDBNull(14) ? null : r.GetInt64(14), r.IsDBNull(15) ? null : r.GetInt32(15),
                r.IsDBNull(16) ? null : r.GetFieldValue<DateTimeOffset>(16)));
        }
        return rows;
    }

    private async Task<Dictionary<Guid, Dictionary<string, object?>>> LoadFieldsAsync(Guid[] documentIds, CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand("""
            SELECT fv.document_id, fd.label, fv.value_text, fv.verified_at IS NOT NULL
            FROM hoso.document_field_values fv JOIN hoso.field_definitions fd ON fd.code = fv.field_definition_code
            WHERE fv.document_id = ANY($1) AND fv.value_text IS NOT NULL ORDER BY fv.document_id, fd.label
            """);
        command.Parameters.AddWithValue(documentIds);
        var result = new Dictionary<Guid, Dictionary<string, object?>>();
        await using var r = await command.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
        {
            if (!result.TryGetValue(r.GetGuid(0), out var map)) result[r.GetGuid(0)] = map = [];
            map[r.GetString(1)] = new { value = r.GetString(2), verified = r.GetBoolean(3) };
        }
        return result;
    }

    // ---- trạng thái ----
    private async Task HeartbeatAsync(Guid id, int processed, CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand("UPDATE hoso.export_packages SET processed_items = $2, heartbeat_at = now() WHERE id = $1 AND status = 'running'");
        command.Parameters.AddWithValue(id);
        command.Parameters.AddWithValue(processed);
        await command.ExecuteNonQueryAsync(ct);
    }

    private async Task CompleteAsync(Guid id, string key, string manifestSha, long size, CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand("""
            UPDATE hoso.export_packages SET status = 'ready', storage_key = $2, manifest_sha256 = $3, byte_size = $4, processed_items = total_items,
                   ready_at = $5, expires_at = $6, heartbeat_at = now() WHERE id = $1 AND status = 'running'
            """);
        command.Parameters.AddWithValue(id);
        command.Parameters.AddWithValue(key);
        command.Parameters.AddWithValue(manifestSha);
        command.Parameters.AddWithValue(size);
        command.Parameters.AddWithValue(clock.UtcNow);
        command.Parameters.AddWithValue(clock.UtcNow + Retention);
        // Gói bị thu hồi (hết quyền) trong lúc đang đóng: không được đưa về "ready"; xóa nội dung vừa ghi.
        if (await command.ExecuteNonQueryAsync(ct) == 0) await DeleteIfUnusedAsync(key, ct);
    }

    private async Task DeleteIfUnusedAsync(string key, CancellationToken ct)
    {
        await using var inUse = dataSource.CreateCommand("SELECT EXISTS (SELECT 1 FROM hoso.export_packages WHERE storage_key = $1 AND status = 'ready') OR EXISTS (SELECT 1 FROM hoso.files WHERE storage_key = $1)");
        inUse.Parameters.AddWithValue(key);
        if (await inUse.ExecuteScalarAsync(ct) is false) await storage.DeleteAsync(key, ct);
    }

    private async Task FailAsync(Guid id, string message)
    {
        await using var command = dataSource.CreateCommand("UPDATE hoso.export_packages SET status = 'failed', error_message = left($2, 500) WHERE id = $1");
        command.Parameters.AddWithValue(id);
        command.Parameters.AddWithValue(message);
        await command.ExecuteNonQueryAsync();
    }

    private async Task RequeueAsync(Guid id)
    {
        await using var command = dataSource.CreateCommand("UPDATE hoso.export_packages SET status = 'queued', processed_items = 0 WHERE id = $1 AND status = 'running'");
        command.Parameters.AddWithValue(id);
        await command.ExecuteNonQueryAsync();
    }

    internal async Task<int> RequeueStaleAsync(CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand("SELECT hoso.requeue_stale_exports()");
        var count = Convert.ToInt32(await command.ExecuteScalarAsync(ct));
        if (count > 0) logger.LogWarning("export_requeued_stale {Count}", count);
        return count;
    }

    /// <summary>Gói quá hạn chuyển "expired" và xóa nội dung (trừ khi cùng khóa còn được dùng ở nơi khác).</summary>
    internal async Task<int> ExpireAsync(CancellationToken ct)
    {
        await using var command = dataSource.CreateCommand("""
            WITH expired AS (
              UPDATE hoso.export_packages SET status = 'expired' WHERE status = 'ready' AND expires_at < $1 RETURNING id, storage_key
            )
            SELECT id, storage_key FROM expired
            """);
        command.Parameters.AddWithValue(clock.UtcNow);
        var keys = new List<string>();
        await using (var reader = await command.ExecuteReaderAsync(ct))
            while (await reader.ReadAsync(ct)) if (!reader.IsDBNull(1)) keys.Add(reader.GetString(1));
        // Gói bị thu hồi (BE-91): bỏ tham chiếu rồi xóa nội dung như gói hết hạn.
        await using (var revoked = dataSource.CreateCommand("""
            WITH old AS (SELECT id, storage_key FROM hoso.export_packages WHERE status = 'revoked' AND storage_key IS NOT NULL FOR UPDATE),
                 cleared AS (UPDATE hoso.export_packages p SET storage_key = NULL FROM old WHERE p.id = old.id)
            SELECT storage_key FROM old
            """))
        await using (var reader = await revoked.ExecuteReaderAsync(ct))
            while (await reader.ReadAsync(ct)) keys.Add(reader.GetString(0));
        foreach (var key in keys.Distinct()) await DeleteIfUnusedAsync(key, ct);
        return keys.Count;
    }

    private sealed class ExportException(string message) : Exception(message);
}
