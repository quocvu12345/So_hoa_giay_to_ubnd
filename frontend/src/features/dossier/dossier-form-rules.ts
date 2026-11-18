import { parseViDate } from "@/lib/vi-date";

/** Giá trị biểu mẫu tạo/sửa hồ sơ, kiểm tra ngay khi nhập (FE-27). Hàm thuần, kiểm thử ở dossier-form.test.ts. */
export type DossierFormValues = { title: string; workGroupCode: string; accessLevel: string; internalDueOn: string; notes: string; year: string; creatorOrganizationName: string };
export type DossierFormErrors = Partial<Record<keyof DossierFormValues, string>>;

export const ACCESS_LEVELS = [
  { value: "internal", label: "Nội bộ", hint: "Người có phân công liên quan xem được." },
  { value: "restricted", label: "Hạn chế", hint: "Chỉ người được giao và cấp có thẩm quyền xem; xem, tải, in, xuất đều ghi nhật ký riêng." },
  { value: "public", label: "Công khai", hint: "Văn bản đã công bố." },
] as const;

export function validateDossierForm(values: DossierFormValues, mode: "create" | "edit", today: Date = new Date()): DossierFormErrors {
  const errors: DossierFormErrors = {};
  const title = values.title.trim();
  if (title.length < 5) errors.title = "Tên hồ sơ cần ít nhất 5 ký tự, thể hiện vụ việc, kỳ họp hoặc dự án.";
  else if (title.length > 300) errors.title = "Tên hồ sơ tối đa 300 ký tự.";
  if (mode === "create" && !values.workGroupCode) errors.workGroupCode = "Chọn nhóm hồ sơ.";
  if (values.notes.length > 4000) errors.notes = "Ghi chú tối đa 4000 ký tự.";
  if (mode === "create" && values.year.trim() !== "") {
    const year = Number(values.year);
    if (!Number.isInteger(year) || year < 1900 || year > 2200) errors.year = "Năm không hợp lệ, ví dụ 2026.";
  }
  if (values.internalDueOn.trim() !== "") {
    const iso = parseViDate(values.internalDueOn);
    if (iso === null) errors.internalDueOn = "Nhập ngày dạng ngày/tháng/năm, ví dụ 20/11/2026. Để trống nếu chưa có hạn.";
    else if (iso < today.toISOString().slice(0, 10)) errors.internalDueOn = "Hạn nội bộ không được trước hôm nay.";
  }
  return errors;
}

/** Đổi ngày người dùng gõ sang yyyy-MM-dd để gửi API; trống thì rỗng. */
export function dueOnForApi(value: string): string {
  return value.trim() === "" ? "" : (parseViDate(value) ?? "");
}

/** Lỗi của API (khóa theo tên trường) thành lỗi theo ô; khóa lạ trả về riêng để hiện chung. */
export function mapApiErrors(fieldErrors: Record<string, string[]> | undefined): { fields: DossierFormErrors; other: string[] } {
  const known: (keyof DossierFormValues)[] = ["title", "workGroupCode", "accessLevel", "internalDueOn", "notes", "year", "creatorOrganizationName"];
  const fields: DossierFormErrors = {};
  const other: string[] = [];
  for (const [key, messages] of Object.entries(fieldErrors ?? {})) {
    if ((known as string[]).includes(key)) fields[key as keyof DossierFormValues] = messages[0];
    else other.push(...messages);
  }
  return { fields, other };
}
