import "server-only";
import type { components } from "@/api/schema";
import { ok, serverApi } from "@/lib/api/server";

export type SegmentList = components["schemas"]["SegmentList"];
export type SplitResult = components["schemas"]["SplitResult"];

/** Đề xuất tách hiện có (AI hoặc lần soạn trước), số trang và mã tệp nguồn (BE-51). Ngoài phạm vi hoặc không phải của người nạp: 404. */
export async function getSegments(documentId: string): Promise<SegmentList> {
  return ok(await serverApi().GET("/api/v1/documents/{id}/segments", { params: { path: { id: documentId } } }));
}
