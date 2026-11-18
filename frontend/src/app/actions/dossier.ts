"use server";

import { revalidatePath } from "next/cache";
import { getInbox, READY_ONLY } from "@/features/intake/inbox-data";
import type { InboxItem } from "@/features/intake/inbox-data";
import { UUID } from "@/features/dossier/dossier-data";
import { isProcedureId } from "@/features/procedure/procedure-filter";
import type { ActionResult } from "@/lib/action-result";
import { ApiError } from "@/lib/api/problem";
import { ok, serverApi } from "@/lib/api/server";
import { runAction } from "@/lib/actions";
import { log } from "@/lib/log";

const ACTIONS = ["submit", "accept", "escalate", "return", "decide", "archive"] as const;

function assertId(id: string) {
  if (!UUID.test(id)) throw new TypeError("Mã không hợp lệ.");
}

/** Làm mới khung hồ sơ (đầu trang, số giấy tờ, thanh thao tác) và các danh sách liên quan sau khi ghi. */
function refresh(dossierId: string) {
  revalidatePath(`/ho-so/${dossierId}`, "layout");
  revalidatePath("/ho-so");
  revalidatePath("/tiep-nhan");
}

export type TransitionOutcome = { status: string; statusLabel: string; label: string };

/**
 * Chuyển bước hồ sơ (BE-67). Gửi kèm `version` đang xem: hai người bấm cùng lúc thì một người thành công, người kia nhận 409
 * và giao diện báo "hồ sơ vừa thay đổi" rồi tải lại. Ý kiến tối thiểu 10 ký tự khi bước yêu cầu; API kiểm tra lại.
 */
export async function transitionDossier(input: { dossierId: string; action: string; label: string; note: string; version: number }): Promise<ActionResult<TransitionOutcome>> {
  return runAction("dossier_transition", async () => {
    assertId(input.dossierId);
    if (!(ACTIONS as readonly string[]).includes(input.action)) throw new TypeError("Thao tác không hợp lệ.");
    const note = input.note.trim();
    const result = ok(
      await serverApi().POST("/api/v1/dossiers/{id}/transitions", {
        params: { path: { id: input.dossierId } },
        body: { action: input.action, note: note || null, version: input.version },
      }),
    );
    log.info("dossier_transition", { dossierId: input.dossierId, action: input.action, to: result.status });
    refresh(input.dossierId);
    return { status: result.status, statusLabel: result.statusLabel, label: input.label };
  });
}

/** PDF đã đọc xong đang chờ ở hộp tiếp nhận, để thêm vào hồ sơ từ tab Giấy tờ. */
export async function loadReadyInbox(): Promise<ActionResult<InboxItem[]>> {
  return runAction("dossier_ready_inbox", async () => (await getInbox("inbox", undefined, 100, READY_ONLY)).items);
}

export type AddResult = { added: number; failures: { documentId: string; message: string }[] };

/** Thêm nhiều giấy tờ từ hộp tiếp nhận vào hồ sơ (BE-62). Mỗi giấy tờ một lệnh riêng; giấy tờ nào lỗi thì báo riêng, không làm hỏng các giấy tờ khác. */
export async function addDocuments(dossierId: string, documentIds: string[]): Promise<ActionResult<AddResult>> {
  return runAction("dossier_add_documents", async () => {
    assertId(dossierId);
    const api = serverApi();
    let added = 0;
    const failures: AddResult["failures"] = [];
    for (const documentId of documentIds.slice(0, 50)) {
      assertId(documentId);
      try {
        ok(await api.POST("/api/v1/dossiers/{id}/documents", { params: { path: { id: dossierId } }, body: { documentId, direction: "incoming" } }));
        added++;
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        failures.push({ documentId, message: error.message });
      }
    }
    refresh(dossierId);
    return { added, failures };
  });
}

/** Gỡ giấy tờ khỏi hồ sơ; giấy tờ quay về hộp tiếp nhận (BE-62). Chỉ ở bước còn sửa được. */
export async function removeDocument(dossierId: string, documentId: string): Promise<ActionResult> {
  return runAction("dossier_remove_document", async () => {
    assertId(dossierId);
    assertId(documentId);
    ok(await serverApi().DELETE("/api/v1/dossiers/{id}/documents/{documentId}", { params: { path: { id: dossierId, documentId } } }));
    refresh(dossierId);
  });
}

