"use server";

import { revalidatePath } from "next/cache";
import { UUID, findDossiers } from "@/features/dossier/dossier-data";
import type { Loan } from "@/features/loan/loan-data";
import { validateDue, validatePurpose, validateRejectNote, todayVietnam } from "@/features/loan/loan-rules";
import type { ActionResult } from "@/lib/action-result";
import { ok, serverApi } from "@/lib/api/server";
import { runAction } from "@/lib/actions";
import { log } from "@/lib/log";

function assertId(id: string) {
  if (!UUID.test(id)) throw new TypeError("Mã không hợp lệ.");
}

function refresh() {
  revalidatePath("/muon-tra");
}

/** Đề nghị mượn bản giấy của một hồ sơ. Một hồ sơ chỉ có một khoản mượn hiệu lực: đang mượn thì API trả 409 `loan_conflict` kèm hạn trả. */
export async function requestLoan(dossierId: string, purpose: string, dueOn: string): Promise<ActionResult<Loan>> {
  return runAction("loan_request", async () => {
    assertId(dossierId);
    if (validatePurpose(purpose) || validateDue(dueOn, todayVietnam())) throw new TypeError("Đề nghị mượn chưa hợp lệ.");
    const loan = ok(await serverApi().POST("/api/v1/loans", { body: { dossierId, purpose: purpose.trim(), dueOn: dueOn || null } }));
    log.info("loan_requested", { loanId: loan.id, dossierId });
    refresh();
    return loan;
  });
}

/** Duyệt: hạn trả từ hôm nay tới tối đa 90 ngày; bỏ trống thì 14 ngày. */
export async function approveLoan(id: string, dueOn: string, note: string): Promise<ActionResult<Loan>> {
  return runAction("loan_approve", async () => {
    assertId(id);
    if (validateDue(dueOn, todayVietnam())) throw new TypeError("Hạn trả không hợp lệ.");
    const loan = ok(await serverApi().POST("/api/v1/loans/{id}/approve", { params: { path: { id } }, body: { dueOn: dueOn || null, note: note.trim() || null } }));
    log.info("loan_approved", { loanId: id });
    refresh();
    return loan;
  });
}

export async function rejectLoan(id: string, note: string): Promise<ActionResult<Loan>> {
  return runAction("loan_reject", async () => {
    assertId(id);
    if (validateRejectNote(note)) throw new TypeError("Lý do chưa hợp lệ.");
    const loan = ok(await serverApi().POST("/api/v1/loans/{id}/reject", { params: { path: { id } }, body: { note: note.trim() } }));
    log.info("loan_rejected", { loanId: id });
    refresh();
    return loan;
  });
}

export async function lendLoan(id: string): Promise<ActionResult<Loan>> {
  return runAction("loan_lend", async () => {
    assertId(id);
    const loan = ok(await serverApi().POST("/api/v1/loans/{id}/lend", { params: { path: { id } } }));
    log.info("loan_lent", { loanId: id });
    refresh();
    return loan;
  });
}

/** Nhận trả hồ sơ, ghi tình trạng khi nhận (nguyên vẹn, thiếu trang…). */
export async function returnLoan(id: string, conditionNote: string): Promise<ActionResult<Loan>> {
  return runAction("loan_return", async () => {
    assertId(id);
    const loan = ok(await serverApi().POST("/api/v1/loans/{id}/return", { params: { path: { id } }, body: { conditionNote: conditionNote.trim() || null } }));
    log.info("loan_returned", { loanId: id });
    refresh();
    return loan;
  });
}

export type DossierChoice = { id: string; code: string; title: string; statusLabel: string };

/** Tìm hồ sơ trong phạm vi để chọn mượn (mã hoặc tên, không cần dấu). */
export async function searchDossiersForLoan(q: string): Promise<ActionResult<DossierChoice[]>> {
  return runAction("loan_search_dossier", async () => {
    const text = q.trim();
    if (text.length < 2 || text.length > 200) return [];
    return (await findDossiers(text, 10)).map((d) => ({ id: d.id, code: d.code, title: d.title, statusLabel: d.statusLabel }));
  });
}
