using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;

namespace HoSoSo.Infrastructure.Health;

/// <summary>/health/ready: mở được kết nối và chạy SELECT 1 trong 3 giây.</summary>
public sealed class DatabaseHealthCheck(NpgsqlDataSource dataSource) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(3));
            await using var command = dataSource.CreateCommand("SELECT 1");
            await command.ExecuteScalarAsync(timeout.Token);
            return HealthCheckResult.Healthy();
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Không kết nối được PostgreSQL.", ex);
        }
    }
}
