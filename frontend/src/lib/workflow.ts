import type { RoleCode } from "@/lib/auth/permissions";
import type { WorkflowState } from "@/lib/mock/data";

export type WorkflowAction = "submit" | "accept" | "escalate" | "return" | "decide" | "archive";

export type AllowedAction = {
  action: WorkflowAction;
  label: string;
  requiresNote: boolean;
  primary: boolean;
};

/**
 * CHỈ DÙNG KHI GIẢ LẬP. Bản thật lấy từ GET /api/v1/dossiers/{id}/actions (BE-66);
 * frontend không tự suy luật chuyển bước. Bảng này chép từ workflow_transitions trong
 * database/002_seed_catalog.sql để khung giao diện hiển thị đúng nút theo vai trò.
 */
const RULES: Array<[WorkflowState, WorkflowAction, RoleCode, boolean]> = [
  ["draft", "submit", "employee", false],
  ["draft", "submit", "clerk", false],
  ["returned", "submit", "employee", false],
  ["returned", "submit", "clerk", false],
  ["department_review", "accept", "manager", false],
  ["department_review", "escalate", "manager", true],
  ["department_review", "return", "manager", true],
  ["ready_archive", "archive", "clerk", false],
  ["ready_archive", "return", "clerk", true],
  ["leadership_review", "decide", "chair", true],
  ["leadership_review", "return", "chair", true],
  ["leadership_review", "decide", "council", true],
  ["leadership_review", "return", "council", true],
];

const LABELS: Record<WorkflowAction, string> = {
  submit: "Trình trưởng phòng / Ban",
  accept: "Đạt, chuyển nộp lưu",
  escalate: "Trình lãnh đạo cho ý kiến",
  return: "Trả lại để bổ sung",
  decide: "Cho ý kiến hoàn tất",
  archive: "Tiếp nhận nộp lưu",
};

export function mockAllowedActions(state: WorkflowState, role: RoleCode): AllowedAction[] {
  return RULES.filter(([from, , r]) => from === state && r === role).map(([, action, , requiresNote]) => ({
    action,
    label: LABELS[action],
    requiresNote,
    primary: action !== "return",
  }));
}
