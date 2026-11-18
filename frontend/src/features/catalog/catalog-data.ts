import "server-only";
import type { components } from "@/api/schema";
import { ok, serverApi } from "@/lib/api/server";

export type WorkGroup = components["schemas"]["WorkGroupDto"];
export type DocType = components["schemas"]["DocumentTypeDto"];
export type FieldDef = components["schemas"]["FieldDto"];
export type RetentionRule = components["schemas"]["RetentionRuleDto"];

/** Mọi nhóm hồ sơ, kể cả đã ngừng dùng (API chỉ trả mục ngừng dùng cho người quản lý danh mục). Không lọc cơ quan: quản trị kỹ thuật không gắn cơ quan. */
export async function getAllGroups(): Promise<WorkGroup[]> {
  return ok(await serverApi().GET("/api/v1/catalog/work-groups", { params: { query: {} } }));
}

/** Loại giấy tờ của một nhóm kèm trường dữ liệu, kể cả loại ngừng dùng. */
export async function getTypes(groupCode: string): Promise<DocType[]> {
  return ok(await serverApi().GET("/api/v1/catalog/work-groups/{code}/document-types", { params: { path: { code: groupCode } } }));
}

export async function getRetentionRules(groupCode: string): Promise<RetentionRule[]> {
  return ok(await serverApi().GET("/api/v1/admin/catalog/retention-rules", { params: { query: { workGroup: groupCode } } }));
}
