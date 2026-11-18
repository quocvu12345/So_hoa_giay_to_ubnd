import type { NotificationItem } from "./notification-data";

/**
 * Nơi mở khi bấm một thông báo. API đã ép `link` bắt đầu bằng một dấu `/` (không phải `//`), nhưng nơi hiển thị vẫn kiểm lại:
 * chỉ nhận đường dẫn tương đối trong ứng dụng, tuyệt đối không chuyển người dùng ra ngoài.
 */
export function notificationHref(item: Pick<NotificationItem, "link" | "dossierId">): string | null {
  const link = item.link?.trim();
  if (link && /^\/(?![/\\])/.test(link) && !/[\u0000-\u001f]/.test(link)) return link;
  if (item.dossierId) return `/ho-so/${item.dossierId}`;
  return null;
}

/** Số hiện trên chuông: 99+ khi nhiều; 0 thì không hiện. */
export function bellLabel(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count > 99 ? "99+" : String(Math.floor(count));
}

/** Gộp trang mới vào danh sách đang có, bỏ trùng theo mã (thông báo mới đến làm trang lệch một dòng). */
export function mergePages<T extends { id: string }>(current: readonly T[], more: readonly T[]): T[] {
  const seen = new Set(current.map((i) => i.id));
  return [...current, ...more.filter((i) => !seen.has(i.id))];
}

/** Nhóm của thông báo theo tiền tố mã loại (`archive.received` → "Nộp lưu"). Loại lạ vẫn hiện, gọi chung là "Thông báo". */
const KIND_GROUPS: [prefix: string, label: string][] = [
  ["dossier.due", "Hạn hồ sơ"],
  ["overdue", "Hạn hồ sơ"],
  ["archive.", "Nộp lưu"],
  ["disposal.", "Đề nghị hủy"],
  ["loan.", "Mượn trả"],
  ["export.", "Xuất dữ liệu"],
  ["backup.", "Sao lưu"],
  ["accesslog.", "Nhật ký"],
];

export function kindLabel(kind: string): string {
  return KIND_GROUPS.find(([prefix]) => kind === prefix || kind.startsWith(prefix))?.[1] ?? "Hồ sơ";
}
