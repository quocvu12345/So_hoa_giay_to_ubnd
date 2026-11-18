"use server";

import { revalidatePath } from "next/cache";
import type { BatchSummary, QualityIssue } from "@/features/intake/batch-data";
import { type BatchFormInput, ISSUE_TYPES, toBatchRequest, validateBatchForm, validateNote } from "@/features/intake/batch-rules";
import { UUID } from "@/features/dossier/dossier-data";
import type { ActionResult } from "@/lib/action-result";
import { ok, serverApi } from "@/lib/api/server";
import { runAction } from "@/lib/actions";
import { log } from "@/lib/log";

function assertId(id: string) {
  if (!UUID.test(id)) throw new TypeError("Mã không hợp lệ.");
}

function refresh(batchId?: string | null) {
  revalidatePath("/tiep-nhan/lo-quet");
  revalidatePath("/tiep-nhan/tai-len");
  if (batchId) revalidatePath(`/tiep-nhan/lo-quet/${batchId}`);
}

/** Tạo lô quét (BE-40). Chữ nhập đã kiểm ở giao diện; API kiểm lại và trả lỗi theo ô. */
export async function createBatch(input: BatchFormInput): Promise<ActionResult<BatchSummary>> {
  return runAction("batch_create", async () => {
    if (Object.keys(validateBatchForm(input)).length > 0) throw new TypeError("Thông tin lô không hợp lệ.");
    const batch = ok(await serverApi().POST("/api/v1/intake/batches", { body: { organizationCode: null, departmentCode: null, ...toBatchRequest(input) } }));
    log.info("batch_created", { batchId: batch.id, code: batch.code });
    refresh();
    return batch;
  });
}

/**
 * Đóng lô (BE-40, BE-125). Còn lỗi ảnh mở mà không có `acceptNote` thì API trả 409 kèm số lỗi để giao diện cảnh báo;
 * có lý do (từ 10 ký tự) thì mọi lỗi đang mở được chấp nhận bỏ qua và lô đóng trong một lần.
 */
export async function closeBatch(batchId: string, acceptNote?: string): Promise<ActionResult<BatchSummary>> {
  return runAction("batch_close", async () => {
    assertId(batchId);
    const note = acceptNote?.trim();
    if (note && validateNote(note)) throw new TypeError("Lý do quá ngắn.");
    const batch = ok(await serverApi().POST("/api/v1/intake/batches/{id}/close", { params: { path: { id: batchId } }, body: note ? { acceptOpenIssuesNote: note } : undefined }));
    log.info("batch_closed", { batchId, acceptedOpenIssues: Boolean(note) });
    refresh(batchId);
    return batch;
  });
}

/** Đánh dấu một lỗi ảnh đã sửa hoặc chấp nhận bỏ qua (cần lý do, BE-53). */
export async function resolveIssue(issueId: string, batchId: string, status: "fixed" | "wont_fix", note: string): Promise<ActionResult<QualityIssue>> {
  return runAction("issue_resolve", async () => {
    assertId(issueId);
    assertId(batchId);
    if (status !== "fixed" && status !== "wont_fix") throw new TypeError("Trạng thái không hợp lệ.");
    const issue = ok(await serverApi().POST("/api/v1/quality-issues/{id}/resolve", { params: { path: { id: issueId } }, body: { status, note: note.trim() || null } }));
    refresh(batchId);
    return issue;
  });
}

export type NewIssue = { batchId: string; fileId: string | null; pageNo: number | null; issueType: string; severity: string; description: string };

/** Ghi một lỗi ảnh vào lô (trống, mờ, nghiêng, thiếu trang…). */
export async function createIssue(input: NewIssue): Promise<ActionResult<QualityIssue>> {
  return runAction("issue_create", async () => {
    assertId(input.batchId);
    if (input.fileId) assertId(input.fileId);
    if (!(ISSUE_TYPES as readonly string[]).includes(input.issueType)) throw new TypeError("Loại lỗi không hợp lệ.");
    const issue = ok(
      await serverApi().POST("/api/v1/quality-issues", {
        body: { batchId: input.batchId, documentId: null, fileId: input.fileId, pageNo: input.pageNo, issueType: input.issueType, severity: input.severity, description: input.description.trim() || null },
      }),
    );
    refresh(input.batchId);
    return issue;
  });
}

/** Đặt chất lượng một trang. "Cần quét lại" tự mở lỗi và chặn đóng lô; "Đã quét lại" hoặc "Đạt" tự đóng lỗi của trang (BE-53). */
export async function setPageQuality(batchId: string, fileId: string, page: number, status: "ok" | "suspect" | "rescan_required" | "rescanned", note: string) {
  return runAction("page_quality", async () => {
    assertId(batchId);
    assertId(fileId);
    if (!Number.isInteger(page) || page < 1) throw new TypeError("Số trang không hợp lệ.");
    const result = ok(await serverApi().PUT("/api/v1/files/{fileId}/pages/{page}/quality", { params: { path: { fileId, page } }, body: { status, note: note.trim() || null } }));
    refresh(batchId);
    return result;
  });
}
