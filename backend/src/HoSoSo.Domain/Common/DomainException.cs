namespace HoSoSo.Domain.Common;

/// <summary>Vi phạm quy tắc nghiệp vụ. Code dùng làm mã lỗi trả về client (docs/02 mục 6).</summary>
public sealed class DomainException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}
