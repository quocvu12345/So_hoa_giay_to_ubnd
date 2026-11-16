using System.Data.Common;
using HoSoSo.Application.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace HoSoSo.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Mỗi khi mở kết nối, ghi người thao tác và mã tương quan vào biến phiên PostgreSQL.
/// Trigger hoso.audit_change() đọc hoso.actor_subject để ghi audit_events đúng người.
/// Npgsql đặt lại trạng thái phiên khi trả kết nối về pool nên giá trị không lẫn sang request khác.
/// </summary>
public sealed class ActorContextInterceptor(ICurrentUser currentUser) : DbConnectionInterceptor
{
    private const string Sql =
        "SELECT set_config('hoso.actor_subject', @actor, false), set_config('hoso.correlation_id', @correlation, false)";

    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        using var command = CreateCommand(connection);
        command.ExecuteNonQuery();
    }

    public override async Task ConnectionOpenedAsync(DbConnection connection, ConnectionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        await using var command = CreateCommand(connection);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private DbCommand CreateCommand(DbConnection connection)
    {
        var command = connection.CreateCommand();
        command.CommandText = Sql;
        AddParameter(command, "actor", currentUser.Subject ?? string.Empty);
        AddParameter(command, "correlation", currentUser.CorrelationId);
        return command;
    }

    private static void AddParameter(DbCommand command, string name, string value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }
}
