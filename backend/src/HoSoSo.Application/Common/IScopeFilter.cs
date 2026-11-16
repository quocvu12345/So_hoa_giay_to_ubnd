using HoSoSo.Domain.Entities;

namespace HoSoSo.Application.Common;

/// <summary>
/// Giới hạn truy vấn theo phạm vi của phân công đang dùng (BE-15). Mọi danh sách và chi tiết hồ sơ/giấy tờ
/// phải đi qua đây; quy tắc nằm một nơi duy nhất là hàm SQL hoso.scope_matches.
/// Ngoài phạm vi thì không thấy bản ghi (404), không phải 403, để không lộ sự tồn tại.
/// </summary>
public interface IScopeFilter
{
    IQueryable<Dossier> Dossiers(IQueryable<Dossier> query);
    IQueryable<Document> Documents(IQueryable<Document> query);
}
