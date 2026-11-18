/**
 * Liên kết từ bảng tổng hợp của lãnh đạo (FE-47) sang danh sách hồ sơ, sao cho danh sách ra ĐÚNG con số đã bấm
 * (cùng bộ lọc với cách API đếm, BE-115). Không `import "server-only"`: dùng được trong test.
 */
import { parseDossierFilter, toSearchParams } from "@/features/dossier/dossier-filter";

export type StageKey = "preparing" | "awaitingCheck" | "awaitingOpinion" | "awaitingArchive" | "overdue" | "open";

/** Trạng thái hồ sơ tương ứng từng cột; "open" là mọi trạng thái chưa lưu trữ. Khớp cách API gom (LeadershipSummary). */
const STATUSES: Record<Exclude<StageKey, "overdue">, string> = {
  preparing: "draft,returned",
  awaitingCheck: "department_review",
  awaitingOpinion: "leadership_review",
  awaitingArchive: "ready_archive",
  open: "draft,returned,department_review,leadership_review,ready_archive",
};

export const STAGE_LABELS: Record<StageKey, string> = {
  preparing: "Đang chuẩn bị",
  awaitingCheck: "Chờ kiểm tra",
  awaitingOpinion: "Chờ ý kiến",
  awaitingArchive: "Chờ nộp lưu",
  overdue: "Quá hạn",
  open: "Đang xử lý",
};

export const STAGE_ORDER: StageKey[] = ["preparing", "awaitingCheck", "awaitingOpinion", "awaitingArchive", "overdue", "open"];

type Scope = { department?: string; workGroups?: string[] };

/** Địa chỉ danh sách hồ sơ cho một ô (phòng hoặc hoạt động × cột). Ô không có phạm vi nào (hoạt động chưa có nhóm) thì trả null. */
export function listHref(stage: StageKey, scope: Scope): string | null {
  // Hoạt động chưa có nhóm hồ sơ nào (danh sách rỗng) và không có phòng: không có gì để lọc ra, nên không tạo liên kết.
  if (!scope.department && scope.workGroups?.length === 0) return null;
  const params: Record<string, string> = {};
  if (scope.department) params.phong = scope.department;
  if (scope.workGroups && scope.workGroups.length > 0) params.nhom = scope.workGroups.join(",");
  if (stage === "overdue") params["qua-han"] = "1";
  else params["trang-thai"] = STATUSES[stage];
  const query = toSearchParams(parseDossierFilter(params)).toString();
  return `/ho-so${query ? `?${query}` : ""}`;
}

/** Số bằng 0 thì không có gì để mở: không tạo liên kết. */
export function cellHref(stage: StageKey, count: number, scope: Scope): string | null {
  return count > 0 ? listHref(stage, scope) : null;
}
