namespace HoSoSo.Domain.Identity;

/// <summary>Mã quyền, khớp bảng hoso.permissions (docs/03-thiet-ke-csdl.md, nhóm B).</summary>
public static class Permissions
{
    public const string DossierRead = "dossier.read";
    public const string DossierPrepare = "dossier.prepare";
    public const string DossierSubmit = "dossier.submit";
    public const string DossierAssign = "dossier.assign";
    public const string DossierAccept = "dossier.accept";
    public const string DossierEscalate = "dossier.escalate";
    public const string DossierReturn = "dossier.return";
    public const string DossierDecide = "dossier.decide";
    public const string DossierArchive = "dossier.archive";
    public const string DocumentView = "document.view";
    public const string DocumentDownload = "document.download";
    public const string DocumentPrint = "document.print";
    public const string DocumentEdit = "document.edit";
    public const string IntakeUpload = "intake.upload";
    public const string IntakeManage = "intake.manage";
    public const string IntakeQc = "intake.qc";
    public const string ProcessingManage = "processing.manage";
    public const string CatalogManage = "catalog.manage";
    public const string StorageManage = "storage.manage";
    public const string LoanRequest = "loan.request";
    public const string LoanApprove = "loan.approve";
    public const string ExportCreate = "export.create";
    public const string DisposalRequest = "disposal.request";
    public const string DisposalApprove = "disposal.approve";
    public const string AdminUsers = "admin.users";
    public const string AdminSettings = "admin.settings";
}
