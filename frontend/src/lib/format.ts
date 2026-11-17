/** Định dạng hiển thị dùng chung: ngày dd/mm/yyyy, giờ theo múi giờ Việt Nam, số nhóm hàng nghìn. */

const dateTime = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });

/** "2026-11-20" hoặc "2026-11-20T08:00:00Z" → "20/11/2026". Rỗng thì "—". Không đổi múi giờ của ngày thuần (không có giờ). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (plain) return `${plain[3]}/${plain[2]}/${plain[1]}`;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(date);
}

/** "20/11/2026 15:20" theo giờ Việt Nam. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTime.format(date).replace(",", "");
}

/** Số ngày từ hôm nay (giờ Việt Nam) tới hạn: âm là đã quá hạn. Không có hạn thì null. */
export function daysUntil(dueOn: string | null | undefined, now: Date = new Date()): number | null {
  if (!dueOn || !/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) return null;
  const todayVn = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now); // yyyy-mm-dd
  const ms = Date.parse(`${dueOn}T00:00:00Z`) - Date.parse(`${todayVn}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
