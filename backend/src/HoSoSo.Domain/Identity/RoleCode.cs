namespace HoSoSo.Domain.Identity;

/// <summary>Vai trò, khớp bảng hoso.roles.</summary>
public static class RoleCode
{
    public const string Employee = "employee";
    public const string Clerk = "clerk";
    public const string Manager = "manager";
    public const string Chair = "chair";
    public const string Council = "council";
    public const string TechnicalAdmin = "technical_admin";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        Employee, Clerk, Manager, Chair, Council, TechnicalAdmin,
    };
}

/// <summary>
/// Quyền mặc định theo vai trò, dùng cho môi trường dev và kiểm thử.
/// Nguồn chính thức là bảng hoso.role_permissions; task DB-04 seed đúng danh sách này.
/// </summary>
public static class DefaultRolePermissions
{
    private static readonly Dictionary<string, string[]> Map = new(StringComparer.Ordinal)
    {
        [RoleCode.Employee] =
        [
            Permissions.DossierRead, Permissions.DossierPrepare, Permissions.DossierSubmit,
            Permissions.DocumentView, Permissions.DocumentDownload, Permissions.DocumentEdit,
            Permissions.IntakeUpload, Permissions.LoanRequest,
        ],
        [RoleCode.Clerk] =
        [
            Permissions.DossierRead, Permissions.DossierPrepare, Permissions.DossierSubmit,
            Permissions.DossierArchive, Permissions.DossierReturn,
            Permissions.DocumentView, Permissions.DocumentDownload, Permissions.DocumentPrint, Permissions.DocumentEdit,
            Permissions.IntakeUpload, Permissions.IntakeManage, Permissions.IntakeQc,
            Permissions.StorageManage, Permissions.LoanRequest, Permissions.LoanApprove,
            Permissions.ExportCreate, Permissions.DisposalRequest,
        ],
        [RoleCode.Manager] =
        [
            Permissions.DossierRead, Permissions.DossierAssign, Permissions.DossierAccept,
            Permissions.DossierEscalate, Permissions.DossierReturn,
            Permissions.DocumentView, Permissions.DocumentDownload, Permissions.LoanRequest, Permissions.ExportCreate,
        ],
        [RoleCode.Chair] =
        [
            Permissions.DossierRead, Permissions.DossierDecide, Permissions.DossierReturn,
            Permissions.DocumentView, Permissions.DocumentDownload, Permissions.DocumentPrint,
            Permissions.ExportCreate, Permissions.DisposalApprove,
        ],
        [RoleCode.Council] =
        [
            Permissions.DossierRead, Permissions.DossierDecide, Permissions.DossierReturn,
            Permissions.DocumentView, Permissions.DocumentDownload, Permissions.DocumentPrint,
            Permissions.ExportCreate, Permissions.DisposalApprove,
        ],
        [RoleCode.TechnicalAdmin] =
        [
            Permissions.AdminUsers, Permissions.AdminSettings, Permissions.CatalogManage, Permissions.ProcessingManage,
        ],
    };

    public static IReadOnlyList<string> For(string role) =>
        Map.TryGetValue(role, out var permissions) ? permissions : [];
}
