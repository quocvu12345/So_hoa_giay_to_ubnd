namespace HoSoSo.Application.Documents;

public sealed record LabelItem(string Code, string Name, string Path, string QrPayload);

public sealed record MinutesDossier(string Code, string Title, int PageCount, string? Location);

/// <summary>Dữ liệu biên bản nộp lưu (BE-85): đủ để hai bên đối chiếu bản giấy và bản số.</summary>
public sealed record MinutesModel(string SubmissionCode, string OrganizationName, DateTimeOffset At, string SubmittedBy, string ReceivedBy,
    IReadOnlyList<MinutesDossier> Dossiers, string Note);

/// <summary>Dựng PDF do hệ thống tạo (nhãn QR, biên bản). Dùng font Be Vietnam Pro (OFL) nhúng sẵn nên đủ dấu tiếng Việt.</summary>
public interface IDocumentRenderer
{
    byte[] Labels(IReadOnlyList<LabelItem> labels);
    byte[] ArchiveMinutes(MinutesModel model);
    string QrSvg(string payload);
}
