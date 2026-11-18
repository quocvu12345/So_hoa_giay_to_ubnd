/**
 * Quy tắc thuần cho quản trị người dùng, phân công và ủy quyền (FE-42). Khớp luật của API (`CreateUserValidator`, `RoleShapeErrors`,
 * `CreateDelegationAsync`); API vẫn kiểm lại và trả lỗi theo ô.
 */

export const USERNAME = /^[a-z0-9][a-z0-9._-]{2,49}$/;
export const MIN_BASIS = 10;
export const MAX_DELEGATION_DAYS = 90;
/** Phân công hết trong chừng này ngày thì báo vàng (khớp `AdminHandler.ExpiringWithinDays`). */
export const EXPIRING_DAYS = 7;

export const ASSIGNMENT_STATE: Record<string, string> = { active: "Đang hiệu lực", upcoming: "Sắp bắt đầu", ended: "Đã kết thúc" };
export const DELEGATION_STATE: Record<string, string> = { active: "Đang hiệu lực", upcoming: "Sắp bắt đầu", ended: "Đã hết hạn", revoked: "Đã thu hồi" };

// ---- người dùng ----
export type UserForm = { username: string; displayName: string; email: string; externalAuthSubject: string };
export type UserFormErrors = Partial<Record<keyof UserForm, string>>;

export function validateUserForm(form: UserForm, mode: "create" | "edit" = "create"): UserFormErrors {
  const errors: UserFormErrors = {};
  if (mode === "create" && !USERNAME.test(form.username.trim().toLowerCase())) errors.username = "Tên đăng nhập 3–50 ký tự gồm chữ thường không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.";
  const name = form.displayName.trim();
  if (name.length === 0) errors.displayName = "Nhập họ tên hiển thị.";
  else if (name.length > 200) errors.displayName = "Họ tên tối đa 200 ký tự.";
  const email = form.email.trim();
  if (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Email không hợp lệ.";
  if (form.externalAuthSubject.trim().length > 200) errors.externalAuthSubject = "Mã danh tính tối đa 200 ký tự.";
  return errors;
}

// ---- phân công ----
/** Vai trò nào cần cơ quan, đơn vị (khớp CHECK của user_roles): quản trị kỹ thuật không gắn gì; chuyên viên, trưởng phòng cần cả hai; còn lại cần cơ quan. */
export function roleScope(role: string): { organization: boolean; department: boolean } {
  if (role === "technical_admin") return { organization: false, department: false };
  if (role === "employee" || role === "manager") return { organization: true, department: true };
  return { organization: true, department: false };
}

export type AssignmentForm = { userId: string; roleCode: string; organizationCode: string; departmentCode: string; validFrom: string; validUntil: string; basis: string };
export type AssignmentErrors = Partial<Record<keyof AssignmentForm, string>>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateAssignment(form: AssignmentForm): AssignmentErrors {
  const errors: AssignmentErrors = {};
  if (!form.roleCode) errors.roleCode = "Chọn vai trò.";
  const scope = roleScope(form.roleCode);
  if (scope.organization && !form.organizationCode) errors.organizationCode = "Chọn cơ quan.";
  if (scope.department && !form.departmentCode) errors.departmentCode = "Chọn đơn vị (phòng, Ban).";
  if (form.validFrom && !ISO_DATE.test(form.validFrom)) errors.validFrom = "Ngày bắt đầu không hợp lệ.";
  if (form.validUntil && !ISO_DATE.test(form.validUntil)) errors.validUntil = "Ngày hết hạn không hợp lệ.";
  if (!errors.validFrom && !errors.validUntil && form.validFrom && form.validUntil && form.validUntil <= form.validFrom) errors.validUntil = "Ngày hết hạn phải sau ngày bắt đầu.";
  if (form.basis.trim().length < MIN_BASIS) errors.basis = `Ghi căn cứ từ ${MIN_BASIS} ký tự, ví dụ số quyết định bổ nhiệm.`;
  return errors;
}

/** Đổi ô ngày (yyyy-mm-dd, giờ Việt Nam) sang thời điểm UTC gửi API: đầu ngày cho "từ", cuối ngày cho "đến" (hết hạn bao gồm cả ngày đó). */
export function dayToInstant(day: string, edge: "start" | "end"): string | null {
  if (!ISO_DATE.test(day)) return null;
  return new Date(`${day}T${edge === "start" ? "00:00:00" : "23:59:59"}+07:00`).toISOString();
}

/** Số ngày còn lại tới lúc hết hạn (làm tròn lên); null khi không có hạn; âm khi đã qua. */
export function daysLeft(validUntil: string | null | undefined, now: Date = new Date()): number | null {
  if (!validUntil) return null;
  const end = Date.parse(validUntil);
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - now.getTime()) / 86_400_000);
}

