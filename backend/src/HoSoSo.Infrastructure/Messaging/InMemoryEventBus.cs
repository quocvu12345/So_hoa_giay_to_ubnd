using System.Collections.Concurrent;
using System.Text.Json;
using System.Threading.Channels;
using HoSoSo.Application.Common;

namespace HoSoSo.Infrastructure.Messaging;

internal sealed class InMemoryEventBus : IEventBus
{
    private const int HistoryPerUser = 50;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly ConcurrentDictionary<Guid, UserChannel> _users = new();
    private long _nextId;

    private sealed class UserChannel
    {
        public readonly object Gate = new();
        public readonly List<Subscription> Subscriptions = [];
        public readonly LinkedList<ServerEvent> History = new();
    }

    private sealed class Subscription(InMemoryEventBus bus, Guid userId, string assignment, UserChannel owner, IReadOnlyList<ServerEvent> replay) : IEventSubscription
    {
        public Guid UserId { get; } = userId;
        public string Assignment { get; } = assignment;
        public IReadOnlyList<ServerEvent> Replay { get; } = replay;
        public Channel<ServerEvent> Channel { get; } = System.Threading.Channels.Channel.CreateBounded<ServerEvent>(
            new BoundedChannelOptions(100) { FullMode = BoundedChannelFullMode.DropOldest, SingleReader = true });
        public ChannelReader<ServerEvent> Reader => Channel.Reader;

        public void Dispose()
        {
            lock (owner.Gate) owner.Subscriptions.Remove(this);
            Channel.Writer.TryComplete();
            bus.Cleanup(UserId);
        }
    }

    public IEventSubscription Subscribe(Guid userId, string assignment, long? lastEventId)
    {
        var user = _users.GetOrAdd(userId, _ => new UserChannel());
        lock (user.Gate)
        {
            var replay = lastEventId is { } last ? user.History.Where(e => e.Id > last && (e.Assignment is null || e.Assignment == assignment)).ToList() : [];
            var subscription = new Subscription(this, userId, assignment, user, replay);
            user.Subscriptions.Add(subscription);
            return subscription;
        }
    }

    public void Publish(Guid userId, string type, object data, string? assignment = null)
    {
        var user = _users.GetOrAdd(userId, _ => new UserChannel());
        var message = new ServerEvent(Interlocked.Increment(ref _nextId), type, JsonSerializer.Serialize(data, Json), assignment);
        lock (user.Gate)
        {
            user.History.AddLast(message);
            while (user.History.Count > HistoryPerUser) user.History.RemoveFirst();
            foreach (var subscription in user.Subscriptions.Where(s => assignment is null || s.Assignment == assignment)) subscription.Channel.Writer.TryWrite(message);
        }
        Cleanup(userId);
    }

    public void PublishToAll(string type, object data)
    {
        foreach (var subscriber in Subscribers.Select(s => s.UserId).Distinct()) Publish(subscriber, type, data);
    }

    public IReadOnlyList<SubscriberInfo> Subscribers => _users
        .SelectMany(pair => { lock (pair.Value.Gate) return pair.Value.Subscriptions.Select(s => new SubscriberInfo(pair.Key, s.Assignment)).ToList(); })
        .ToList();

    /// <summary>Bỏ bộ nhớ lịch sử của người không còn kết nối và không có gì chờ replay.</summary>
    private void Cleanup(Guid userId)
    {
        if (_users.TryGetValue(userId, out var user))
        {
            lock (user.Gate)
            {
                if (user.Subscriptions.Count == 0 && user.History.Count == 0) _users.TryRemove(userId, out _);
            }
        }
    }
}
