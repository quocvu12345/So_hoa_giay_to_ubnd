import "server-only";
import type { components } from "@/api/schema";
import { ok, serverApi } from "@/lib/api/server";

export type NotificationItem = components["schemas"]["NotificationDto"];
export type NotificationPage = components["schemas"]["NotificationList"];

/** Thông báo của chính người dùng, mới nhất trước (BE-70, BE-124). `cursor` là `nextCursor` của trang trước; `unread` chỉ lấy chưa đọc. */
export async function getNotifications(options: { unread?: boolean; cursor?: string; limit?: number } = {}): Promise<NotificationPage> {
  const { unread, cursor, limit = 30 } = options;
  return ok(await serverApi().GET("/api/v1/notifications", { params: { query: { unread: unread || undefined, cursor: cursor || undefined, limit } } }));
}
