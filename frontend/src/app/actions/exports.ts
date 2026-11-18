"use server";

import { revalidatePath } from "next/cache";
import type { ExportPackage } from "@/features/export/export-data";
import { type ExportForm, toExportRequest, validateExportForm } from "@/features/export/export-rules";
import type { ActionResult } from "@/lib/action-result";
import { ok, serverApi } from "@/lib/api/server";
import { runAction } from "@/lib/actions";
import { log } from "@/lib/log";

/**
 * Tạo gói xuất bàn giao (BE-86). API chốt danh sách hồ sơ trong phạm vi của người yêu cầu rồi đóng ZIP nền; theo dõi qua SSE `export.*`.
 * 422 `export_empty` khi không hồ sơ nào khớp, `export_too_large` khi quá 2.000 hồ sơ.
 */
export async function createExport(form: ExportForm): Promise<ActionResult<ExportPackage>> {
  return runAction("export_create", async () => {
    if (Object.keys(validateExportForm(form)).length > 0) throw new TypeError("Điều kiện xuất không hợp lệ.");
    const created = ok(await serverApi().POST("/api/v1/exports", { body: toExportRequest(form) }));
    log.info("export_created", { exportId: created.id, total: created.totalItems });
    revalidatePath("/xuat-du-lieu");
    return created;
  });
}
