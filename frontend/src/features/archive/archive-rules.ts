/** Quy tắc thuần cho nộp lưu theo đợt (FE-37, BE-84): nhãn, kiểm tra lý do trả lại, đọc danh sách lỗi từng hồ sơ của API. */

export const MAX_DOSSIERS = 200;
export const MAX_NOTE = 500;
export const MIN_RETURN_NOTE = 10;
export const MIN_ITEM_NOTE = 3;

export const SUBMISSION_STATUS: Record<string, string> = { draft: "Đang soạn", submitted: "Đã nộp, chờ tiếp nhận", received: "Đã tiếp nhận", returned: "Đã trả lại" };
export const SUBMISSION_FILTERS: readonly { value: "dang-xu-ly" | "da-tiep-nhan" | "da-tra-lai" | "tat-ca"; label: string; statuses: readonly string[] }[] = [
  { value: "dang-xu-ly", label: "Đang xử lý", statuses: ["draft", "submitted"] },
  { value: "da-tiep-nhan", label: "Đã tiếp nhận", statuses: ["received"] },
  { value: "da-tra-lai", label: "Đã trả lại", statuses: ["returned"] },
  { value: "tat-ca", label: "Tất cả", statuses: [] },
];
export type SubmissionFilter = (typeof SUBMISSION_FILTERS)[number]["value"];

export function parseSubmissionFilter(value: unknown): SubmissionFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return SUBMISSION_FILTERS.find((f) => f.value === v)?.value ?? "dang-xu-ly";
}

export function filterSubmissions<T extends { status: string }>(rows: readonly T[], filter: SubmissionFilter): T[] {
  const statuses = SUBMISSION_FILTERS.find((f) => f.value === filter)?.statuses ?? [];
  return statuses.length === 0 ? [...rows] : rows.filter((r) => statuses.includes(r.status));
}

export type ArchiveProblem = { dossierId: string; code: string; problem: string };

/**
 * Danh sách hồ sơ có vấn đề API trả kèm lỗi 422 `archive_invalid` (khi gom) hoặc `archive_issues` (khi tiếp nhận) nằm ở `details`.
 * Dạng lạ thì trả rỗng: không đoán, giao diện vẫn hiện thông báo chung.
 */
export function readProblems(details: unknown): ArchiveProblem[] {
  if (!Array.isArray(details)) return [];
  return details.flatMap((d) => {
    if (!d || typeof d !== "object") return [];
    const o = d as Record<string, unknown>;
    const problem = typeof o.problem === "string" ? o.problem : "";
    const dossierId = typeof o.dossierId === "string" ? o.dossierId : "";
    return problem && dossierId ? [{ dossierId, code: typeof o.code === "string" ? o.code : "", problem }] : [];
  });
}

export type ReturnErrors = { note?: string; issues?: string };

/** Trả lại đợt: lý do chung từ 10 ký tự; mỗi hồ sơ nêu lỗi cần mô tả ≥ 3 ký tự. */
export function validateReturn(note: string, issues: { dossierId: string; note: string }[]): ReturnErrors {
  const errors: ReturnErrors = {};
  if (note.trim().length < MIN_RETURN_NOTE) errors.note = `Trả lại cần nêu lý do (ít nhất ${MIN_RETURN_NOTE} ký tự, đang ${note.trim().length}).`;
  if (issues.some((i) => i.note.trim().length < MIN_ITEM_NOTE)) errors.issues = `Mỗi hồ sơ nêu lỗi cần mô tả ít nhất ${MIN_ITEM_NOTE} ký tự.`;
  return errors;
}

/** Chọn thêm/bớt một hồ sơ, không vượt quá giới hạn một đợt. Trả tập mới và có bị chặn vì quá giới hạn không. */
export function toggleSelection(selected: ReadonlySet<string>, id: string, max = MAX_DOSSIERS): { next: Set<string>; blocked: boolean } {
  const next = new Set(selected);
  if (next.delete(id)) return { next, blocked: false };
  if (next.size >= max) return { next, blocked: true };
  next.add(id);
  return { next, blocked: false };
}

/** Đợt ở bước nào thì làm được gì. */
export function allowedActions(status: string): { submit: boolean; remove: boolean; receive: boolean; giveBack: boolean; minutes: boolean } {
  return { submit: status === "draft", remove: status === "draft", receive: status === "submitted", giveBack: status === "submitted", minutes: status === "received" };
}

export const CHECK_RESULT: Record<string, string> = { pending: "Chưa kiểm", ok: "Đạt", issue: "Có vấn đề" };
