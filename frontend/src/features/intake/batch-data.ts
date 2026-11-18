import "server-only";
import type { components } from "@/api/schema";
import { ok, serverApi } from "@/lib/api/server";

export type BatchSummary = components["schemas"]["BatchSummary"];
export type BatchDetail = components["schemas"]["BatchDetail"];
export type BatchFile = components["schemas"]["BatchFile"];
export type QualityIssue = components["schemas"]["QualityIssueDto"];
export type SuspectPage = components["schemas"]["SuspectPage"];
export type QualityOverview = components["schemas"]["QualityOverview"];

/** Lô quét của cơ quan, mới mở trước (BE-40). */
export async function getBatches(): Promise<BatchSummary[]> {
  return ok(await serverApi().GET("/api/v1/intake/batches"));
}

export async function getBatch(id: string): Promise<BatchDetail> {
  return ok(await serverApi().GET("/api/v1/intake/batches/{id}", { params: { path: { id } } }));
}

/** Lỗi ảnh đã ghi và trang AI nghi ngờ của một lô (BE-53). */
export async function getQuality(batchId: string, status?: string): Promise<QualityOverview> {
  return ok(await serverApi().GET("/api/v1/quality-issues", { params: { query: { batchId, status } } }));
}
