"use server";

import { getProcedure, searchProcedures } from "@/features/procedure/procedure-data";
import { isProcedureId, isRetired, LIFECYCLE_LABELS } from "@/features/procedure/procedure-filter";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/lib/actions";

export type ProcedureOption = { id: string; name: string; code: string | null; domain: string | null; level: string | null; status: string; componentCount: number };
export type ProcedureComponentSummary = { id: string; section: string; name: string; required: boolean };
export type ProcedureSummary = { id: string; name: string; code: string | null; components: ProcedureComponentSummary[] };

const MAX_OPTIONS = 10;

/**
 * Tìm thủ tục để chọn khi tạo hồ sơ (FE-27, BE-33): tên không dấu hoặc mã. Thủ tục đã bãi bỏ hoặc thay thế không dùng làm căn cứ mới nên không hiện.
 * Không có chữ tìm thì không gọi API (tránh kéo cả danh mục về khi vừa mở ô).
 */
export async function findProcedureOptions(query: string): Promise<ActionResult<ProcedureOption[]>> {
  return runAction("procedure_find", async () => {
    const q = String(query ?? "").trim().slice(0, 200);
    if (q.length < 2) return [];
    const page = await searchProcedures({ q, domain: "", level: "", status: "", page: 1 });
    return page.items
      .filter((p) => !isRetired(p.lifecycleStatus))
      .slice(0, MAX_OPTIONS)
      .map((p) => ({ id: p.id, name: p.name, code: p.procedureCode ?? null, domain: p.domain ?? null, level: p.executionLevel ?? null, status: LIFECYCLE_LABELS[p.lifecycleStatus] ?? p.lifecycleStatus, componentCount: p.componentCount }));
  });
}

/** Tên, mã và các thành phần của một thủ tục, để hiện "hồ sơ cần những giấy tờ nào" ngay khi chọn thủ tục. */
export async function loadProcedureSummary(id: string): Promise<ActionResult<ProcedureSummary>> {
  return runAction("procedure_summary", async () => {
    if (!isProcedureId(id)) throw new TypeError("Mã thủ tục không hợp lệ.");
    const p = await getProcedure(id);
    if (isRetired(p.lifecycleStatus)) throw new TypeError("Thủ tục này đã bãi bỏ hoặc được thay thế nên không dùng để tạo hồ sơ mới.");
    return {
      id: p.id,
      name: p.name,
      code: p.procedureCode ?? null,
      components: [...p.components].sort((a, b) => a.position - b.position).map((c) => ({ id: c.id, section: c.section, name: c.name, required: c.requiredAsPublished })),
    };
  });
}
