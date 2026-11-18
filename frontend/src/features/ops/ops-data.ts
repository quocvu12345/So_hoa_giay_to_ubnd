import "server-only";
import type { components } from "@/api/schema";
import { ok, serverApi } from "@/lib/api/server";
import { jobStatusParam, type JobFilter } from "./ops-rules";

export type AiStatus = components["schemas"]["AiStatus"];
export type AdminJobRow = components["schemas"]["AdminJobRow"];
export type BackupRun = components["schemas"]["BackupDto"];
export type BackupStatus = components["schemas"]["BackupStatus"];
export type Setting = components["schemas"]["SettingDto"];

/** Hàng đợi AI, worker, mô hình (BE-88, BE-99, BE-100). Cần `processing.manage`. */
export async function getAiStatus(): Promise<AiStatus> {
  return ok(await serverApi().GET("/api/v1/admin/ai/status"));
}

/** Việc AI mới nhất trước (BE-120). Không lọc theo phạm vi giấy tờ: chỉ có tên tệp, không có nội dung. */
export async function getAiJobs(filter: JobFilter, cursor?: string, limit = 30) {
  return ok(await serverApi().GET("/api/v1/admin/ai/jobs", { params: { query: { status: jobStatusParam(filter), cursor: cursor || undefined, limit } } }));
}

export async function getBackups(): Promise<BackupRun[]> {
  return ok(await serverApi().GET("/api/v1/admin/backups"));
}

export async function getBackupStatus(): Promise<BackupStatus> {
  return ok(await serverApi().GET("/api/v1/admin/backups/status"));
}

export async function getSettings(): Promise<Setting[]> {
  return ok(await serverApi().GET("/api/v1/admin/settings"));
}
