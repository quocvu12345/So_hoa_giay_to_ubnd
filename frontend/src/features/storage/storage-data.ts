import "server-only";
import type { components } from "@/api/schema";
import { ok, serverApi } from "@/lib/api/server";

export type LocationNode = components["schemas"]["LocationNode"];

/** Cây vị trí kho (cha trước con, kèm đường dẫn đầy đủ và số hồ sơ đang nằm ở từng vị trí). Chỉ người có `storage.manage`. */
export async function getLocations(includeInactive = false): Promise<LocationNode[]> {
  return ok(await serverApi().GET("/api/v1/storage-locations", { params: { query: { includeInactive } } }));
}

export async function getLocation(id: string): Promise<LocationNode> {
  return ok(await serverApi().GET("/api/v1/storage-locations/{id}", { params: { path: { id } } }));
}

/** Quét mã QR (đầu đọc mã vạch gõ như bàn phím): tìm vị trí theo đúng nội dung mã. Không có thì ném ApiError 404. */
export async function findLocationByQr(payload: string): Promise<LocationNode> {
  return ok(await serverApi().GET("/api/v1/storage-locations/by-qr", { params: { query: { payload } } }));
}