/** Chip hạn của một phân công đang hiệu lực: vàng khi sắp hết (≤ 7 ngày), đỏ khi hết trong hôm nay. Không có hạn hoặc còn lâu thì không chip. */
export function expiryChip(validUntil: string | null | undefined, now: Date = new Date()): { tone: "warn" | "bad"; text: string } | null {
  const left = daysLeft(validUntil, now);
  if (left === null || left > EXPIRING_DAYS || left < 0) return null;
  if (left <= 1) return { tone: "bad", text: "Hết hạn trong hôm nay hoặc ngày mai" };
  return { tone: "warn", text: `Hết hạn sau ${left} ngày` };
}

// ---- ủy quyền ----
export type DelegationForm = { fromAssignmentId: string; toUserId: string; permissionCodes: string[]; validFrom: string; validUntil: string; basis: string };
export type DelegationErrors = Partial<Record<keyof DelegationForm, string>>;

export function validateDelegation(form: DelegationForm, today: string): DelegationErrors {
  const errors: DelegationErrors = {};
  if (!form.fromAssignmentId) errors.fromAssignmentId = "Chọn phân công của người ủy quyền.";
  if (!form.toUserId) errors.toUserId = "Chọn người nhận ủy quyền.";
  if (form.permissionCodes.length === 0) errors.permissionCodes = "Chọn ít nhất một quyền để ủy quyền.";
  const from = form.validFrom || today;
  if (!form.validUntil || !ISO_DATE.test(form.validUntil)) errors.validUntil = "Chọn ngày hết hạn.";
  else if (form.validFrom && !ISO_DATE.test(form.validFrom)) errors.validFrom = "Ngày bắt đầu không hợp lệ.";
  else if (form.validUntil <= from) errors.validUntil = "Ngày hết hạn phải sau ngày bắt đầu.";
  else if ((Date.parse(`${form.validUntil}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 > MAX_DELEGATION_DAYS) errors.validUntil = `Ủy quyền tối đa ${MAX_DELEGATION_DAYS} ngày; cần kéo dài thì tạo ủy quyền mới.`;
  if (form.basis.trim().length < MIN_BASIS) errors.basis = `Ghi căn cứ từ ${MIN_BASIS} ký tự, ví dụ lý do đi công tác.`;
  return errors;
}

/** Ngày hôm nay theo giờ Việt Nam, yyyy-mm-dd. */
export function todayVietnam(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Ngày muộn nhất chọn được cho ủy quyền bắt đầu từ `from` (yyyy-mm-dd). */
export function maxDelegationEnd(from: string): string {
  return new Date(Date.parse(`${from}T00:00:00Z`) + MAX_DELEGATION_DAYS * 86_400_000).toISOString().slice(0, 10);
}

export type UserFilter = { q: string; status: "" | "active" | "locked"; expiring: boolean };

/** Bộ lọc danh sách người dùng từ URL (`?q=&tt=&sap-het-han=1`). */
export function parseUserFilter(params: Record<string, string | string[] | undefined>): UserFilter {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  const status = first(params.tt);
  return { q: first(params.q).slice(0, 100), status: status === "active" || status === "locked" ? status : "", expiring: first(params["sap-het-han"]) === "1" };
}

export function userListHref(filter: UserFilter): string {
  const query = new URLSearchParams();
  if (filter.q) query.set("q", filter.q);
  if (filter.status) query.set("tt", filter.status);
  if (filter.expiring) query.set("sap-het-han", "1");
  const text = query.toString();
  return text ? `/quan-tri/nguoi-dung?${text}` : "/quan-tri/nguoi-dung";
}
