/**
 * Quy tắc phía giao diện cho tab Phân công (FE-31). API (assign_dossier) vẫn là nơi quyết định cuối cùng; ở đây chỉ báo sớm, trước khi gửi.
 * Không `import "server-only"` để dùng chung với test và thành phần máy khách.
 */
import type { components } from "@/api/schema";

export type AssigneeOption = components["schemas"]["AssigneeOption"];

export const MIN_NOTE_LENGTH = 10;

/** Bỏ dấu và hạ chữ thường để gõ "nguyen van an" ra "Nguyễn Văn An". */
export function foldText(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase().trim();
}

/** Lọc theo từ khóa: mọi từ gõ vào đều phải có trong tên (không dấu, không phân biệt hoa thường). Rỗng thì giữ nguyên thứ tự của API. */
export function filterAssignees(options: AssigneeOption[], query: string): AssigneeOption[] {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return options;
  return options.filter((o) => {
    const name = foldText(o.displayName);
    return words.every((w) => name.includes(w));
  });
}

/** Ngày hôm nay theo giờ Việt Nam, dạng yyyy-mm-dd (cùng cách API tính "quá hạn"). */
export function todayVietnam(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export type AssignValues = { userId: string; dueOn: string; note: string };
export type AssignErrors = Partial<Record<keyof AssignValues, string>>;

/**
 * - Phải chọn một người.
 * - Hạn (nếu có) không trước hôm nay.
 * - Đổi sang người KHÁC phải ghi lý do tối thiểu 10 ký tự (lịch sử phân công nằm ở Nhật ký); chỉ đổi hạn cho cùng một người thì không bắt buộc.
 */
export function validateAssignment(values: AssignValues, currentAssigneeId: string | null, today: string): AssignErrors {
  const errors: AssignErrors = {};
  if (!values.userId) errors.userId = "Chọn người chủ trì.";
  if (values.dueOn && !/^\d{4}-\d{2}-\d{2}$/.test(values.dueOn)) errors.dueOn = "Nhập ngày đúng dạng ngày/tháng/năm.";
  else if (values.dueOn && values.dueOn < today) errors.dueOn = "Hạn nội bộ không được trước hôm nay.";
  const changing = values.userId !== "" && values.userId !== currentAssigneeId;
  if (changing && values.note.trim().length < MIN_NOTE_LENGTH) errors.note = `Ghi lý do đổi người chủ trì, tối thiểu ${MIN_NOTE_LENGTH} ký tự.`;
  return errors;
}

/** Mô tả tải việc: "Đang giữ 5 hồ sơ, 2 quá hạn" hoặc "Chưa giữ hồ sơ nào". */
export function workload(option: Pick<AssigneeOption, "holding" | "overdue">): string {
  if (option.holding === 0) return "Chưa giữ hồ sơ nào";
  return option.overdue > 0 ? `Đang giữ ${option.holding} hồ sơ, ${option.overdue} quá hạn` : `Đang giữ ${option.holding} hồ sơ`;
}
