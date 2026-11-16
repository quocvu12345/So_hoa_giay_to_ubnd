using System.Text.Json;
using HoSoSo.Application.Common;
using HoSoSo.Application.Intake;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Documents;

public sealed record SignatureDto(Guid Id, string? SignerName, string? CertificateSerial, string? CertificateIssuer, DateTimeOffset? SignedAt,
    string Status, string VerifierVersion, DateTimeOffset VerifiedAt, JsonElement Details);

/// <summary>
/// BE-54. Đọc và kiểm tra KỸ THUẬT chữ ký số trong PDF: mã băm khớp, chữ ký khớp chứng thư trong tệp. Hệ thống KHÔNG kết luận
/// hiệu lực pháp lý: chưa kiểm chuỗi chứng thư tin cậy, thu hồi (CRL/OCSP) và thời điểm ký có dấu thời gian; giao diện phải nói rõ điều này.
/// </summary>
public sealed class SignaturesHandler(IHoSoDb db, IScopeFilter scope, IFileStorage storage, IPdfTools pdf, IClock clock)
{
    public async Task<IReadOnlyList<SignatureDto>> ListAsync(Guid fileId, CancellationToken ct)
    {
        await FileAsync(fileId, ct);
        return (await db.Read<FileSignature>().Where(s => s.FileId == fileId).OrderBy(s => s.SignedAt).ToListAsync(ct)).Select(ToDto).ToList();
    }

    public async Task<IReadOnlyList<SignatureDto>> VerifyAsync(Guid fileId, CancellationToken ct)
    {
        var file = await FileAsync(fileId, ct);
        IReadOnlyList<PdfSignatureInfo> found;
        try
        {
            await using var stream = await storage.OpenReadAsync(file.StorageKey!, ct);
            found = pdf.ReadSignatures(stream);
        }
        catch (InvalidPdfException exception) { throw new AppException(422, "pdf_unreadable", exception.Message); }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        db.Set<FileSignature>().RemoveRange(db.Set<FileSignature>().Where(s => s.FileId == fileId));
        var now = clock.UtcNow;
        foreach (var s in found)
        {
            db.Set<FileSignature>().Add(new FileSignature
            {
                FileId = fileId, SignerName = s.SignerName, CertificateSerial = s.CertificateSerial, CertificateIssuer = s.CertificateIssuer,
                SignedAt = s.SignedAt, VerificationStatus = s.Status, VerifierVersion = "hoso-cms-spike/1", VerifiedAt = now,
                Details = JsonSerializer.Serialize(s.Details),
            });
        }
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return await ListAsync(fileId, ct);
    }

    private async Task<FileRecord> FileAsync(Guid fileId, CancellationToken ct) =>
        await (from f in db.Read<FileRecord>() join d in scope.Documents(db.Read<Document>()) on f.DocumentId equals d.Id where f.Id == fileId select f)
            .SingleOrDefaultAsync(ct) is { StorageKey: not null } file ? file : throw AppException.NotFound("tệp");

    private static SignatureDto ToDto(FileSignature s) => new(s.Id, s.SignerName, s.CertificateSerial, s.CertificateIssuer, s.SignedAt,
        s.VerificationStatus, s.VerifierVersion, s.VerifiedAt, JsonDocument.Parse(s.Details).RootElement.Clone());
}
