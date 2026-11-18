"use server";

import { revalidatePath } from "next/cache";
import type { DocType, FieldDef, RetentionRule, WorkGroup } from "@/features/catalog/catalog-data";
import { GROUP_CODE, VALUE_TYPES, validateLegalReference } from "@/features/catalog/catalog-rules";
import type { ActionResult } from "@/lib/action-result";
import { ok, serverApi } from "@/lib/api/server";
import { runAction } from "@/lib/actions";
import { log } from "@/lib/log";

const CODE = /^[A-Za-z0-9._-]{1,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertCode(code: string) {
  if (!CODE.test(code)) throw new TypeError("Mã không hợp lệ.");
}

/** Danh mục được đọc ở nhiều màn (tiếp nhận, đối chiếu, xếp hồ sơ, tạo hồ sơ): làm mới cả khung để người dùng thấy ngay. */
function refresh() {
  revalidatePath("/quan-tri/danh-muc");
  revalidatePath("/", "layout");
}

const text = (v: string | null | undefined) => (v ?? "").trim();

// ---- nhóm hồ sơ ----
export async function createGroup(input: { code: string; organizationCode: string; departmentCode: string; title: string; responsibility: string; filingRule: string; businessFields: string }): Promise<ActionResult<WorkGroup>> {
  return runAction("catalog_group_create", async () => {
    if (!GROUP_CODE.test(input.code.trim())) throw new TypeError("Mã nhóm không hợp lệ.");
    const created = ok(await serverApi().POST("/api/v1/admin/catalog/work-groups", { body: { code: input.code.trim().toUpperCase(), organizationCode: input.organizationCode, departmentCode: input.departmentCode, title: text(input.title), responsibility: text(input.responsibility), filingRule: text(input.filingRule), businessFields: text(input.businessFields) } }));
    log.info("catalog_group_created", { code: created.code });
    refresh();
    return created;
  });
}

/** Sửa, xác nhận (verificationStatus) hoặc ngừng dùng (active=false) một nhóm. Chỉ trường gửi lên mới đổi. */
export async function updateGroup(code: string, input: { title?: string; responsibility?: string; filingRule?: string; businessFields?: string; verificationStatus?: "proposed" | "confirmed"; active?: boolean }): Promise<ActionResult<WorkGroup>> {
  return runAction("catalog_group_update", async () => {
    assertCode(code);
    const updated = ok(await serverApi().PATCH("/api/v1/admin/catalog/work-groups/{code}", { params: { path: { code } }, body: { title: input.title?.trim() ?? null, responsibility: input.responsibility ?? null, filingRule: input.filingRule ?? null, businessFields: input.businessFields ?? null, verificationStatus: input.verificationStatus ?? null, active: input.active ?? null } }));
    log.info("catalog_group_updated", { code, active: input.active });
    refresh();
    return updated;
  });
}

export async function deleteGroup(code: string): Promise<ActionResult> {
  return runAction("catalog_group_delete", async () => {
    assertCode(code);
    ok(await serverApi().DELETE("/api/v1/admin/catalog/work-groups/{code}", { params: { path: { code } } }));
    log.info("catalog_group_deleted", { code });
    revalidatePath("/", "layout");
  });
}

// ---- loại giấy tờ ----
export async function createType(input: { workGroupCode: string; name: string; documentForm: string; requiredInDossier: boolean; minCount: number | null }): Promise<ActionResult<DocType>> {
  return runAction("catalog_type_create", async () => {
    assertCode(input.workGroupCode);
    const created = ok(await serverApi().POST("/api/v1/admin/catalog/document-types", { body: { workGroupCode: input.workGroupCode, name: input.name.trim(), documentForm: text(input.documentForm) || null, requiredInDossier: input.requiredInDossier, minCount: input.minCount } }));
    log.info("catalog_type_created", { code: created.code });
    refresh();
    return created;
  });
}

export async function updateType(code: string, input: { name?: string; documentForm?: string; requiredInDossier?: boolean; minCount?: number | null; active?: boolean }): Promise<ActionResult<DocType>> {
  return runAction("catalog_type_update", async () => {
    assertCode(code);
    const updated = ok(await serverApi().PATCH("/api/v1/admin/catalog/document-types/{code}", { params: { path: { code } }, body: { name: input.name?.trim() ?? null, documentForm: input.documentForm ?? null, requiredInDossier: input.requiredInDossier ?? null, minCount: input.minCount ?? null, active: input.active ?? null } }));
    log.info("catalog_type_updated", { code, active: input.active });
    refresh();
    return updated;
  });
}

export async function deleteType(code: string): Promise<ActionResult> {
  return runAction("catalog_type_delete", async () => {
    assertCode(code);
    ok(await serverApi().DELETE("/api/v1/admin/catalog/document-types/{code}", { params: { path: { code } } }));
    log.info("catalog_type_deleted", { code });
    refresh();
  });
}

// ---- trường dữ liệu ----
export type FieldInput = { label: string; valueType: string; requiredForReview: boolean; isKeyField: boolean; fieldGroup: string; validationPattern: string };

export async function createField(documentTypeCode: string, input: FieldInput): Promise<ActionResult<FieldDef>> {
  return runAction("catalog_field_create", async () => {
    assertCode(documentTypeCode);
    if (!VALUE_TYPES.some((t) => t.value === input.valueType)) throw new TypeError("Kiểu giá trị không hợp lệ.");
    const created = ok(await serverApi().POST("/api/v1/admin/catalog/field-definitions", { body: { documentTypeCode, label: input.label.trim(), valueType: input.valueType, requiredForReview: input.requiredForReview, isKeyField: input.isKeyField, fieldGroup: text(input.fieldGroup) || null, validationPattern: text(input.validationPattern) || null } }));
    log.info("catalog_field_created", { code: created.code });
    refresh();
    return created;
  });
}

export async function updateField(code: string, input: FieldInput): Promise<ActionResult<FieldDef>> {
  return runAction("catalog_field_update", async () => {
    assertCode(code);
    const updated = ok(await serverApi().PATCH("/api/v1/admin/catalog/field-definitions/{code}", { params: { path: { code } }, body: { label: input.label.trim(), valueType: input.valueType, requiredForReview: input.requiredForReview, isKeyField: input.isKeyField, fieldGroup: text(input.fieldGroup) || null, validationPattern: text(input.validationPattern) || null } }));
    log.info("catalog_field_updated", { code });
    refresh();
    return updated;
  });
}

export async function deleteField(code: string): Promise<ActionResult> {
  return runAction("catalog_field_delete", async () => {
    assertCode(code);
    ok(await serverApi().DELETE("/api/v1/admin/catalog/field-definitions/{code}", { params: { path: { code } } }));
    log.info("catalog_field_deleted", { code });
    refresh();
  });
}

// ---- thời hạn bảo quản ----
/** Đề xuất thời hạn bảo quản. CHƯA có hiệu lực cho tới khi xác nhận kèm căn cứ pháp lý: hệ thống không tự đặt thời hạn. */
export async function proposeRetention(input: { workGroupCode: string; documentTypeCode: string | null; retentionLabel: string; retentionYears: number | null }): Promise<ActionResult<RetentionRule>> {
  return runAction("catalog_retention_propose", async () => {
    assertCode(input.workGroupCode);
    if (input.documentTypeCode) assertCode(input.documentTypeCode);
    const created = ok(await serverApi().POST("/api/v1/admin/catalog/retention-rules", { body: { workGroupCode: input.workGroupCode, documentTypeCode: input.documentTypeCode, retentionLabel: input.retentionLabel.trim(), retentionYears: input.retentionYears, legalReference: null } }));
    log.info("catalog_retention_proposed", { id: created.id });
    revalidatePath("/quan-tri/danh-muc");
    return created;
  });
}

export async function confirmRetention(id: string, legalReference: string): Promise<ActionResult<RetentionRule>> {
  return runAction("catalog_retention_confirm", async () => {
    if (!UUID.test(id)) throw new TypeError("Mã không hợp lệ.");
    if (validateLegalReference(legalReference)) throw new TypeError("Căn cứ pháp lý quá ngắn.");
    const confirmed = ok(await serverApi().POST("/api/v1/admin/catalog/retention-rules/{id}/confirm", { params: { path: { id } }, body: { legalReference: legalReference.trim() } }));
    log.info("catalog_retention_confirmed", { id });
    revalidatePath("/quan-tri/danh-muc");
    revalidatePath("/de-nghi-huy");
    return confirmed;
  });
}

export async function deleteRetention(id: string): Promise<ActionResult> {
  return runAction("catalog_retention_delete", async () => {
    if (!UUID.test(id)) throw new TypeError("Mã không hợp lệ.");
    ok(await serverApi().DELETE("/api/v1/admin/catalog/retention-rules/{id}", { params: { path: { id } } }));
    revalidatePath("/quan-tri/danh-muc");
  });
}
