import type { components } from "@/api/schema";
import { canonicalViDate, formatViDate, parseViDate } from "@/lib/vi-date";

/**
 * Trạng thái form đối chiếu (FE-23). Toàn hàm thuần: dựng bản nháp từ dữ liệu API, kiểm tra từng ô,
 * so sánh để biết còn thay đổi chưa lưu, và đóng gói tải trọng gửi API. Kiểm thử ở review-state.test.ts.
 */

export type ReviewData = components["schemas"]["ReviewData"];
export type ReviewField = components["schemas"]["ReviewField"];
export type DocumentTypeInfo = components["schemas"]["DocumentTypeDto"];

export type FieldDraft = {
  value: string;
  /** Người dùng đã kiểm trường này với bản gốc (tự bật khi sửa giá trị). */
  confirmed: boolean;
};

export type MetaDraft = {
  title: string;
  documentForm: string;
  documentNumber: string;
  /** Người dùng gõ ngày/tháng/năm; đổi sang yyyy-MM-dd khi gửi. */
  issuedOn: string;
  note: string;
};

export type ReviewDraft = {
  fields: Record<string, FieldDraft>;
  meta: MetaDraft;
};

export const UNKNOWN_FORM = "Chưa xác định";

// ---- ngày ----

// Hàm ngày dùng chung với mọi ô ngày (components/ui/input.tsx): giữ tên xuất cũ để các nơi đang import không đổi.
export { canonicalViDate, formatViDate, parseViDate } from "@/lib/vi-date";

// ---- dựng nháp ----

export function fieldInitialValue(field: ReviewField): string {
  return field.value ?? field.suggestedValue ?? "";
}

/** Trường cần xem trước đứng đầu; giữ thứ tự của danh mục trong từng nhóm. */
export function orderFields(fields: readonly ReviewField[]): ReviewField[] {
  return [...fields].sort((a, b) => Number(Boolean(b.attention)) - Number(Boolean(a.attention)) || a.position - b.position);
}

export function initialDraft(data: ReviewData): ReviewDraft {
  const { document: doc, suggestion } = data;
  // Thông tin đầu văn bản chưa xác nhận thì lấy gợi ý của AI làm điểm bắt đầu; đã xác nhận thì giữ nguyên giá trị đã lưu.
  const checked = doc.metadataStatus === "header_checked";
  const fields: Record<string, FieldDraft> = {};
  for (const field of data.fields) fields[field.fieldCode] = { value: fieldInitialValue(field), confirmed: field.verified };
  return {
    fields,
    meta: {
      title: !checked && suggestion?.title ? suggestion.title : doc.title,
      documentForm: !checked && suggestion?.documentForm && doc.documentForm === UNKNOWN_FORM ? suggestion.documentForm : doc.documentForm,
      documentNumber: doc.documentNumber ?? "",
      issuedOn: formatViDate(doc.issuedOn),
      note: doc.metadataReviewNote ?? "",
    },
  };
}

export function draftsEqual(a: ReviewDraft, b: ReviewDraft): boolean {
  const keys = new Set([...Object.keys(a.fields), ...Object.keys(b.fields)]);
  for (const key of keys) {
    const x = a.fields[key];
    const y = b.fields[key];
    if (!x || !y || x.value !== y.value || x.confirmed !== y.confirmed) return false;
  }
  return (Object.keys(a.meta) as (keyof MetaDraft)[]).every((k) => a.meta[k] === b.meta[k]);
}

// ---- kiểm tra ----

/** Lỗi theo ô. Khóa trường dữ liệu là mã trường; khóa đầu văn bản là meta.<tên>. */
export type ReviewErrors = Record<string, string>;

const NUMBER = /^[+-]?\d[\d.,\s]*$/;

export function validateField(field: Pick<ReviewField, "valueType">, value: string): string | null {
  const text = value.trim();
  if (text === "") return null;
  if (text.length > 2000) return "Tối đa 2000 ký tự.";
  if (field.valueType === "date" && parseViDate(text) === null) return "Nhập ngày dạng ngày/tháng/năm, ví dụ 20/01/2026. Để trống nếu tài liệu không có.";
  if (field.valueType === "number" && !NUMBER.test(text)) return "Nhập số, ví dụ 80,5 hoặc 1.250.000.";
  return null;
}

