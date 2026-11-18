import "server-only";
import type { components } from "@/api/schema";
import { ok, serverApi } from "@/lib/api/server";

export type ExportPackage = components["schemas"]["ExportDto"];

/** Các gói xuất gần đây của chính người dùng, mới nhất trước, tối đa 20 (BE-86). */
export async function getExports(): Promise<ExportPackage[]> {
  return ok(await serverApi().GET("/api/v1/exports"));
}
