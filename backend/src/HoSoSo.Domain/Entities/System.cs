namespace HoSoSo.Domain.Entities;

public sealed class SystemSetting
{
    public required string Key { get; init; }
    public string Value { get; set; } = "{}";
    public Guid? UpdatedBy { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class AiModel
{
    public required string Key { get; init; }
    public required string Repo { get; set; }
    public required string Revision { get; set; }
    public required string Purpose { get; set; }
    public bool Active { get; set; }
}

public sealed class BackupRun
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Kind { get; set; }
    public string Status { get; set; } = "running";
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? FinishedAt { get; set; }
    public long? ByteSize { get; set; }
    public string? Location { get; set; }
    public DateTimeOffset? RestoreTestedAt { get; set; }
    public string Note { get; set; } = "";
}
