"use server";

import { revalidatePath } from "next/cache";
import type { Disposal } from "@/features/disposal/disposal-data";
import { validateReason } from "@/features/disposal/disposal-rules";
import { UUID } from "@/features/dossier/dossier-data";
import { search } from "@/features/search/search-data";
import type { ActionResult } from "@/lib/action-result";
import { ok, serverApi } from "@/lib/api/server";
import { runAction } from "@/lib/actions";
import { log } from "@/lib/log";

function assertId(id: string) {
  if (!UUID.test(id)) throw new TypeError("Mã không hợp lệ.");
}

function refresh() {
  revalidatePath("/de-nghi-huy");
}

/** Đề nghị hủy một hồ sơ đã lưu trữ, hết thời hạn bảo quản đã xác nhận. API kiểm lại mọi điều kiện (đã lưu trữ, đủ năm, không đang được mượn, chưa có đề nghị). */
export async function requestDisposal(dossierId: string, reason: string): Promise<ActionResult<Disposal>> {
  return runAction("disposal_request", async () => {
    assertId(dossierId);
    if (validateReason(reason)) throw new TypeError("Lý do chưa hợp lệ.");
    const created = ok(await serverApi().POST("/api/v1/disposals", { body: { dossierId, reason: reason.trim() } }));
    log.info("disposal_requested", { disposalId: created.id, dossierId });
    refresh();
    return created;
  });
}

/** Phê duyệt kèm văn bản quyết định (giấy tờ đã có trong hệ thống, nằm ngoài hồ sơ bị hủy). Người phê duyệt phải khác người đề nghị. */
export async function approveDisposal(id: string, decisionDocumentId: string, note: string): Promise<ActionResult<Disposal>> {
  return runAction("disposal_approve", async () => {
    assertId(id);
    assertId(decisionDocumentId);
    const approved = ok(await serverApi().POST("/api/v1/disposals/{id}/approve", { params: { path: { id } }, body: { decisionDocumentId, note: note.trim() || null } }));
    log.info("disposal_approved", { disposalId: id });
    refresh();
    return approved;
  });
}

export async function rejectDisposal(id: string, note: string): Promise<ActionResult<Disposal>> {
  return runAction("disposal_reject", async () => {
    assertId(id);
    if (validateReason(note)) throw new TypeError("Lý do chưa hợp lệ.");
    const rejected = ok(await serverApi().POST("/api/v1/disposals/{id}/reject", { params: { path: { id } }, body: { note: note.trim() } }));
    log.info("disposal_rejected", { disposalId: id });
    refresh();
    return rejected;
  });
}

export type ExecuteOutcome = { filesDisposed: number; blobsDeleted: number; documentsKept: number; status: string };

/**
 * Thực hiện hủy đã phê duyệt: xóa nội dung tệp (đường DUY NHẤT xóa tệp), giữ metadata và nhật ký. Trạng thái "đang thực hiện" nghĩa là đã nhận yêu cầu và
 * hệ thống tiếp tục thử lại khi kho tệp sẵn sàng: KHÔNG gửi lại; chỉ coi là xong khi trạng thái là "executed".
 */
export async function executeDisposal(id: string): Promise<ActionResult<ExecuteOutcome>> {
  return runAction("disposal_execute", async () => {
    assertId(id);
    const result = ok(await serverApi().POST("/api/v1/disposals/{id}/execute", { params: { path: { id } } }));
    log.info("disposal_executed", { disposalId: id, status: result.disposal.status });
    refresh();
    return { filesDisposed: Number(result.filesDisposed), blobsDeleted: Number(result.blobsDeleted), documentsKept: Number(result.documentsKept), status: result.disposal.status };
  });
}

export type DocumentChoice = { id: string; title: string; number: string | null; subtitle: string | null; issuedOn: string | null };

/** Tìm văn bản quyết định hủy trong phạm vi người dùng (số ký hiệu hoặc trích yếu, không cần dấu). */
export async function searchDecisionDocuments(q: string): Promise<ActionResult<DocumentChoice[]>> {
  return runAction("disposal_search_document", async () => {
    const text = q.trim();
    if (text.length < 2 || text.length > 200) return [];
    const result = await search({ q: text, kind: "documents", limit: 10 });
    return result.hits.filter((h) => h.kind === "document").map((h) => ({ id: h.id, title: h.title, number: h.number ?? null, subtitle: h.subtitle ?? null, issuedOn: h.issuedOn ?? null }));
  });
}
