import "server-only";
import type { components } from "@/api/schema";
import { ok, serverApi } from "@/lib/api/server";

export type WorkspaceSummary = components["schemas"]["WorkspaceSummary"];
export type QueueItem = components["schemas"]["QueueItem"];

/** Số liệu cho menu và màn Việc của tôi (BE-69). */
export async function getSummary(): Promise<WorkspaceSummary> {
  return ok(await serverApi().GET("/api/v1/workspace/summary"));
}

/** Hàng việc theo phân công đang dùng, nhóm theo loại (assigned, to_review, to_decide, to_archive). API trả hết, không phân trang. */
export async function getQueues(): Promise<Record<string, QueueItem[]>> {
  const workspace = ok(await serverApi().GET("/api/v1/workspace/queue"));
  return workspace.queues as Record<string, QueueItem[]>;
}
