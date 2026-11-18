"use server";

import { revalidatePath } from "next/cache";
import { UUID } from "@/features/dossier/dossier-data";
import { getAiJobs, type AdminJobRow, type Setting } from "@/features/ops/ops-data";
import { JOB_FILTERS, parseSettingValue, type JobFilter } from "@/features/ops/ops-rules";
import type { ActionResult } from "@/lib/action-result";
import { ok, serverApi } from "@/lib/api/server";
import { runAction } from "@/lib/actions";
import { log } from "@/lib/log";

function assertId(id: string) {
  if (!UUID.test(id)) throw new TypeError("Mã không hợp lệ.");
}

function refresh() {
  revalidatePath("/quan-tri/van-hanh");
}

/** Hủy việc AI đang chờ hoặc đang chạy (BE-120). Worker dừng sau trang hiện tại. Việc vừa kết thúc thì API trả 409. */
export async function cancelAiJob(jobId: string): Promise<ActionResult<AdminJobRow>> {
  return runAction("ai_job_cancel", async () => {
    assertId(jobId);
    const row = ok(await serverApi().POST("/api/v1/admin/ai/jobs/{id}/cancel", { params: { path: { id: jobId } } }));
    log.info("ai_job_cancelled", { jobId });
    refresh();
    return row;
  });
}

/** Chạy lại việc đã lỗi hoặc đã hủy bằng một việc MỚI (việc cũ giữ làm lịch sử). 409 kèm lý do khi tệp đã hủy, đang có việc khác hoặc đã có lần đọc mới hơn. */
export async function retryAiJob(jobId: string): Promise<ActionResult<AdminJobRow>> {
  return runAction("ai_job_retry", async () => {
    assertId(jobId);
    const row = ok(await serverApi().POST("/api/v1/admin/ai/jobs/{id}/retry", { params: { path: { id: jobId } } }));
    log.info("ai_job_retried", { jobId, newJobId: row.id });
    refresh();
    return row;
  });
}

/** Trang cũ hơn của danh sách việc AI. */
export async function loadMoreAiJobs(filter: JobFilter, cursor: string): Promise<ActionResult<{ items: AdminJobRow[]; nextCursor: string | null }>> {
  return runAction("ai_jobs_more", async () => {
    if (!JOB_FILTERS.some((f) => f.value === filter)) throw new TypeError("Bộ lọc không hợp lệ.");
    if (!cursor || cursor.length > 200) throw new TypeError("Con trỏ không hợp lệ.");
    const page = await getAiJobs(filter, cursor);
    return { items: page.items, nextCursor: page.nextCursor ?? null };
  });
}

/** Ghi nhận đã diễn tập khôi phục từ một bản sao lưu (BE-89). */
export async function recordRestoreTest(backupId: string, note: string): Promise<ActionResult> {
  return runAction("backup_restore_test", async () => {
    assertId(backupId);
    ok(await serverApi().POST("/api/v1/admin/backups/{id}/restore-test", { params: { path: { id: backupId } }, body: { testedAt: null, note: note.trim() || null } }));
    refresh();
  });
}

export type NewBackup = { kind: string; status: string; location: string; note: string };

/** Quản trị ghi tay kết quả một lần sao lưu (script dùng khóa máy riêng). */
export async function recordBackup(input: NewBackup): Promise<ActionResult> {
  return runAction("backup_record", async () => {
    if (!["database", "files", "config"].includes(input.kind)) throw new TypeError("Loại sao lưu không hợp lệ.");
    if (!["succeeded", "failed"].includes(input.status)) throw new TypeError("Kết quả không hợp lệ.");
    const now = new Date().toISOString();
    ok(await serverApi().POST("/api/v1/admin/backups", { body: { kind: input.kind, status: input.status, startedAt: now, finishedAt: now, byteSize: null, location: input.location.trim() || null, restoreTestedAt: null, note: input.note.trim() || null } }));
    refresh();
  });
}

/** Sửa giá trị một cài đặt hệ thống (BE-89). Giá trị là JSON; API từ chối khóa chứa bí mật và kiểu sai của cài đặt SQL đọc trực tiếp. */
export async function updateSetting(key: string, valueText: string): Promise<ActionResult<Setting>> {
  return runAction("setting_update", async () => {
    const parsed = parseSettingValue(key, valueText);
    if (!parsed.ok) throw new TypeError(parsed.error);
    const setting = ok(await serverApi().PATCH("/api/v1/admin/settings", { body: { key, value: parsed.value as never } }));
    log.info("setting_updated", { key });
    refresh();
    return setting;
  });
}