export function validateMeta(meta: MetaDraft): ReviewErrors {
  const errors: ReviewErrors = {};
  if (meta.title.trim() === "") errors["meta.title"] = "Nhập tiêu đề (trích yếu) của giấy tờ.";
  else if (meta.title.length > 2000) errors["meta.title"] = "Tiêu đề tối đa 2000 ký tự.";
  if (meta.documentForm.trim() === "" || meta.documentForm.trim() === UNKNOWN_FORM) errors["meta.documentForm"] = "Chọn hoặc nhập hình thức văn bản, ví dụ Công văn, Quyết định, Tờ trình.";
  else if (meta.documentForm.length > 200) errors["meta.documentForm"] = "Hình thức tối đa 200 ký tự.";
  if (meta.documentNumber.length > 200) errors["meta.documentNumber"] = "Số, ký hiệu tối đa 200 ký tự.";
  if (meta.issuedOn.trim() !== "" && parseViDate(meta.issuedOn) === null) errors["meta.issuedOn"] = "Nhập ngày dạng ngày/tháng/năm, ví dụ 20/01/2026. Để trống nếu văn bản không ghi ngày.";
  if (meta.note.length > 2000) errors["meta.note"] = "Ghi chú tối đa 2000 ký tự.";
  return errors;
}

export function validateDraft(data: ReviewData, draft: ReviewDraft): ReviewErrors {
  const errors = validateMeta(draft.meta);
  for (const field of data.fields) {
    const message = validateField(field, draft.fields[field.fieldCode]?.value ?? "");
    if (message) errors[field.fieldCode] = message;
  }
  return errors;
}

/** Trường cần chú ý mà người dùng chưa đánh dấu đã kiểm: chặn xác nhận cho tới khi xem xong. */
export function pendingAttention(data: ReviewData, draft: ReviewDraft): ReviewField[] {
  return data.fields.filter((f) => f.attention && !draft.fields[f.fieldCode]?.confirmed);
}

// ---- gửi API ----

export type FieldEdit = { fieldCode: string; value: string | null; verify: boolean };

/** Xác nhận giấy tờ: mọi trường được đánh dấu đã đối chiếu; ô trống nghĩa là tài liệu không có trường đó. */
export function buildFieldEdits(data: ReviewData, draft: ReviewDraft): FieldEdit[] {
  return data.fields.map((f) => {
    const value = (draft.fields[f.fieldCode]?.value ?? "").trim();
    return { fieldCode: f.fieldCode, value: value === "" ? null : f.valueType === "date" ? canonicalViDate(value) : value, verify: true };
  });
}

export type MetaPayload = { title: string; documentForm: string; documentNumber: string | null; issuedOn: string | null; note: string | null };

export function buildMetaPayload(meta: MetaDraft): MetaPayload {
  return {
    title: meta.title.trim(),
    documentForm: meta.documentForm.trim(),
    documentNumber: meta.documentNumber.trim() || null,
    issuedOn: meta.issuedOn.trim() ? parseViDate(meta.issuedOn) : null,
    note: meta.note.trim() || null,
  };
}

// ---- nháp trong sessionStorage ----

const DRAFT_VERSION = 1;

export function draftStorageKey(documentId: string): string {
  return `hoso:review-draft:${documentId}`;
}

type StoredDraft = { v: number; docVersion: number; savedAt: string; draft: ReviewDraft };

export function serializeDraft(documentVersion: number, draft: ReviewDraft, now = new Date()): string {
  const stored: StoredDraft = { v: DRAFT_VERSION, docVersion: documentVersion, savedAt: now.toISOString(), draft };
  return JSON.stringify(stored);
}

/**
 * Đọc nháp đã lưu. Bỏ nháp nếu hỏng, sai định dạng, hoặc giấy tờ đã đổi phiên bản kể từ lúc lưu
 * (người khác hoặc AI vừa cập nhật) vì khi đó nháp có thể ghi đè dữ liệu mới.
 */
export function parseDraft(raw: string | null, documentVersion: number): { draft: ReviewDraft; savedAt: string } | null {
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as Partial<StoredDraft>;
    if (stored.v !== DRAFT_VERSION || stored.docVersion !== documentVersion || !stored.draft?.fields || !stored.draft.meta || typeof stored.savedAt !== "string") return null;
    return { draft: stored.draft, savedAt: stored.savedAt };
  } catch {
    return null;
  }
}

/** Phủ nháp lên bản gốc: chỉ giữ các trường còn tồn tại (loại giấy tờ có thể đã đổi). */
export function mergeDraft(base: ReviewDraft, saved: ReviewDraft): ReviewDraft {
  const fields = { ...base.fields };
  for (const [code, value] of Object.entries(saved.fields)) if (code in fields) fields[code] = value;
  return { fields, meta: { ...base.meta, ...saved.meta } };
}
