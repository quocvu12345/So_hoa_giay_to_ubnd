/**
 * Quy tắc thuần cho lô quét và lỗi ảnh (FE-41): nhãn tiếng Việt, kiểm tra biểu mẫu, lời khuyên khi đóng lô.
 * Giới hạn khớp `CreateBatchValidator` và `ResolveIssueValidator` của API (API vẫn kiểm lại).
 */

export const BATCH_LIMITS = { handedOverBy: 200, boxLabel: 100, note: 1000, maxSheets: 100_000 } as const;
/** Chấp nhận bỏ qua lỗi cần lý do từ chừng này ký tự (BE-53, BE-125). */
export const MIN_ACCEPT_NOTE = 10;
export const MIN_REPLACE_REASON = 10;
export const MAX_REPLACE_REASON = 500;

export const BATCH_STATUS: Record<string, string> = { open: "Đang mở", scanning: "Đang quét", qc: "Kiểm tra ảnh", closed: "Đã đóng" };
export const ISSUE_TYPE: Record<string, string> = {
  blank: "Trang trắng", blurry: "Mờ", skewed: "Nghiêng", cropped: "Mất mép", duplicate: "Trùng trang", missing_page: "Thiếu trang", wrong_order: "Sai thứ tự", other: "Khác",
};
export const ISSUE_STATUS: Record<string, string> = { open: "Đang mở", fixed: "Đã sửa", wont_fix: "Chấp nhận bỏ qua" };
export const SEVERITY: Record<string, string> = { low: "Nhẹ", medium: "Vừa", high: "Nặng" };
export const PAGE_QUALITY: Record<string, string> = { ok: "Đạt", suspect: "Nghi ngờ", rescan_required: "Cần quét lại", rescanned: "Đã quét lại" };
export const JOB_STATUS: Record<string, string> = { queued: "Chờ đọc", running: "Đang đọc", completed: "Đã đọc xong", failed: "Lỗi khi đọc", cancelled: "Đã hủy" };

export const ISSUE_TYPES = ["blank", "blurry", "skewed", "cropped", "duplicate", "missing_page", "wrong_order", "other"] as const;

export type BatchFormInput = { handedOverBy: string; boxLabel: string; expectedSheets: string; note: string };
export type BatchFormErrors = Partial<Record<keyof BatchFormInput, string>>;

/** Rỗng là hợp lệ (mọi ô đều không bắt buộc). Số tờ phải là số nguyên không âm. */
export function validateBatchForm(input: BatchFormInput): BatchFormErrors {
  const errors: BatchFormErrors = {};
  if (input.handedOverBy.trim().length > BATCH_LIMITS.handedOverBy) errors.handedOverBy = `Tối đa ${BATCH_LIMITS.handedOverBy} ký tự.`;
  if (input.boxLabel.trim().length > BATCH_LIMITS.boxLabel) errors.boxLabel = `Tối đa ${BATCH_LIMITS.boxLabel} ký tự.`;
  if (input.note.trim().length > BATCH_LIMITS.note) errors.note = `Tối đa ${BATCH_LIMITS.note} ký tự.`;
  const sheets = input.expectedSheets.trim();
  if (sheets !== "" && (!/^\d+$/.test(sheets) || Number(sheets) > BATCH_LIMITS.maxSheets)) errors.expectedSheets = `Nhập số tờ từ 0 đến ${BATCH_LIMITS.maxSheets.toLocaleString("vi-VN")}.`;
  return errors;
}

export function toBatchRequest(input: BatchFormInput) {
  const text = (value: string) => value.trim() || null;
  return { handedOverBy: text(input.handedOverBy), boxLabel: text(input.boxLabel), expectedSheetCount: input.expectedSheets.trim() === "" ? null : Number(input.expectedSheets.trim()), note: text(input.note) };
}

export function validateNote(note: string, min = MIN_ACCEPT_NOTE): string | null {
  const length = note.trim().length;
  return length >= min ? null : `Ghi lý do từ ${min} ký tự (đang ${length}).`;
}

export function validateReplaceReason(reason: string): string | null {
  const length = reason.trim().length;
  if (length < MIN_REPLACE_REASON) return `Ghi lý do thay bản quét từ ${MIN_REPLACE_REASON} ký tự (đang ${length}).`;
  if (length > MAX_REPLACE_REASON) return `Lý do tối đa ${MAX_REPLACE_REASON} ký tự.`;
  return null;
}

/**
 * So số tờ dự kiến với số trang đã quét. Một tờ quét ra một hoặc hai trang nên chỉ cảnh báo khi trang ÍT HƠN số tờ (chắc chắn thiếu);
 * không cố nói "đủ" vì không biết tờ nào in hai mặt.
 */
export function sheetHint(expected: number | null, scannedPages: number): { tone: "neutral" | "warn"; text: string } {
  if (expected === null) return { tone: "neutral", text: `${scannedPages.toLocaleString("vi-VN")} trang đã quét` };
  const text = `${scannedPages.toLocaleString("vi-VN")} trang đã quét / ${expected.toLocaleString("vi-VN")} tờ dự kiến`;
  return scannedPages < expected ? { tone: "warn", text: `${text}: ít trang hơn số tờ, có thể còn thiếu` } : { tone: "neutral", text };
}

/** Lô đang ở trạng thái nào thì cho nạp thêm tệp / đóng. */
export function canAcceptFiles(status: string): boolean {
  return status !== "closed";
}

/** Nội dung cảnh báo trước khi đóng lô còn lỗi mở; null khi đóng thẳng được. */
export function closeWarning(openIssues: number): string | null {
  if (openIssues <= 0) return null;
  return `Còn ${openIssues} lỗi ảnh chưa xử lý. Quét lại các trang lỗi, hoặc ghi lý do chấp nhận bỏ qua để vẫn đóng lô (lỗi được ghi là "chấp nhận bỏ qua" kèm lý do và người xác nhận).`;
}

/** Trang lỗi: "Trang 3" hoặc "Cả tệp". */
export function pageLabel(pageNo: number | null | undefined): string {
  return pageNo ? `Trang ${pageNo}` : "Cả tệp";
}
