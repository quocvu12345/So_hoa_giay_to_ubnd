namespace HoSoSo.Api.Security;

public sealed class AuthOptions
{
    /// <summary>"Oidc" (Keycloak/SSO cơ quan) hoặc "Dev" (đăng nhập bằng tài khoản mẫu, chỉ môi trường Development).</summary>
    public string Mode { get; set; } = "Oidc";
    public string Authority { get; set; } = "";
    public string ClientId { get; set; } = "hoso-web";
    public string ClientSecret { get; set; } = "";
    /// <summary>__Host- yêu cầu HTTPS, Path=/ và không có Domain: cookie không bị trang con ghi đè.</summary>
    public string CookieName { get; set; } = "__Host-hoso";
    public bool SecureCookie { get; set; } = true;
    public int SessionHours { get; set; } = 8;
    /// <summary>Origin công khai của ứng dụng (https://hoso.tuliem.local), dùng kiểm tra CSRF theo Origin.</summary>
    public string PublicOrigin { get; set; } = "";
    /// <summary>
    /// Thư mục lưu khóa Data Protection (mã hóa cookie phiên). Đặt khi chạy trong container hoặc nhiều instance (dùng chung một thư mục);
    /// để trống thì dùng nơi mặc định của hệ điều hành, và khóa mất đi (ví dụ container tạo lại) làm mọi người phải đăng nhập lại.
    /// </summary>
    public string DataProtectionKeysPath { get; set; } = "";
    /// <summary>Tệp chứng thư .pfx dùng mã hóa khóa Data Protection khi lưu (mật khẩu: biến môi trường Auth__DataProtectionCertificatePassword). Production bắt buộc có (hoặc xác nhận rủi ro bằng AllowUnprotectedDataProtectionKeys).</summary>
    public string DataProtectionCertificatePath { get; set; } = "";
    public string DataProtectionCertificatePassword { get; set; } = "";
    /// <summary>Chấp nhận lưu khóa Data Protection không mã hóa (ví dụ đã mã hóa cả ổ đĩa). Chỉ có tác dụng với kiểm tra Production.</summary>
    public bool AllowUnprotectedDataProtectionKeys { get; set; }

    /// <summary>
    /// BE-95. Vai trò (cách nhau bằng dấu phẩy) mà phân công của nó chỉ dùng được khi phiên đã đăng nhập bằng xác thực nhiều lớp (MFA). Để trống thì tắt kiểm tra.
    /// Mặc định gồm quản trị kỹ thuật, lãnh đạo và văn thư. Cần cấu hình Keycloak phát <c>amr</c>/<c>acr</c> (SEC-01); chưa cấu hình MFA ở Keycloak thì các phân công này
    /// sẽ không dùng được: đặt tạm giá trị rỗng nếu chủ động chấp nhận rủi ro đó trong giai đoạn chuyển tiếp.
    /// </summary>
    public string MfaRequiredRoles { get; set; } = "technical_admin,chair,council,clerk";
    /// <summary>Giá trị <c>amr</c> của id_token được coi là đã qua MFA (cách nhau bằng dấu phẩy).</summary>
    public string MfaAmrValues { get; set; } = "mfa,otp,hwk,swk,fpt,sms,face,retina,vbm";
    /// <summary>Giá trị <c>acr</c> được coi là đã qua MFA (cách nhau bằng dấu phẩy), ví dụ mức Keycloak "2,3". Mặc định trống: chỉ dựa vào amr.</summary>
    public string MfaAcrValues { get; set; } = "";
    /// <summary>Giá trị <c>acr_values</c> gửi cho nhà cung cấp danh tính khi người dùng được yêu cầu đăng nhập lại có MFA (bước nâng mức xác thực). Trống thì không gửi.</summary>
    public string MfaAcrRequest { get; set; } = "";

    public bool IsDev => string.Equals(Mode, "Dev", StringComparison.OrdinalIgnoreCase);

    public static string[] Split(string? csv) => (csv ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    public bool RoleNeedsMfa(string role) => Split(MfaRequiredRoles).Contains(role, StringComparer.Ordinal);

    /// <summary>Id_token (claim của IdP) cho thấy phiên đã qua MFA không.</summary>
    public bool HasMfa(System.Security.Claims.ClaimsPrincipal principal) =>
        principal.FindAll("amr").Any(c => Split(MfaAmrValues).Contains(c.Value, StringComparer.OrdinalIgnoreCase))
        || (principal.FindFirst("acr")?.Value is { } acr && Split(MfaAcrValues).Contains(acr, StringComparer.OrdinalIgnoreCase));
}

public static class HoSoClaims
{
    public const string Subject = "sub";
    public const string Username = "preferred_username";
    public const string DisplayName = "name";
    public const string Role = "hoso_role";
    public const string Assignment = "hoso_assignment";
    public const string Permission = "hoso_perm";
    public const string Organization = "hoso_org";
    public const string Department = "hoso_dept";
    /// <summary>"1" khi phiên đăng nhập đã qua xác thực nhiều lớp (BE-95).</summary>
    public const string Mfa = "hoso_mfa";
    /// <summary>"1" khi phân công đang chọn cần MFA mà phiên chưa có: quyền của phân công đó không được gắn (BE-95).</summary>
    public const string MfaRequired = "hoso_mfa_required";
}
