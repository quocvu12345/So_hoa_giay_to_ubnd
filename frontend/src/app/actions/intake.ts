"use server";

import { revalidatePath } from "next/cache";
import { getInbox, type InboxPage, type InboxStatus } from "@/features/intake/inbox-data";
import { type ActionResult } from "@/lib/action-result";
import { ok, serverApi } from "@/lib/api/server";
import { runAction } from "@/lib/actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES: readonly InboxStatus[] = ["inbox", "filed", "discarded"];

/** "Tải thêm" của hộp tiếp nhận: `cursor` lấy từ `nextCursor` của lần trước, đổi bộ lọc thì bắt đầu lại không cursor. */
export async function loadMoreInbox(status: InboxStatus, cursor: string): Promise<ActionResult<InboxPage>> {
  return runAction("inbox_more", async () => {
    if (!STATUSES.includes(status)) throw new TypeError("Trạng thái hộp tiếp nhận không hợp lệ.");
    return getInbox(status, cursor);
  });
}

/** Bỏ PDF khỏi hộp tiếp nhận. Hoàn tác được trong 30 ngày (BE-42). */
export async function discardDocument(documentId: string): Promise<ActionResult> {
  return runAction("inbox_discard", async () => {
    if (!UUID.test(documentId)) throw new TypeError("Mã giấy tờ không hợp lệ.");
    ok(await serverApi().POST("/api/v1/intake/documents/{id}/discard", { params: { path: { id: documentId } } }));
    revalidatePath("/tiep-nhan");
  });
}

export async function restoreDocument(documentId: string): Promise<ActionResult> {
  return runAction("inbox_restore", async () => {
    if (!UUID.test(documentId)) throw new TypeError("Mã giấy tờ không hợp lệ.");
    ok(await serverApi().POST("/api/v1/intake/documents/{id}/restore", { params: { path: { id: documentId } } }));
    revalidatePath("/tiep-nhan");
  });
}

/** Hủy đọc PDF đang chờ hoặc đang đọc (dừng sau trang hiện tại). Đọc lại được bằng nút "Đọc lại". Chỉ người tải lên hoặc quản trị hàng đợi. */
export async function cancelReading(jobId: string): Promise<ActionResult> {
  return runAction("inbox_cancel_job", async () => {
    if (!UUID.test(jobId)) throw new TypeError("Mã việc đọc không hợp lệ.");
    ok(await serverApi().POST("/api/v1/jobs/{id}/cancel", { params: { path: { id: jobId } } }));
    revalidatePath("/tiep-nhan");
  });
}
