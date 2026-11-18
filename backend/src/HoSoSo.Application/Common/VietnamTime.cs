namespace HoSoSo.Application.Common;

/// <summary>Ngày theo giờ Việt Nam (UTC+7, không đổi giờ mùa hè). "Quá hạn" tính theo ngày này, không theo UTC: hạn ghi theo ngày làm việc của cơ quan.</summary>
public static class VietnamTime
{
    private static readonly TimeSpan Offset = TimeSpan.FromHours(7);

    public static DateOnly Today(this IClock clock) => DateOnly.FromDateTime(clock.UtcNow.ToOffset(Offset).DateTime);
}
