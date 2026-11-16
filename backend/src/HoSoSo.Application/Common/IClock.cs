namespace HoSoSo.Application.Common;

/// <summary>Đồng hồ thay được trong kiểm thử (hạn nội bộ, hết hạn phân công, hết hạn gói xuất).</summary>
public interface IClock
{
    DateTimeOffset UtcNow { get; }
}
