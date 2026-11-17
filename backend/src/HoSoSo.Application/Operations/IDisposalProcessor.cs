namespace HoSoSo.Application.Operations;

/// <summary>Xử lý các khóa đã được ghi bền vững sau khi commit việc chặn nội dung.</summary>
public interface IDisposalProcessor
{
    Task ProcessAsync(Guid requestId, CancellationToken ct);
}
