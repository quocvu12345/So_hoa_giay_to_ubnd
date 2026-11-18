import "server-only";
import type { components } from "@/api/schema";
import { ok, serverApi } from "@/lib/api/server";

export type SearchResult = components["schemas"]["SearchResult"];
export type SearchHit = components["schemas"]["SearchHit"];

export type SearchFilter = { q: string; kind: "all" | "documents" | "dossiers"; workGroup?: string; form?: string; issuedFrom?: string; issuedTo?: string; issuer?: string; cursor?: string; limit?: number };

/**
 * Tra cứu số ký hiệu (gần đúng), trích yếu, mã hồ sơ, toàn văn OCR (không dấu). Kết quả và số lượng chỉ tính trong phạm vi người dùng (BE-80, BE-105).
 * Phân trang bằng con trỏ (BE-112): `nextCursor` của trang trước truyền vào `cursor`; tổng số không đổi giữa các trang.
 */
export async function search(filter: SearchFilter): Promise<SearchResult> {
  return ok(
    await serverApi().GET("/api/v1/search", {
      params: { query: { Q: filter.q, Kind: filter.kind, WorkGroup: filter.workGroup || undefined, Form: filter.form || undefined, IssuedFrom: filter.issuedFrom || undefined, IssuedTo: filter.issuedTo || undefined, Issuer: filter.issuer || undefined, Cursor: filter.cursor || undefined, Limit: filter.limit ?? 30 } },
    }),
  );
}
