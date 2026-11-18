"use server";

import { revalidatePath } from "next/cache";
import { getInbox, type InboxPage, type InboxStatus } from "@/features/intake/inbox-data";
import { NO_FILTERS, parseInboxFilters, type InboxFilters } from "@/features/intake/inbox-filter";
import { type ActionResult } from "@/lib/action-result";
import { ApiError } from "@/lib/api/problem";
import { ok, serverApi } from "@/lib/api/server";
import { runAction } from "@/lib/actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES: readonly InboxStatus[] = ["inbox", "filed", "discarded"];

/** "Tải thêm" của hộp tiếp nhận: `cursor` lấy từ `nextCursor` của lần trước, đổi bộ lọc thì bắt đầu lại không cursor. */
export async function loadMoreInbox(status: InboxStatus, cursor: string, filters: InboxFilters = NO_FILTERS): Promise<ActionResult<InboxPage>> {
  return runAction("inbox_more", async () => {
    if (!STATUSES.includes(status)) throw new TypeError("Trạng thái hộp tiếp nhận không hợp lệ.");
    // Bộ lọc đến từ trình duyệt: đi qua bộ đọc để chỉ còn giá trị đúng dạng (không chuyển nguyên văn lên API).
    const safe = parseInboxFilters({ doc: filters.doc, lo: filters.batch ?? undefined, nhom: filters.group ?? undefined, loai: filters.type ?? undefined });
    return getInbox(status, cursor, 50, safe);
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

export type BulkResult = { done: string[]; failures: { documentId: string; message: string }[] };

const MAX_BULK = 100;

/**
 * Bỏ nhiều PDF khỏi hộp tiếp nhận cùng lúc (FE-21). Mỗi PDF một lệnh riêng: PDF nào lỗi (đã xếp vào hồ sơ, không còn quyền…) thì báo riêng,
 * không làm hỏng các PDF khác. Hoàn tác được 30 ngày bằng `restoreMany`.
 */
export async function discardMany(documentIds: string[]): Promise<ActionResult<BulkResult>> {
  return runAction("inbox_discard_many", async () => bulk(documentIds, (id) => serverApi().POST("/api/v1/intake/documents/{id}/discard", { params: { path: { id } } })));
}

/** Hoàn tác `discardMany`: đưa các PDF đã bỏ về hộp tiếp nhận. */
export async function restoreMany(documentIds: string[]): Promise<ActionResult<BulkResult>> {
  return runAction("inbox_restore_many", async () => bulk(documentIds, (id) => serverApi().POST("/api/v1/intake/documents/{id}/restore", { params: { path: { id } } })));
}

async function bulk(documentIds: string[], call: (id: string) => Promise<{ data?: unknown }>): Promise<BulkResult> {
  const ids = [...new Set(documentIds)].slice(0, MAX_BULK);
  if (ids.some((id) => !UUID.test(id))) throw new TypeError("Mã giấy tờ không hợp lệ.");
  const result: BulkResult = { done: [], failures: [] };
  for (const id of ids) {
    try {
      ok(await call(id));
      result.done.push(id);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      result.failures.push({ documentId: id, message: error.message });
    }
  }
  revalidatePath("/tiep-nhan");
  return result;
}

/** Hủy đọc PDF đang chờ hoặc đang đọc (dừng sau trang hiện tại). Đọc lại được bằng nút "Đọc lại". Chỉ người tải lên hoặc quản trị hàng đợi. */
export async function cancelReading(jobId: string): Promise<ActionResult> {
  return runAction("inbox_cancel_job", async () => {
    if (!UUID.test(jobId)) throw new TypeError("Mã việc đọc không hợp lệ.");
    ok(await serverApi().POST("/api/v1/jobs/{id}/cancel", { params: { path: { id: jobId } } }));
    revalidatePath("/tiep-nhan");
  });
}
