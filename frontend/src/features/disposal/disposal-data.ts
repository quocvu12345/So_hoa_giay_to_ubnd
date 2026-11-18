import "server-only";
import type { components } from "@/api/schema";
import { ok, serverApi } from "@/lib/api/server";

export type Disposal = components["schemas"]["DisposalDto"];
export type EligibleDossier = components["schemas"]["EligibleDossierDto"];

/** Các đề nghị hủy của cơ quan, mới nhất trước, tối đa 200 (BE-87). Lọc theo trạng thái làm ở giao diện. */
export async function getDisposals(): Promise<Disposal[]> {
  return ok(await serverApi().GET("/api/v1/disposals", { params: { query: {} } }));
}

/** Hồ sơ đã lưu trữ, có quy tắc bảo quản ĐÃ XÁC NHẬN và đã đủ số năm, chưa có đề nghị hủy. Hệ thống không tự đặt thời hạn. */
export async function getEligible(): Promise<EligibleDossier[]> {
  return ok(await serverApi().GET("/api/v1/disposals/eligible"));
}
