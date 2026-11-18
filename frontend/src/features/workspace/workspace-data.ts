import "server-only";
import type { components } from "@/api/schema";
import { ok, serverApi } from "@/lib/api/server";

export type WorkspaceSummary = components["schemas"]["WorkspaceSummary"];
export type QueueItem = components["schemas"]["QueueItem"];
export type LeadershipSummary = components["schemas"]["LeadershipSummary"];

/**
 * Số liệu tổng hợp cho lãnh đạo theo phân công đang dùng (BE-115): Chủ tịch UBND theo phòng, lãnh đạo HĐND theo hoạt động.
 * Chỉ vai trò có `dossier.decide` gọi được; mỗi con số chỉ đếm hồ sơ trong phạm vi phân công.
 */
export async function getLeadership(): Promise<LeadershipSummary> {
  return ok(await serverApi().GET("/api/v1/workspace/leadership"));
}

/** Số liệu cho menu và màn Việc của tôi (BE-69). */
export async function getSummary(): Promise<WorkspaceSummary> {
  return ok(await serverApi().GET("/api/v1/workspace/summary"));
}

/** Hàng việc theo phân công đang dùng, nhóm theo loại (assigned, to_review, to_decide, to_archive). API trả hết, không phân trang. */
export async function getQueues(): Promise<Record<string, QueueItem[]>> {
  const workspace = ok(await serverApi().GET("/api/v1/workspace/queue"));
  return workspace.queues as Record<string, QueueItem[]>;
}
