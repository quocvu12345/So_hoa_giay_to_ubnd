using HoSoSo.Infrastructure.Auditing;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace HoSoSo.Infrastructure.Health;

/// <summary>
/// BE-94. Nhật ký truy cập mất dòng trong vòng 1 giờ qua (bỏ vì hàng đợi đầy hoặc không ghi được sau khi thử lại) thì báo Degraded (HTTP 200: hệ thống vẫn dùng được,
/// nhưng có khoảng trống trong nhật ký cần quản trị biết). Dòng nhạy cảm (tải, xuất) không đi qua hàng đợi nên không nằm trong số này.
/// </summary>
internal sealed class AccessLogHealthCheck(AccessEventQueue queue) : IHealthCheck
{
    private static readonly TimeSpan Window = TimeSpan.FromHours(1);

    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default) =>
        Task.FromResult(queue.LastLossAt is { } at && DateTimeOffset.UtcNow - at < Window
            ? HealthCheckResult.Degraded($"Nhật ký truy cập mất dòng lúc {at:O} (bỏ: {queue.Dropped}, không ghi được: {queue.Failed}).")
            : HealthCheckResult.Healthy());
}
