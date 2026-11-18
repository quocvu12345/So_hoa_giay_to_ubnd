"use server";

import { revalidatePath } from "next/cache";
import { UUID } from "@/features/dossier/dossier-data";
import { LOCATION_CODE, childKinds } from "@/features/storage/location-rules";
import type { LocationNode } from "@/features/storage/storage-data";
import type { ActionResult } from "@/lib/action-result";
import { ok, serverApi } from "@/lib/api/server";
import { runAction } from "@/lib/actions";
import { log } from "@/lib/log";

function refresh(dossierId?: string) {
  revalidatePath("/kho-ban-giay");
  revalidatePath("/kho-ban-giay/[locationId]", "page");
  if (dossierId) {
    revalidatePath(`/ho-so/${dossierId}`, "layout");
    revalidatePath("/ho-so");
  }
}

/** Thêm vị trí (kho › phòng › tủ › kệ › hộp). Cấp con phải sâu hơn cấp cha; mã trùng thì API trả 409; QR dựng từ mã. */
export async function createLocation(input: { parentId: string | null; parentKind: string | null; kind: string; code: string; name: string; capacityNote: string }): Promise<ActionResult<LocationNode>> {
  return runAction("storage_create", async () => {
    if (input.parentId && !UUID.test(input.parentId)) throw new TypeError("Mã vị trí cha không hợp lệ.");
    if (!(childKinds(input.parentKind) as string[]).includes(input.kind)) throw new TypeError("Cấp vị trí không hợp lệ.");
    if (!LOCATION_CODE.test(input.code.trim())) throw new TypeError("Mã vị trí không hợp lệ.");
    const created = ok(await serverApi().POST("/api/v1/storage-locations", { body: { parentId: input.parentId, kind: input.kind, code: input.code.trim(), name: input.name.trim(), capacityNote: input.capacityNote.trim() || null } }));
    log.info("storage_location_created", { id: created.id, kind: created.kind });
    refresh();
    return created;
  });
}

/** Sửa tên, ghi chú sức chứa hoặc ngừng dùng. Ngừng dùng bị chặn (409) khi còn hồ sơ hoặc vị trí con đang dùng. */
export async function updateLocation(id: string, input: { name?: string; capacityNote?: string; active?: boolean }): Promise<ActionResult<LocationNode>> {
  return runAction("storage_update", async () => {
    if (!UUID.test(id)) throw new TypeError("Mã không hợp lệ.");
    const updated = ok(await serverApi().PATCH("/api/v1/storage-locations/{id}", { params: { path: { id } }, body: { name: input.name?.trim() ?? null, capacityNote: input.capacityNote ?? null, active: input.active ?? null } }));
    log.info("storage_location_updated", { id, active: input.active });
    refresh();
    return updated;
  });
}

/** Đặt hoặc chuyển vị trí bản giấy của hồ sơ (chỉ hộp hoặc kệ); `locationId = null` là gỡ vị trí. Lịch sử chuyển được ghi kèm ghi chú. */
export async function placeDossier(dossierId: string, locationId: string | null, note: string): Promise<ActionResult<{ path: string | null }>> {
  return runAction("storage_place_dossier", async () => {
    if (!UUID.test(dossierId) || (locationId && !UUID.test(locationId))) throw new TypeError("Mã không hợp lệ.");
    const result = ok(await serverApi().PUT("/api/v1/dossiers/{id}/location", { params: { path: { id: dossierId } }, body: { locationId, note: note.trim() || null } }));
    log.info("dossier_placed", { dossierId, locationId });
    refresh(dossierId);
    return { path: result.path ?? null };
  });
}