export type Direction = "incoming" | "outgoing" | "internal";

export type PlacementChange = { documentId: string; position?: number; direction?: Direction };

/**
 * Đổi thứ tự hoặc chiều luân chuyển (BE-62). Hai giấy tờ không được cùng một vị trí nên đổi chỗ phải gửi cả hai trong một lệnh.
 * Chỉ ở bước còn sửa được; API từ chối bước khác với 409.
 */
export async function placeDocuments(dossierId: string, changes: PlacementChange[]): Promise<ActionResult> {
  return runAction("dossier_place_documents", async () => {
    assertId(dossierId);
    for (const change of changes) assertId(change.documentId);
    ok(
      await serverApi().PATCH("/api/v1/dossiers/{id}/documents", {
        params: { path: { id: dossierId } },
        body: changes.slice(0, 50).map((c) => ({ documentId: c.documentId, position: c.position ?? null, direction: c.direction ?? null, relationKind: null, clearProcedureComponent: false })),
      }),
    );
    refresh(dossierId);
  });
}

/**
 * Giao người chủ trì và hạn nội bộ (BE-110, assign_dossier). Kiểm tra quyền và phạm vi ở API; người không thuộc danh sách chuyên viên của phòng bị từ chối.
 * Lý do bắt buộc khi đổi sang người khác được kiểm ở giao diện (assign-rules.ts) và ghi vào nhật ký hồ sơ.
 */
export async function assignDossier(dossierId: string, input: { userId: string; dueOn: string; note: string }): Promise<ActionResult> {
  return runAction("dossier_assign", async () => {
    assertId(dossierId);
    assertId(input.userId);
    if (input.dueOn && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueOn)) throw new TypeError("Hạn nội bộ không hợp lệ.");
    ok(
      await serverApi().PUT("/api/v1/dossiers/{id}/assignment", {
        params: { path: { id: dossierId } },
        body: { userId: input.userId, dueOn: input.dueOn || null, note: input.note.trim() || null },
      }),
    );
    log.info("dossier_assigned", { dossierId, userId: input.userId });
    refresh(dossierId);
  });
}

export type DossierFormInput = { title: string; workGroupCode: string; accessLevel: string; internalDueOn: string; notes: string; year: string; creatorOrganizationName: string };

function dossierBody(input: DossierFormInput) {
  const year = input.year.trim() === "" ? null : Number(input.year);
  return {
    title: input.title.trim(),
    accessLevel: input.accessLevel || null,
    internalDueOn: input.internalDueOn || null,
    notes: input.notes.trim() || null,
    year: year !== null && Number.isInteger(year) ? year : null,
    creatorOrganizationName: input.creatorOrganizationName.trim() || null,
  };
}

/** Tạo hồ sơ (BE-61). Mã do hệ thống cấp. `procedureId`: hồ sơ theo thủ tục hành chính (FE-35); API kiểm thành phần bắt buộc khi trình. */
export async function createDossier(input: DossierFormInput, procedureId?: string | null): Promise<ActionResult<{ id: string; code: string }>> {
  return runAction("dossier_create", async () => {
    const body = dossierBody(input);
    if (procedureId && !isProcedureId(procedureId)) throw new TypeError("Mã thủ tục không hợp lệ.");
    const created = ok(await serverApi().POST("/api/v1/dossiers", { body: { ...body, workGroupCode: input.workGroupCode, workflowCode: null, procedureId: procedureId || null } }));
    log.info("dossier_created", { dossierId: created.id });
    revalidatePath("/ho-so");
    return { id: created.id, code: created.code };
  });
}

/** Sửa thông tin hồ sơ, gửi kèm `version`; người khác vừa sửa thì 409 và giao diện cho tải lại (BE-61). */
export async function updateDossier(dossierId: string, version: number, input: DossierFormInput): Promise<ActionResult> {
  return runAction("dossier_update", async () => {
    assertId(dossierId);
    const body = dossierBody(input);
    ok(
      await serverApi().PATCH("/api/v1/dossiers/{id}", {
        params: { path: { id: dossierId } },
        body: { version, title: body.title, notes: body.notes, internalDueOn: body.internalDueOn, accessLevel: body.accessLevel, physicalLocation: null },
      }),
    );
    refresh(dossierId);
  });
}
