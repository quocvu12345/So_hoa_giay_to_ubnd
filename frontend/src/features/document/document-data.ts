import "server-only";
import { cache } from "react";
import type { components } from "@/api/schema";
import { ok, serverApi } from "@/lib/api/server";

export type DocumentDetail = components["schemas"]["DocumentDetail"];
export type Signature = components["schemas"]["SignatureDto"];
export type Relation = components["schemas"]["RelationDto"];
export type DocumentFields = components["schemas"]["DocumentFieldsData"];
export type FileVersion = components["schemas"]["FileVersionDto"];

/**
 * Trường dữ liệu đã đối chiếu, chỉ đọc, cho mọi người có `document.view` (BE-119). Chỉ theo loại giấy tờ đã xác nhận và không kèm giá trị AI gợi ý;
 * cờ `editedFromAi` cho biết người dùng đã đổi hoặc xóa giá trị AI đọc. Ngoài phạm vi trả 404.
 */
export async function getFields(id: string): Promise<DocumentFields> {
  return ok(await serverApi().GET("/api/v1/documents/{id}/fields", { params: { path: { id } } }));
}

/** Một request chỉ hỏi chi tiết giấy tờ một lần. Quyền xem: document.view; ngoài phạm vi trả 404. */
export const getDocument = cache(async (id: string): Promise<DocumentDetail> => ok(await serverApi().GET("/api/v1/documents/{id}", { params: { path: { id } } })));

export async function getRelations(id: string): Promise<Relation[]> {
  return ok(await serverApi().GET("/api/v1/documents/{id}/relations", { params: { path: { id } } }));
}

/** Kết quả kiểm tra kỹ thuật chữ ký số trong PDF. Chỉ là kiểm tra kỹ thuật, không kết luận hiệu lực pháp lý. */
export async function getSignatures(fileId: string): Promise<Signature[]> {
  return ok(await serverApi().GET("/api/v1/files/{id}/signatures", { params: { path: { id: fileId } } }));
}
