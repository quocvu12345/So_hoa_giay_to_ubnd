"use server";

import { revalidatePath } from "next/cache";
import type { Submission } from "@/features/archive/archive-data";
import { MAX_DOSSIERS, MAX_NOTE, validateReturn } from "@/features/archive/archive-rules";
import { UUID } from "@/features/dossier/dossier-data";
import type { ActionResult } from "@/lib/action-result";
import { ok, serverApi } from "@/lib/api/server";
import { runAction } from "@/lib/actions";
import { log } from "@/lib/log";

function assertId(id: string) {
  if (!UUID.test(id)) throw new TypeError("Mã không hợp lệ.");
}

function refresh(id?: string) {
  revalidatePath("/nop-luu");
  revalidatePath("/ho-so");
  revalidatePath("/viec-cua-toi");
  if (id) revalidatePath(`/nop-luu/${id}`);
}

/**
 * Gom hồ sơ chờ nộp lưu thành một đợt (BE-84). Hồ sơ chưa ở bước chờ nộp lưu hoặc đã nằm trong đợt khác chưa xong thì API trả 422 `archive_invalid`
 * kèm danh sách từng hồ sơ ở `details`; không tạo gì.
 */
export async function createSubmission(dossierIds: string[], note: string): Promise<ActionResult<Submission>> {
  return runAction("archive_create", async () => {
    if (dossierIds.length === 0 || dossierIds.length > MAX_DOSSIERS) throw new TypeError("Một đợt có từ 1 đến 200 hồ sơ.");
    dossierIds.forEach(assertId);
    if (note.length > MAX_NOTE) throw new TypeError("Ghi chú quá dài.");
    const submission = ok(await serverApi().POST("/api/v1/archive-submissions", { body: { dossierIds, note: note.trim() || null } }));
    log.info("archive_created", { submissionId: submission.id, dossiers: dossierIds.length });
    refresh(submission.id);
    return submission;
  });
}

export async function submitSubmission(id: string): Promise<ActionResult<Submission>> {
  return runAction("archive_submit", async () => {
    assertId(id);
    const submission = ok(await serverApi().POST("/api/v1/archive-submissions/{id}/submit", { params: { path: { id } } }));
    log.info("archive_submitted", { submissionId: id });
    refresh(id);
    return submission;
  });
}

/** Xóa đợt đang soạn: các hồ sơ được giải phóng để gom vào đợt khác. */
export async function deleteSubmission(id: string): Promise<ActionResult> {
  return runAction("archive_delete", async () => {
    assertId(id);
    ok(await serverApi().DELETE("/api/v1/archive-submissions/{id}", { params: { path: { id } } }));
    // Không gọi revalidatePath: sau Server Action, Next dựng lại TRANG HIỆN TẠI (chi tiết của đợt vừa xóa) và API trả 404 trước khi giao diện
    // kịp chuyển về danh sách. Trang danh sách là trang động, không bị bộ nhớ đệm phía trình duyệt giữ nên mở lại là có dữ liệu mới.
  });
}

/**
 * Tiếp nhận cả đợt trong một giao dịch (BE-84). Chỉ cần một hồ sơ lỗi là không hồ sơ nào đổi trạng thái; API trả 422 `archive_issues`
 * kèm lỗi từng hồ sơ ở `details` để sửa rồi tiếp nhận lại hoặc trả lại đợt.
 */
export async function receiveSubmission(id: string): Promise<ActionResult<Submission>> {
  return runAction("archive_receive", async () => {
    assertId(id);
    const submission = ok(await serverApi().POST("/api/v1/archive-submissions/{id}/receive", { params: { path: { id } } }));
    log.info("archive_received", { submissionId: id });
    refresh(id);
    return submission;
  });
}

/** Trả lại đợt đã nộp kèm lý do và (tùy chọn) lỗi từng hồ sơ. */
export async function returnSubmission(id: string, note: string, issues: { dossierId: string; note: string }[]): Promise<ActionResult<Submission>> {
  return runAction("archive_return", async () => {
    assertId(id);
    issues.forEach((i) => assertId(i.dossierId));
    if (Object.keys(validateReturn(note, issues)).length > 0) throw new TypeError("Lý do trả lại chưa hợp lệ.");
    const submission = ok(await serverApi().POST("/api/v1/archive-submissions/{id}/return", { params: { path: { id } }, body: { note: note.trim(), issues } }));
    log.info("archive_returned", { submissionId: id, issues: issues.length });
    refresh(id);
    return submission;
  });
}
