using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace HoSoSo.Application.Common;

/// <summary>Truy cập CSDL cho use case. Cài đặt duy nhất là HoSoDbContext (Infrastructure).</summary>
public interface IHoSoDb
{
    DbSet<T> Set<T>() where T : class;
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    DatabaseFacade Database { get; }
    ChangeTracker ChangeTracker { get; }
    EntityEntry<T> Entry<T>(T entity) where T : class;
}

public static class HoSoDbExtensions
{
    /// <summary>Truy vấn chỉ đọc, không theo dõi thay đổi.</summary>
    public static IQueryable<T> Read<T>(this IHoSoDb db) where T : class => db.Set<T>().AsNoTracking();
}
