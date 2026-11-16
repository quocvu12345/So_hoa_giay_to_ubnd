using HoSoSo.Application.Common;
using HoSoSo.Domain.Catalog;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Infrastructure.Persistence;

/// <summary>
/// EF Core chỉ dùng để truy vấn và ghi; schema do migration SQL (DbUp) quản lý, không sinh migration EF.
/// Tên bảng/cột snake_case khớp backend/database/migrations. Ánh xạ từng bảng ở ModelMapping.
/// </summary>
public sealed class HoSoDbContext(DbContextOptions<HoSoDbContext> options) : DbContext(options), IHoSoDb
{
    /// <summary>Gọi hoso.scope_matches(user, dossier, phân công đang dùng). Chỉ dùng trong truy vấn LINQ, không chạy ở phía .NET.</summary>
    public static bool ScopeMatches(Guid userId, Guid dossierId, string assignment) =>
        throw new NotSupportedException("ScopeMatches chỉ dùng trong truy vấn LINQ gửi tới PostgreSQL.");

    /// <summary>
    /// BE-07. Bảng chỉ thêm (IAppendOnly): trigger trong CSDL chặn sửa/xóa, ở đây từ chối sớm để lỗi rõ ràng và không tốn một lần gọi CSDL.
    /// </summary>
    private void RejectAppendOnlyMutations()
    {
        var bad = ChangeTracker.Entries<IAppendOnly>().FirstOrDefault(e => e.State is EntityState.Modified or EntityState.Deleted);
        if (bad is not null)
            throw new InvalidOperationException($"{bad.Metadata.ClrType.Name} là bảng chỉ thêm: không sửa hoặc xóa được.");
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        RejectAppendOnlyMutations();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        RejectAppendOnlyMutations();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("hoso");
        modelBuilder.HasDbFunction(typeof(HoSoDbContext).GetMethod(nameof(ScopeMatches), [typeof(Guid), typeof(Guid), typeof(string)])!)
            .HasSchema("hoso").HasName("scope_matches");
        modelBuilder.HasDbFunction(typeof(HoSoSo.Application.Dossiers.HoSoDbContextFunctions).GetMethod(nameof(HoSoSo.Application.Dossiers.HoSoDbContextFunctions.Fold), [typeof(string)])!)
            .HasSchema("hoso").HasName("f_fold");
        ModelMapping.Apply(modelBuilder);
    }
}
