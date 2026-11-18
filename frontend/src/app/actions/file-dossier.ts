"use server";

import { revalidatePath } from "next/cache";
import { findDossiers, type DossierListItem } from "@/features/dossier/dossier-data";
import { getInbox, READY_ONLY } from "@/features/intake/inbox-data";
import { isProcedureId } from "@/features/procedure/procedure-filter";
import type { ActionResult } from "@/lib/action-result";
import { ok, serverApi } from "@/lib/api/server";
import { runAction } from "@/lib/actions";
import { log } from "@/lib/log";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIRECTIONS = ["incoming", "outgoing", "internal"] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** Ô "tìm hồ sơ khác" ở bước xếp hồ sơ. Truy vấn ngắn hơn 2 ký tự không gửi, tránh trả về cả danh sách. */
export async function searchDossiers(q: string): Promise<ActionResult<DossierListItem[]>> {
  return runAction("file_search", async () => {
    const text = q.trim().slice(0, 100);
    return text.length < 2 ? [] : findDossiers(text);
  });
}

/** Tạo hồ sơ ngay trong luồng tiếp nhận. Mã hồ sơ do hệ thống cấp (BE-61). */
export async function createDossierInline(input: { title: string; workGroupCode: string; notes: string; procedureId?: string | null }): Promise<ActionResult<DossierListItem>> {
  return runAction("file_create_dossier", async () => {
    if (input.procedureId && !isProcedureId(input.procedureId)) throw new TypeError("Mã thủ tục không hợp lệ.");
    const created = ok(
      await serverApi().POST("/api/v1/dossiers", {
        body: { title: input.title.trim(), workGroupCode: input.workGroupCode, notes: input.notes.trim() || null, workflowCode: null, procedureId: input.procedureId || null, accessLevel: null, internalDueOn: null, creatorOrganizationName: null, year: null },
      }),
    );
    log.info("dossier_created_inline", { dossierId: created.id });
    return {
      id: created.id, code: created.code, title: created.title, status: created.status, statusLabel: created.statusLabel,
      workGroupCode: created.workGroupCode, workGroupTitle: created.workGroupTitle, departmentCode: created.departmentCode,
      assigneeName: created.assigneeName, dueOn: created.dueOn, updatedAt: created.updatedAt,
      documentCount: created.documents.length, verifiedCount: 0, version: created.version,
    };
  });
}

export type FileResult = { dossierId: string; dossierCode: string | null; nextDocumentId: string | null };

/**
 * Xếp giấy tờ vào hồ sơ (BE-62). `openNext`: trả luôn mã PDF đã đọc xong kế tiếp trong hộp tiếp nhận
 * để giao diện chuyển thẳng sang đối chiếu, không quay về danh sách.
 */
export async function fileDocument(input: { documentId: string; dossierId: string; dossierCode: string | null; direction: Direction | null; openNext: boolean; procedureComponentId?: string | null }): Promise<ActionResult<FileResult>> {
  return runAction("file_document", async () => {
    if (!UUID.test(input.documentId) || !UUID.test(input.dossierId)) throw new TypeError("Mã không hợp lệ.");
    if (input.direction && !DIRECTIONS.includes(input.direction)) throw new TypeError("Chiều luân chuyển không hợp lệ.");
    if (input.procedureComponentId && !UUID.test(input.procedureComponentId)) throw new TypeError("Mã thành phần không hợp lệ.");
    ok(await serverApi().POST("/api/v1/dossiers/{id}/documents", { params: { path: { id: input.dossierId } }, body: { documentId: input.documentId, direction: input.direction, procedureComponentId: input.procedureComponentId || null } }));
    log.info("document_filed", { documentId: input.documentId, dossierId: input.dossierId });
    revalidatePath("/tiep-nhan");
    let nextDocumentId: string | null = null;
    if (input.openNext) {
      // Việc tìm PDF kế tiếp chỉ để tiện; lỗi ở đây không được làm hỏng việc đã xếp xong.
      try {
        const inbox = await getInbox("inbox", undefined, 50, READY_ONLY);
        nextDocumentId = inbox.items.find((i) => i.documentId !== input.documentId)?.documentId ?? null;
      } catch {
        nextDocumentId = null;
      }
    }
    return { dossierId: input.dossierId, dossierCode: input.dossierCode, nextDocumentId };
  });
}

export type DossierComponentChoice = { id: string; name: string; required: boolean; section: string; filled: number };
export type DossierComponents = { procedureName: string; components: DossierComponentChoice[] };

/**
 * Các thành phần của thủ tục mà hồ sơ đang làm theo (BE-64), để chọn giấy tờ đang xếp đáp ứng thành phần nào (FE-24).
 * Trả `null` khi hồ sơ không theo thủ tục nào: bước xếp hồ sơ không hiện ô chọn thành phần.
 */
export async function loadDossierComponents(dossierId: string): Promise<ActionResult<DossierComponents | null>> {
  return runAction("file_components", async () => {
    if (!UUID.test(dossierId)) throw new TypeError("Mã không hợp lệ.");
    const checklist = ok(await serverApi().GET("/api/v1/dossiers/{id}/checklist", { params: { path: { id: dossierId } } }));
    if (!checklist.components || checklist.components.length === 0) return null;
    return {
      procedureName: checklist.procedureName ?? "thủ tục",
      components: [...checklist.components].sort((a, b) => a.position - b.position).map((c) => ({
        id: c.componentId, name: c.name, required: c.required, section: c.section, filled: c.documentIds.length,
      })),
    };
  });
}
