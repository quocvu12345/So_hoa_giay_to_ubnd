using Microsoft.Extensions.Options;

namespace HoSoSo.Application.Intake;

/// <summary>Các mức ưu tiên của hàng đợi AI (<c>ocr_jobs.priority</c>, số nhỏ chạy trước). Thiết kế: docs/tasks/ai.md.</summary>
public static class QueuePriority
{
    /// <summary>Người dùng chỉ định "Trích xuất ngay".</summary>
    public const short Immediate = 1;
    /// <summary>Đọc lại trang, tách văn bản, phân loại lại: có người đang chờ.</summary>
    public const short Interactive = 3;
    /// <summary>Từ mức này trở lên là khay nền (worker chỉ chạy khi hết việc ưu tiên và nhường chỗ khi có việc ưu tiên).</summary>
    public const short BackgroundFrom = 7;

    public const string KindPriority = "priority";
    public const string KindInteractive = "interactive";
    public const string KindBackground = "background";

    public static string KindOf(short priority) =>
        priority <= 2 ? KindPriority : priority < BackgroundFrom ? KindInteractive : KindBackground;
}

/// <summary>Cấu hình <c>Ai:*</c>.</summary>
public sealed class AiQueueOptions
{
    /// <summary>Mức của PDF mới tải lên. Phải nằm trong khay nền (7–9) để việc có người chờ luôn chạy trước.</summary>
    public int BackgroundPriority { get; set; } = QueuePriority.BackgroundFrom;

    /// <summary>Số giấy tờ tối đa cho mỗi lần "Trích xuất ngay" (BE-98).</summary>
    public int ExtractMaxDocuments { get; set; } = 50;
}

public sealed class AiQueueOptionsValidator : IValidateOptions<AiQueueOptions>
{
    public ValidateOptionsResult Validate(string? name, AiQueueOptions options)
    {
        if (options.BackgroundPriority is < QueuePriority.BackgroundFrom or > 9)
            return ValidateOptionsResult.Fail($"Ai:BackgroundPriority phải từ {QueuePriority.BackgroundFrom} đến 9 (nhận {options.BackgroundPriority}).");
        if (options.ExtractMaxDocuments is < 1 or > 500)
            return ValidateOptionsResult.Fail($"Ai:ExtractMaxDocuments phải từ 1 đến 500 (nhận {options.ExtractMaxDocuments}).");
        return ValidateOptionsResult.Success;
    }
}
