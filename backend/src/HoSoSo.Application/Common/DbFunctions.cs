namespace HoSoSo.Application.Dossiers;

/// <summary>Hàm CSDL dùng trong truy vấn LINQ của use case. Infrastructure đăng ký ánh xạ sang hoso.f_fold (HoSoDbContext).</summary>
public static class HoSoDbContextFunctions
{
    /// <summary>Chữ thường, bỏ dấu tiếng Việt: "Đất đai" → "dat dai".</summary>
    public static string Fold(string value) => throw new NotSupportedException("Fold chỉ dùng trong truy vấn LINQ gửi tới PostgreSQL.");
}
