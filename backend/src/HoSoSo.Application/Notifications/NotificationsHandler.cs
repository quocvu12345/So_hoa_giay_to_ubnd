using HoSoSo.Application.Common;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Notifications;

public sealed record NotificationDto(Guid Id, string Kind, string Title, string Body, string? Link, Guid? DossierId, DateTimeOffset CreatedAt, bool Read);
public sealed record NotificationList(IReadOnlyList<NotificationDto> Items, int Unread);

/// <summary>BE-70. Thông báo của chính người dùng; người khác không đọc hay đánh dấu được.</summary>
public sealed class NotificationsHandler(IHoSoDb db, ICurrentUser user, IClock clock)
{
    public async Task<NotificationList> ListAsync(bool unreadOnly, int limit, CancellationToken ct)
    {
        var me = user.RequireUserId();
        var query = db.Read<Notification>().Where(n => n.UserId == me);
        if (unreadOnly) query = query.Where(n => n.ReadAt == null);
        var items = await query.OrderByDescending(n => n.CreatedAt).ThenByDescending(n => n.Id).Take(Math.Clamp(limit, 1, 100))
            .Select(n => new NotificationDto(n.Id, n.Kind, n.Title, n.Body, n.Link, n.DossierId, n.CreatedAt, n.ReadAt != null)).ToListAsync(ct);
        var unread = await db.Read<Notification>().CountAsync(n => n.UserId == me && n.ReadAt == null, ct);
        return new NotificationList(items, unread);
    }

    public async Task MarkReadAsync(Guid id, CancellationToken ct)
    {
        var me = user.RequireUserId();
        var now = clock.UtcNow;
        var found = await db.Read<Notification>().AnyAsync(n => n.Id == id && n.UserId == me, ct);
        if (!found) throw AppException.NotFound("thông báo");
        await db.Set<Notification>().Where(n => n.Id == id && n.UserId == me && n.ReadAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, now), ct);
    }

    public async Task<int> MarkAllReadAsync(CancellationToken ct)
    {
        var me = user.RequireUserId();
        var now = clock.UtcNow;
        return await db.Set<Notification>().Where(n => n.UserId == me && n.ReadAt == null).ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, now), ct);
    }
}
