using HoSoSo.Application.Common;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Intake;

/// <summary>Trạng thái của máy AI nhìn từ phía người dùng (AI-24, BE-133).</summary>
public static class AiAvailabilityState
{
    /// <summary>Có worker sống và máy chạy mô hình của nó đang trả lời: PDF được đọc bình thường.</summary>
    public const string Ok = "ok";
    /// <summary>Worker còn sống nhưng máy chạy mô hình (Ollama ở máy khác) không trả lời: PDF nằm chờ, tự đọc tiếp khi máy trở lại.</summary>
    public const string EngineDown = "engine_down";
    /// <summary>Không worker nào báo nhịp trong 2 phút: worker đã dừng hoặc chưa chạy.</summary>
    public const string NoWorker = "no_worker";
}

/// <summary>
/// Cho mọi người dùng (hộp tiếp nhận): chỉ trạng thái và thời điểm, không có chi tiết kỹ thuật (địa chỉ máy, thông điệp lỗi).
/// <c>Since</c>: lúc máy chạy mô hình bắt đầu không trả lời (engine_down), hoặc lần cuối thấy worker (no_worker; null khi chưa từng thấy).
/// </summary>
public sealed record AiAvailability(string State, DateTimeOffset? Since);

/// <summary>Một worker AI như nó tự báo, cho trang vận hành. <c>Alive</c>: báo nhịp trong 2 phút qua hoặc đang giữ một việc có heartbeat mới.</summary>
public sealed record AiMachine(string WorkerId, string Profile, string? Engine, bool EngineOk, string? EngineError, DateTimeOffset? EngineDownSince,
    Guid? CurrentJobId, DateTimeOffset StartedAt, DateTimeOffset LastSeenAt, int LastSeenSecondsAgo, bool Alive);

/// <summary>
/// Đọc <c>ai_workers</c> (worker tự ghi) để phân biệt: máy AI đang đọc được · worker sống nhưng máy chạy mô hình không trả lời · không còn worker nào.
/// Trước đây cả ba trường hợp đều chỉ hiện "đang chờ".
/// </summary>
public sealed class AiAvailabilityQuery(IHoSoDb db, IClock clock)
{
    /// <summary>Worker ghi khoảng 30 giây một lần; im lặng quá chừng này là coi như đã dừng.</summary>
    public static readonly TimeSpan AliveWindow = TimeSpan.FromMinutes(2);

    public async Task<AiAvailability> GetAsync(CancellationToken ct) => (await LoadAsync(ct)).Availability;

    public async Task<(AiAvailability Availability, IReadOnlyList<AiMachine> Machines)> LoadAsync(CancellationToken ct)
    {
        var now = clock.UtcNow;
        var cutoff = now - AliveWindow;
        var rows = await db.Read<AiWorker>().OrderBy(w => w.StartedAt).ToListAsync(ct);
        var busy = await db.Read<OcrJob>().Where(j => j.Status == JobStatus.Running && j.LockedBy != null && j.HeartbeatAt > cutoff)
            .Select(j => j.LockedBy!).Distinct().ToListAsync(ct);
        var machines = rows.Select(w => new AiMachine(w.WorkerId, w.Profile, w.Engine, w.EngineOk, w.EngineError, w.EngineDownSince, w.CurrentJobId,
            w.StartedAt, w.LastSeenAt, (int)Math.Max(0, (now - w.LastSeenAt).TotalSeconds), w.LastSeenAt > cutoff || busy.Contains(w.WorkerId))).ToList();
        var alive = machines.Where(m => m.Alive).ToList();
        // Worker bản cũ chưa ghi ai_workers mà đang đọc thì vẫn là đang hoạt động.
        var unreported = busy.Except(rows.Select(r => r.WorkerId)).Any();

        var availability = alive.Any(m => m.EngineOk) || unreported ? new AiAvailability(AiAvailabilityState.Ok, null)
            : alive.Count > 0 ? new AiAvailability(AiAvailabilityState.EngineDown, alive.Min(m => m.EngineDownSince))
            : new AiAvailability(AiAvailabilityState.NoWorker, rows.Count == 0 ? null : rows.Max(r => r.LastSeenAt));
        return (availability, machines);
    }
}
