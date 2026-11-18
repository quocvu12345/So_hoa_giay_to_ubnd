import "server-only";
import type { components } from "@/api/schema";
import { ok, serverApi } from "@/lib/api/server";

export type Loan = components["schemas"]["LoanDto"];

/** Khoản mượn: người mượn thấy của mình, người duyệt thấy của cả cơ quan (BE-83). Mới nhất trước, tối đa 300. Lọc theo trạng thái làm ở giao diện. */
export async function getLoans(): Promise<Loan[]> {
  return ok(await serverApi().GET("/api/v1/loans", { params: { query: {} } }));
}
