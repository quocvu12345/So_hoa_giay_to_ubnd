using HoSoSo.Domain.Identity;

namespace HoSoSo.Domain.Workflow;

public static class WorkflowState
{
    public const string Draft = "draft";
    public const string Returned = "returned";
    public const string DepartmentReview = "department_review";
    public const string LeadershipReview = "leadership_review";
    public const string ReadyArchive = "ready_archive";
    public const string Archived = "archived";
}

public static class WorkflowAction
{
    public const string Submit = "submit";
    public const string Accept = "accept";
    public const string Escalate = "escalate";
    public const string Return = "return";
    public const string Decide = "decide";
    public const string Archive = "archive";
}

public sealed record WorkflowTransition(
    string FromState,
    string Action,
    string ActorRole,
    string ToState,
    bool RequiresVerifiedDocuments,
    bool RequiresNote);

/// <summary>
/// Bản sao luật chuyển bước của luồng "in_progress" để kiểm thử và báo lỗi sớm.
/// Nguồn chính thức là bảng hoso.workflow_transitions và hàm hoso.transition_dossier;
/// kiểm thử tích hợp (task DB-17) so khớp danh sách này với DB.
/// </summary>
public static class WorkflowRules
{
    public const int MinimumNoteLength = 10;

    public static readonly IReadOnlyList<WorkflowTransition> InProgress =
    [
        new(WorkflowState.Draft, WorkflowAction.Submit, RoleCode.Employee, WorkflowState.DepartmentReview, true, false),
        new(WorkflowState.Draft, WorkflowAction.Submit, RoleCode.Clerk, WorkflowState.DepartmentReview, true, false),
        new(WorkflowState.Returned, WorkflowAction.Submit, RoleCode.Employee, WorkflowState.DepartmentReview, true, false),
        new(WorkflowState.Returned, WorkflowAction.Submit, RoleCode.Clerk, WorkflowState.DepartmentReview, true, false),
        new(WorkflowState.DepartmentReview, WorkflowAction.Accept, RoleCode.Manager, WorkflowState.ReadyArchive, true, false),
        new(WorkflowState.DepartmentReview, WorkflowAction.Escalate, RoleCode.Manager, WorkflowState.LeadershipReview, true, true),
        new(WorkflowState.DepartmentReview, WorkflowAction.Return, RoleCode.Manager, WorkflowState.Returned, false, true),
        new(WorkflowState.ReadyArchive, WorkflowAction.Archive, RoleCode.Clerk, WorkflowState.Archived, true, false),
        new(WorkflowState.ReadyArchive, WorkflowAction.Return, RoleCode.Clerk, WorkflowState.Returned, false, true),
        new(WorkflowState.LeadershipReview, WorkflowAction.Decide, RoleCode.Chair, WorkflowState.ReadyArchive, true, true),
        new(WorkflowState.LeadershipReview, WorkflowAction.Return, RoleCode.Chair, WorkflowState.DepartmentReview, false, true),
        new(WorkflowState.LeadershipReview, WorkflowAction.Decide, RoleCode.Council, WorkflowState.ReadyArchive, true, true),
        new(WorkflowState.LeadershipReview, WorkflowAction.Return, RoleCode.Council, WorkflowState.DepartmentReview, false, true),
    ];

    public static IReadOnlyList<WorkflowTransition> Allowed(string state, string role) =>
        InProgress.Where(t => t.FromState == state && t.ActorRole == role).ToList();

    public static bool NoteIsSufficient(string? note) =>
        (note?.Trim().Length ?? 0) >= MinimumNoteLength;
}
