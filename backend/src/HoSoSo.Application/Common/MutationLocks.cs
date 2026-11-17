using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Common;

/// <summary>
/// Mọi khóa giữ tới cuối transaction. Thứ tự: khóa giấy tờ (UUID tăng dần), rồi hồ sơ (UUID tăng dần).
/// Khóa giấy tờ giữ ổn định tập liên kết; khóa hồ sơ dùng chung với transition_dossier.
/// Không lấy khóa giấy tờ sau khi đã khóa hồ sơ.
/// </summary>
public static class MutationLocks
{
    public static async Task DocumentAsync(IHoSoDb db, Guid id, CancellationToken ct)
    {
        if (db.Database.CurrentTransaction is null) throw new InvalidOperationException("Mutation lock requires a transaction.");
        var key = "hoso:document:" + id;
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({key}, 0))", ct);
    }

    public static async Task DossierAsync(IHoSoDb db, Guid id, CancellationToken ct)
    {
        if (db.Database.CurrentTransaction is null) throw new InvalidOperationException("Mutation lock requires a transaction.");
        await db.Database.SqlQuery<Guid>($"SELECT id AS \"Value\" FROM hoso.dossiers WHERE id = {id} FOR UPDATE").ToListAsync(ct);
    }

    public static async Task DocumentAndDossiersAsync(IHoSoDb db, Guid id, CancellationToken ct)
    {
        await DocumentAsync(db, id, ct);
        await db.Database.SqlQuery<Guid>($"""
            SELECT d.id AS "Value" FROM hoso.dossiers d
            WHERE EXISTS (SELECT 1 FROM hoso.dossier_documents dd WHERE dd.dossier_id = d.id AND dd.document_id = {id})
            ORDER BY d.id FOR UPDATE
            """).ToListAsync(ct);
    }
}
