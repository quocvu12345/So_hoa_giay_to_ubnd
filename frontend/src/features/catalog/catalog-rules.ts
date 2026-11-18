/** Quy tắc thuần cho quản trị danh mục (FE-43, BE-32, BE-35): khớp luật của `CatalogAdminHandler`; API vẫn kiểm lại và trả lỗi theo ô. */

export const VALUE_TYPES = [
  { value: "text", label: "Chữ" }, { value: "date", label: "Ngày" }, { value: "number", label: "Số" }, { value: "boolean", label: "Có / không" },
] as const;
export const VALUE_TYPE_LABEL: Record<string, string> = Object.fromEntries(VALUE_TYPES.map((v) => [v.value, v.label]));
export const VERIFICATION: Record<string, string> = { proposed: "Đề xuất, chưa xác nhận", confirmed: "Đã xác nhận" };
export const RETENTION_STATUS: Record<string, string> = { proposed: "Đề xuất", confirmed: "Đã xác nhận" };

export const GROUP_CODE = /^[A-Za-z][A-Za-z0-9]{1,9}$/;
export const MIN_LEGAL_REFERENCE = 5;

type Errors<K extends string> = Partial<Record<K, string>>;

export function validateGroup(v: { code?: string; title: string; departmentCode?: string; organizationCode?: string }, mode: "create" | "edit"): Errors<"code" | "title" | "departmentCode" | "organizationCode"> {
  const e: Errors<"code" | "title" | "departmentCode" | "organizationCode"> = {};
  if (mode === "create") {
    if (!GROUP_CODE.test((v.code ?? "").trim())) e.code = "Mã nhóm 2–10 ký tự gồm chữ và số, bắt đầu bằng chữ (ví dụ U35).";
    if (!v.organizationCode) e.organizationCode = "Chọn cơ quan.";
    if (!v.departmentCode) e.departmentCode = "Chọn đơn vị phụ trách.";
  }
  const title = v.title.trim();
  if (title.length === 0) e.title = "Nhập tên nhóm hồ sơ.";
  else if (title.length > 300) e.title = "Tên nhóm tối đa 300 ký tự.";
  return e;
}

export function validateDocumentType(v: { name: string; minCount: string }): Errors<"name" | "minCount"> {
  const e: Errors<"name" | "minCount"> = {};
  const name = v.name.trim();
  if (name.length === 0) e.name = "Nhập tên loại giấy tờ.";
  else if (name.length > 300) e.name = "Tên tối đa 300 ký tự.";
  const min = v.minCount.trim();
  if (min !== "" && (!/^\d+$/.test(min) || Number(min) > 100)) e.minCount = "Số lượng tối thiểu từ 0 đến 100.";
  return e;
}

/** Biểu thức kiểm tra giá trị trường: phải biên dịch được (API dùng .NET Regex; chỉ bắt lỗi cú pháp thông thường ở đây). */
export function isValidPattern(pattern: string): boolean {
  if (pattern.trim() === "") return true;
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

export function validateField(v: { label: string; valueType: string; validationPattern: string }): Errors<"label" | "valueType" | "validationPattern"> {
  const e: Errors<"label" | "valueType" | "validationPattern"> = {};
  const label = v.label.trim();
  if (label.length === 0) e.label = "Nhập tên trường.";
  else if (label.length > 200) e.label = "Tên trường tối đa 200 ký tự.";
  if (!VALUE_TYPES.some((t) => t.value === v.valueType)) e.valueType = "Chọn kiểu giá trị.";
  if (!isValidPattern(v.validationPattern)) e.validationPattern = "Biểu thức kiểm tra không hợp lệ.";
  return e;
}

export function validateRetention(v: { retentionLabel: string; retentionYears: string }): Errors<"retentionLabel" | "retentionYears"> {
  const e: Errors<"retentionLabel" | "retentionYears"> = {};
  const label = v.retentionLabel.trim();
  if (label.length === 0) e.retentionLabel = 'Nhập thời hạn bảo quản (ví dụ "Vĩnh viễn", "20 năm").';
  else if (label.length > 100) e.retentionLabel = "Tối đa 100 ký tự.";
  const years = v.retentionYears.trim();
  if (years !== "" && (!/^\d+$/.test(years) || Number(years) > 200)) e.retentionYears = "Số năm từ 0 đến 200 (bỏ trống nếu bảo quản vĩnh viễn, không tính hủy).";
  return e;
}

export function validateLegalReference(text: string): string | null {
  const length = text.trim().length;
  return length >= MIN_LEGAL_REFERENCE ? null : `Ghi căn cứ pháp lý từ ${MIN_LEGAL_REFERENCE} ký tự (đang ${length}), ví dụ số hiệu thông tư.`;
}

/** Số nguyên không âm từ ô chữ; rỗng là null. */
export function toCount(text: string): number | null {
  const t = text.trim();
  return t === "" ? null : Number(t);
}

/** Gom nhóm hồ sơ theo đơn vị phụ trách, giữ thứ tự mã trong từng đơn vị; lọc theo từ khóa (không dấu) ở mã, tên. */
export function groupByDepartment<T extends { code: string; title: string; departmentCode: string }>(groups: readonly T[], query: string, fold: (s: string) => string): { department: string; items: T[] }[] {
  const q = fold(query.trim());
  const matched = groups.filter((g) => q === "" || fold(g.code).includes(q) || fold(g.title).includes(q));
  const map = new Map<string, T[]>();
  for (const g of [...matched].sort((a, b) => a.code.localeCompare(b.code, "vi", { numeric: true }))) {
    const list = map.get(g.departmentCode) ?? [];
    list.push(g);
    map.set(g.departmentCode, list);
  }
  return [...map].map(([department, items]) => ({ department, items }));
}
