import "server-only";
import { cache } from "react";
import type { components } from "@/api/schema";
import { ok, serverApi } from "@/lib/api/server";

export type DossierListItem = components["schemas"]["DossierListItem"];
export type DossierDetail = components["schemas"]["DossierDetail"];
export type DossierDocument = components["schemas"]["DossierDocumentItem"];
export type Checklist = components["schemas"]["Checklist"];
export type AllowedAction = components["schemas"]["AllowedAction"];
export type HistoryItem = components["schemas"]["HistoryItem"];
export type DossierPage = components["schemas"]["PageOfDossierListItem"];

/** Hồ sơ gợi ý khi xếp một giấy tờ: cùng nhóm, đang chuẩn bị, trong phạm vi, gần đây trước, tối đa 10 (BE-63). */
export async function getSuggestions(documentId: string): Promise<DossierListItem[]> {
  return ok(await serverApi().GET("/api/v1/dossiers/suggestions", { params: { query: { documentId } } }));
}

/** Tìm hồ sơ khác theo mã hoặc tên trong phạm vi của người dùng. */
export async function findDossiers(q: string, limit = 10): Promise<DossierListItem[]> {
  const page = ok(await serverApi().GET("/api/v1/dossiers", { params: { query: { Q: q, Limit: limit } } }));
  return page.items;
}

export type DossierFilter = { q?: string; status?: string; workGroup?: string; department?: string; mine?: boolean; cursor?: string; limit?: number };

/** Danh sách hồ sơ trong phạm vi, phân trang keyset (BE-60). */
export async function listDossiers(filter: DossierFilter): Promise<DossierPage> {
  return ok(
    await serverApi().GET("/api/v1/dossiers", {
      params: {
        query: {
          Q: filter.q || undefined,
          Status: filter.status || undefined,
          WorkGroup: filter.workGroup || undefined,
          Department: filter.department || undefined,
          Mine: filter.mine || undefined,
          Cursor: filter.cursor || undefined,
          Limit: filter.limit ?? 50,
        },
      },
    }),
  );
}

/** Một request chỉ hỏi chi tiết hồ sơ một lần dù khung trang và tab cùng cần (React cache). */
export const getDossier = cache(async (id: string): Promise<DossierDetail> => ok(await serverApi().GET("/api/v1/dossiers/{id}", { params: { path: { id } } })));

export const getChecklist = cache(async (id: string): Promise<Checklist> => ok(await serverApi().GET("/api/v1/dossiers/{id}/checklist", { params: { path: { id } } })));

/** Thao tác được phép ở bước hiện tại với phân công đang dùng (BE-66). Giao diện không tự suy luật chuyển bước. */
export const getActions = cache(async (id: string): Promise<AllowedAction[]> => ok(await serverApi().GET("/api/v1/dossiers/{id}/actions", { params: { path: { id } } })));

export async function getHistory(id: string): Promise<HistoryItem[]> {
  return ok(await serverApi().GET("/api/v1/dossiers/{id}/history", { params: { path: { id } } }));
}

/** Trạng thái hồ sơ còn nhận thêm giấy tờ và còn sửa được (khớp EditableDossierStatuses của API). */
export const ACCEPTING_STATUSES = ["draft", "returned"] as const;
export function acceptsDocuments(status: string): boolean {
  return (ACCEPTING_STATUSES as readonly string[]).includes(status);
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Department = components["schemas"]["DepartmentDto"];

/** Đầu mối (phòng, Ban) của cơ quan, để nhóm các nhóm hồ sơ theo đầu mối. */
export async function getDepartments(organization: string | null): Promise<Department[]> {
  return ok(await serverApi().GET("/api/v1/catalog/departments", { params: { query: organization ? { organization } : {} } }));
}
