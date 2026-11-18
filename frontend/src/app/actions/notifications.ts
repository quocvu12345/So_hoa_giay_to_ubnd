"use server";

import { revalidatePath } from "next/cache";
import { getNotifications, type NotificationPage } from "@/features/notifications/notification-data";
import { UUID } from "@/features/dossier/dossier-data";
import type { ActionResult } from "@/lib/action-result";
import { ok, serverApi } from "@/lib/api/server";
import { runAction } from "@/lib/actions";

/** Chuông và số "chưa đọc" nằm ở khung chung, nên đánh dấu xong phải làm mới cả khung. */
function refresh() {
  revalidatePath("/thong-bao");
  revalidatePath("/", "layout");
}

/** Đánh dấu một thông báo đã đọc (BE-70). Chỉ của chính mình; thông báo của người khác API trả 404. */
export async function markNotificationRead(id: string): Promise<ActionResult> {
  return runAction("notification_read", async () => {
    if (!UUID.test(id)) throw new TypeError("Mã không hợp lệ.");
    ok(await serverApi().POST("/api/v1/notifications/{id}/read", { params: { path: { id } } }));
    refresh();
  });
}

export async function markAllNotificationsRead(): Promise<ActionResult<{ updated: number }>> {
  return runAction("notification_read_all", async () => {
    const result = ok(await serverApi().POST("/api/v1/notifications/read-all"));
    refresh();
    return { updated: Number((result as { updated?: number } | undefined)?.updated ?? 0) };
  });
}

/** Trang cũ hơn của danh sách (nút "Tải thêm"). */
export async function loadMoreNotifications(cursor: string, unreadOnly: boolean): Promise<ActionResult<NotificationPage>> {
  return runAction("notification_more", async () => {
    if (!cursor || cursor.length > 200) throw new TypeError("Con trỏ không hợp lệ.");
    return getNotifications({ cursor, unread: unreadOnly });
  });
}
