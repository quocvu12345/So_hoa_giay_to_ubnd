import "server-only";
import type { components } from "@/api/schema";
import { ok, serverApi } from "@/lib/api/server";
import { PAGE_SIZE, type ProcedureFilter } from "./procedure-filter";

export type ProcedureListItem = components["schemas"]["ProcedureListItem"];
export type ProcedureDetail = components["schemas"]["ProcedureDetail"];
export type ProcedureComponent = components["schemas"]["ComponentDto"];
export type ProcedureTemplate = components["schemas"]["TemplateDto"];

/** Tìm thủ tục (BE-33, BE-122): tên không dấu hoặc mã, lĩnh vực, cấp thực hiện (không phân biệt hoa thường), tình trạng hiệu lực. */
export async function searchProcedures(filter: ProcedureFilter) {
  return ok(
    await serverApi().GET("/api/v1/procedures", {
      params: { query: { q: filter.q || undefined, domain: filter.domain || undefined, level: filter.level || undefined, status: filter.status || undefined, page: filter.page, pageSize: PAGE_SIZE } },
    }),
  );
}

export async function getProcedureDomains() {
  return ok(await serverApi().GET("/api/v1/procedures/domains"));
}

export async function getProcedureLevels() {
  return ok(await serverApi().GET("/api/v1/procedures/levels"));
}

export async function getProcedure(id: string): Promise<ProcedureDetail> {
  return ok(await serverApi().GET("/api/v1/procedures/{id}", { params: { path: { id } } }));
}
