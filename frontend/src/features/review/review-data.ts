import "server-only";
import type { components } from "@/api/schema";
import { ok, serverApi } from "@/lib/api/server";
import type { DocumentTypeInfo, ReviewData } from "./review-state";

export type WorkGroup = components["schemas"]["WorkGroupDto"];

export async function getReview(documentId: string): Promise<ReviewData> {
  return ok(await serverApi().GET("/api/v1/documents/{id}/review", { params: { path: { id: documentId } } }));
}

/** Nhóm hồ sơ của cơ quan. Không lọc theo đầu mối: AI có thể gợi ý nhóm của đầu mối khác và người dùng cần thấy để chấp nhận hoặc đổi. */
export async function getWorkGroups(organization: string | null): Promise<WorkGroup[]> {
  const groups = ok(await serverApi().GET("/api/v1/catalog/work-groups", { params: { query: organization ? { organization } : {} } }));
  return groups.filter((g) => g.active);
}

export async function getDocumentTypes(groupCode: string): Promise<DocumentTypeInfo[]> {
  const types = ok(await serverApi().GET("/api/v1/catalog/work-groups/{code}/document-types", { params: { path: { code: groupCode } } }));
  return types.filter((t) => t.active);
}
