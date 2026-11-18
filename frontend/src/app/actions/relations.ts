"use server";

import { revalidatePath } from "next/cache";
import { UUID } from "@/features/dossier/dossier-data";
import { search } from "@/features/search/search-data";
import type { ActionResult } from "@/lib/action-result";
import { ok, serverApi } from "@/lib/api/server";
import { runAction } from "@/lib/actions";
import { log } from "@/lib/log";

const KINDS = ["appendix_of", "replaces", "amends", "responds_to", "related"] as const;

function assertId(id: string) {
  if (!UUID.test(id)) throw new TypeError("Mã không hợp lệ.");
}

/** Thêm liên kết từ văn bản này tới văn bản khác (phụ lục, thay thế, sửa đổi, trả lời, liên quan). API từ chối liên kết tạo vòng (phụ lục, thay thế) và trùng. */
export async function addRelation(documentId: string, toDocumentId: string, relation: string, note: string): Promise<ActionResult> {
  return runAction("relation_add", async () => {
    assertId(documentId);
    assertId(toDocumentId);
    if (!(KINDS as readonly string[]).includes(relation)) throw new TypeError("Loại liên kết không hợp lệ.");
    if (documentId === toDocumentId) throw new TypeError("Không liên kết văn bản với chính nó.");
    ok(await serverApi().POST("/api/v1/documents/{id}/relations", { params: { path: { id: documentId } }, body: { toDocumentId, relation, note: note.trim() || null } }));
    log.info("relation_added", { documentId, relation });
    revalidatePath(`/giay-to/${documentId}`);
  });
}

export async function removeRelation(documentId: string, toDocumentId: string, relation: string): Promise<ActionResult> {
  return runAction("relation_remove", async () => {
    assertId(documentId);
    assertId(toDocumentId);
    if (!(KINDS as readonly string[]).includes(relation)) throw new TypeError("Loại liên kết không hợp lệ.");
    ok(await serverApi().DELETE("/api/v1/documents/{id}/relations/{toId}/{relation}", { params: { path: { id: documentId, toId: toDocumentId, relation } } }));
    log.info("relation_removed", { documentId, relation });
    revalidatePath(`/giay-to/${documentId}`);
  });
}

export type DocumentChoice = { id: string; title: string; number: string | null; subtitle: string | null };

/** Tìm văn bản trong phạm vi để chọn liên kết (số ký hiệu hoặc trích yếu, không cần dấu). */
export async function searchDocumentChoices(q: string): Promise<ActionResult<DocumentChoice[]>> {
  return runAction("relation_search", async () => {
    const text = q.trim();
    if (text.length < 2 || text.length > 200) return [];
    const result = await search({ q: text, kind: "documents", limit: 10 });
    return result.hits.filter((h) => h.kind === "document").map((h) => ({ id: h.id, title: h.title, number: h.number ?? null, subtitle: h.subtitle ?? null }));
  });
}
