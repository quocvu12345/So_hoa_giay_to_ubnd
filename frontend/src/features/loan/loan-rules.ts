/** Quy tắc thuần cho mượn trả bản giấy (FE-36, BE-83): nhãn, bộ lọc, hạn trả, thao tác theo bước và theo quyền. */

export const MIN_PURPOSE = 5;
export const MAX_PURPOSE = 500;
export const DEFAULT_LOAN_DAYS = 14;
export const MAX_LOAN_DAYS = 90;

export const LOAN_STATUS: Record<string, string> = {
  requested: "Chờ duyệt", approved: "Đã duyệt, chờ giao", lent: "Đang mượn", overdue: "Quá hạn trả", returned: "Đã trả", rejected: "Bị từ chối",
};
export const LOAN_FILTERS: readonly { value: "dang-xu-ly" | "da-tra" | "tu-choi" | "tat-ca"; label: string; statuses: readonly string[] }[] = [
  { value: "dang-xu-ly", label: "Đang xử lý", statuses: ["requested", "approved", "lent", "overdue"] },
  { value: "da-tra", label: "Đã trả", statuses: ["returned"] },
  { value: "tu-choi", label: "Bị từ chối", statuses: ["rejected"] },
  { value: "tat-ca", label: "Tất cả", statuses: [] },
];
export type LoanFilter = (typeof LOAN_FILTERS)[number]["value"];

export function parseLoanFilter(value: unknown): LoanFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return LOAN_FILTERS.find((f) => f.value === v)?.value ?? "dang-xu-ly";
}

export function filterLoans<T extends { status: string }>(rows: readonly T[], filter: LoanFilter): T[] {
  const statuses = LOAN_FILTERS.find((f) => f.value === filter)?.statuses ?? [];
  return statuses.length === 0 ? [...rows] : rows.filter((r) => statuses.includes(r.status));
}

export function validatePurpose(text: string): string | null {
  const length = text.trim().length;
  if (length < MIN_PURPOSE) return `Nêu mục đích mượn (ít nhất ${MIN_PURPOSE} ký tự, đang ${length}).`;
  if (length > MAX_PURPOSE) return `Mục đích tối đa ${MAX_PURPOSE} ký tự.`;
  return null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Hạn trả (yyyy-mm-dd, giờ Việt Nam) từ hôm nay đến tối đa 90 ngày; rỗng là hợp lệ (API lấy mặc định 14 ngày). */
export function validateDue(due: string, today: string, maxDays = MAX_LOAN_DAYS): string | null {
  if (due === "") return null;
  if (!ISO.test(due)) return "Hạn trả không hợp lệ.";
  if (due < today) return "Hạn trả phải từ hôm nay trở đi.";
  if (due > addDays(today, maxDays)) return `Hạn trả tối đa ${maxDays} ngày kể từ hôm nay.`;
  return null;
}

export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export function todayVietnam(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Số ngày quá hạn (≥ 1) hoặc 0 nếu chưa quá hạn / không có hạn. */
export function overdueDays(dueOn: string | null | undefined, today: string): number {
  if (!dueOn || !ISO.test(dueOn) || dueOn >= today) return 0;
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueOn}T00:00:00Z`)) / 86_400_000);
}

export type LoanPerms = { canApprove: boolean };

/** Thao tác khả dụng: người duyệt duyệt/từ chối đề nghị, giao khoản đã duyệt, nhận trả khoản đang mượn hoặc quá hạn. Người mượn chỉ xem. */
export function loanActions(status: string, perms: LoanPerms): { approve: boolean; reject: boolean; lend: boolean; receive: boolean } {
  return {
    approve: perms.canApprove && status === "requested",
    reject: perms.canApprove && status === "requested",
    lend: perms.canApprove && status === "approved",
    receive: perms.canApprove && (status === "lent" || status === "overdue"),
  };
}

export function validateRejectNote(text: string): string | null {
  const length = text.trim().length;
  return length >= MIN_PURPOSE ? null : `Từ chối cần ghi lý do (ít nhất ${MIN_PURPOSE} ký tự, đang ${length}).`;
}
