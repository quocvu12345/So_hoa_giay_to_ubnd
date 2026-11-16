using HoSoSo.Domain.Identity;
using HoSoSo.Domain.Workflow;

namespace HoSoSo.Domain.Tests;

public sealed class WorkflowRulesTests
{
    [Fact]
    public void Co_dung_13_luat_nhu_seed_002()
    {
        WorkflowRules.InProgress.Count.ShouldBe(13);
    }

    [Fact]
    public void Chuyen_vien_chi_trinh_duoc_khi_dang_chuan_bi_hoac_bi_tra_lai()
    {
        WorkflowRules.Allowed(WorkflowState.Draft, RoleCode.Employee).Select(t => t.Action).ShouldBe([WorkflowAction.Submit]);
        WorkflowRules.Allowed(WorkflowState.DepartmentReview, RoleCode.Employee).ShouldBeEmpty();
    }

    [Fact]
    public void Truong_phong_tra_lai_hoac_trinh_lanh_dao_phai_co_y_kien()
    {
        var rules = WorkflowRules.Allowed(WorkflowState.DepartmentReview, RoleCode.Manager);
        rules.Single(t => t.Action == WorkflowAction.Return).RequiresNote.ShouldBeTrue();
        rules.Single(t => t.Action == WorkflowAction.Escalate).RequiresNote.ShouldBeTrue();
        rules.Single(t => t.Action == WorkflowAction.Accept).RequiresNote.ShouldBeFalse();
    }

    [Theory]
    [InlineData(null, false)]
    [InlineData("   ngắn   ", false)]
    [InlineData("Thiếu báo cáo kết quả", true)]
    public void Y_kien_can_toi_thieu_10_ky_tu(string? note, bool expected)
    {
        WorkflowRules.NoteIsSufficient(note).ShouldBe(expected);
    }

    [Fact]
    public void Quan_tri_ky_thuat_khong_co_quyen_nghiep_vu()
    {
        DefaultRolePermissions.For(RoleCode.TechnicalAdmin).ShouldNotContain(Permissions.DossierRead);
        DefaultRolePermissions.For(RoleCode.TechnicalAdmin).ShouldNotContain(Permissions.DocumentView);
    }
}
