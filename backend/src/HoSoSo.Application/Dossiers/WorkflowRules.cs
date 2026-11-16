using HoSoSo.Domain.Entities;
using HoSoSo.Domain.Identity;

namespace HoSoSo.Application.Dossiers;

/// <summary>Tên hiển thị và quyền cần có cho từng thao tác chuyển bước. Luật chuyển bước nằm ở bảng workflow_transitions.</summary>
internal static class WorkflowRules
{
    public static string Label(string action) => action switch
    {
        "submit" => "Trình trưởng phòng / Ban",
        "accept" => "Đạt, chuyển nộp lưu",
        "escalate" => "Trình lãnh đạo cho ý kiến",
        "return" => "Trả lại để bổ sung",
        "decide" => "Cho ý kiến hoàn tất",
        "archive" => "Tiếp nhận nộp lưu",
        _ => action,
    };

    public static string PermissionFor(string action) => action switch
    {
        "submit" => Permissions.DossierSubmit,
        "accept" => Permissions.DossierAccept,
        "escalate" => Permissions.DossierEscalate,
        "return" => Permissions.DossierReturn,
        "decide" => Permissions.DossierDecide,
        "archive" => Permissions.DossierArchive,
        _ => "dossier.unknown",
    };

    /// <summary>Bước đích hiển thị cho người dùng, khớp phần định tuyến riêng trong hoso.transition_dossier.</summary>
    public static string TargetState(WorkflowTransition t, string workflowCode, string department, string role)
    {
        if (workflowCode == "digitize_closed") return t.ToState;
        if (t.Action == "submit" && department is "tt" or "db") return "leadership_review";
        if (t.Action == "return" && role is RoleCode.Chair or RoleCode.Council && department is "tt" or "db") return "returned";
        return t.ToState;
    }
}
