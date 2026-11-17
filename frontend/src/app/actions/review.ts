"use server";

import { revalidatePath } from "next/cache";
import { getDocumentTypes } from "@/features/review/review-data";
import type { DocumentTypeInfo, FieldEdit, MetaPayload, ReviewData } from "@/features/review/review-state";
import type { ActionResult } from "@/lib/action-result";
import { ok, serverApi } from "@/lib/api/server";
import { runAction } from "@/lib/actions";
import { log } from "@/lib/log";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE = /^[A-Za-z0-9._-]{1,64}$/;

function assertId(id: string) {
  if (!UUID.test(id)) throw new TypeError("Mã không hợp lệ.");
}

/** Loại giấy tờ của một nhóm, để người dùng chọn khi đổi loại (BE-31). */
export async function loadDocumentTypes(groupCode: string): Promise<ActionResult<DocumentTypeInfo[]>> {
  return runAction("review_types", async () => {
    if (!CODE.test(groupCode)) throw new TypeError("Mã nhóm không hợp lệ.");
    return getDocumentTypes(groupCode);
  });
}

/** Chấp nhận gợi ý hoặc đổi nhóm, loại giấy tờ (BE-48). Trả lại dữ liệu đối chiếu mới vì bộ trường đổi theo loại. */
export async function applyClassification(documentId: string, workGroupCode: string, documentTypeCode: string): Promise<ActionResult<ReviewData>> {
  return runAction("review_classify", async () => {
    assertId(documentId);
    if (!CODE.test(workGroupCode) || !CODE.test(documentTypeCode)) throw new TypeError("Mã nhóm hoặc loại không hợp lệ.");
    return ok(await serverApi().PUT("/api/v1/documents/{id}/classification", { params: { path: { id: documentId } }, body: { workGroupCode, documentTypeCode } }));
  });
}

export type ConfirmReviewInput = {
  documentId: string;
  /** Có khi loại giấy tờ chưa được xác nhận: chấp nhận gợi ý của AI hoặc lựa chọn của người dùng trước khi lưu trường. */
  classification?: { workGroupCode: string; documentTypeCode: string };
  fields: FieldEdit[];
  meta: MetaPayload;
};

/**
 * Xác nhận đối chiếu: loại giấy tờ (nếu chưa) → các trường → thông tin đầu văn bản (kèm phiên bản mới nhất) → đánh dấu đã đối chiếu.
 * Thứ tự quan trọng: sửa trường hoặc đầu văn bản đều đặt lại trạng thái "đã đối chiếu", nên bước cuối cùng luôn là xác nhận.
 * Lỗi giữa chừng thì các bước trước đã lưu; người dùng sửa theo thông báo rồi bấm lại, không mất dữ liệu.
 */
export async function confirmReview(input: ConfirmReviewInput): Promise<ActionResult<ReviewData>> {
  return runAction("review_confirm", async () => {
    assertId(input.documentId);
    const api = serverApi();
    const path = { id: input.documentId };
    let data: ReviewData | undefined;
    if (input.classification) {
      data = ok(await api.PUT("/api/v1/documents/{id}/classification", { params: { path }, body: input.classification }));
    }
    data = ok(await api.PATCH("/api/v1/documents/{id}/fields", { params: { path }, body: { fields: input.fields } }));
    data = ok(await api.PUT("/api/v1/documents/{id}/metadata", { params: { path }, body: { version: data.document.version, ...input.meta } }));
    data = ok(await api.POST("/api/v1/documents/{id}/verify", { params: { path } }));
    log.info("review_confirmed", { documentId: input.documentId, fields: input.fields.length });
    revalidatePath("/tiep-nhan");
    return data;
  });
}

/** Đọc lại một trang của giấy tờ (BE-44). Chạy nền: tiến độ về qua SSE. */
export async function retryPage(jobId: string, page: number): Promise<ActionResult> {
  return runAction("review_retry_page", async () => {
    assertId(jobId);
    if (!Number.isInteger(page) || page < 1) throw new TypeError("Số trang không hợp lệ.");
    ok(await serverApi().POST("/api/v1/jobs/{id}/pages/{page}/retry", { params: { path: { id: jobId, page } } }));
  });
}
