using System.Threading.Channels;

namespace HoSoSo.Application.Common;

/// <summary>Một sự kiện gửi tới trình duyệt qua SSE. Id tăng dần để hỗ trợ Last-Event-ID khi kết nối lại.</summary>
/// <summary><c>Assignment</c>: chỉ gửi cho kết nối đang dùng đúng phân công này; null = gửi cho mọi kết nối của người dùng (thông báo, tiến độ đọc PDF).</summary>
public sealed record ServerEvent(long Id, string Type, string DataJson, string? Assignment = null);

public sealed record SubscriberInfo(Guid UserId, string Assignment);

public interface IEventSubscription : IDisposable
{
    /// <summary>Sự kiện đã phát sau Last-Event-ID mà client chưa nhận (tối đa 50 sự kiện gần nhất của người dùng).</summary>
    IReadOnlyList<ServerEvent> Replay { get; }
    ChannelReader<ServerEvent> Reader { get; }
}

/// <summary>
/// Bus sự kiện trong bộ nhớ theo người dùng (ADR-08). Người A không bao giờ nhận sự kiện của người B.
/// Nhiều tab của cùng người dùng đều nhận. Mỗi API instance có bus riêng; chạy nhiều instance thì mỗi instance tự LISTEN.
/// </summary>
public interface IEventBus
{
    IEventSubscription Subscribe(Guid userId, string assignment, long? lastEventId);
    /// <param name="assignment">Chỉ kết nối đang dùng phân công này nhận (và nhận bù); bỏ trống thì mọi kết nối của người dùng nhận.</param>
    void Publish(Guid userId, string type, object data, string? assignment = null);
    IReadOnlyList<SubscriberInfo> Subscribers { get; }
    /// <summary>Báo mọi người đang mở: có thể đã lỡ sự kiện (mất kết nối CSDL), hãy tải lại dữ liệu.</summary>
    void PublishToAll(string type, object data);
}
