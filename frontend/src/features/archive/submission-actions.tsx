"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { deleteSubmission, receiveSubmission, returnSubmission, submitSubmission } from "@/app/actions/archive";
import { Button, buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/config/routes";
import { useServerAction } from "@/lib/use-server-action";
import type { Submission } from "./archive-data";
import { allowedActions, MIN_RETURN_NOTE, readProblems, validateReturn, type ArchiveProblem } from "./archive-rules";

/**
 * Thao tác trên một đợt nộp lưu (FE-37, BE-84, BE-85), theo bước: soạn → nộp hoặc xóa; đã nộp → tiếp nhận cả đợt hoặc trả lại; đã tiếp nhận → biên bản PDF.
 * Tiếp nhận là một giao dịch: một hồ sơ lỗi thì không hồ sơ nào đổi, lỗi từng hồ sơ hiện ngay dưới.
 */
export function SubmissionActions({ submission }: { submission: Submission }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const can = allowedActions(submission.status);
  const [confirming, setConfirming] = useState<"delete" | "receive" | null>(null);
  const [giving, setGiving] = useState(false);
  const [note, setNote] = useState("");
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const [problems, setProblems] = useState<ArchiveProblem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const submit = useServerAction(submitSubmission, { toastErrors: false });
  const remove = useServerAction(deleteSubmission, { toastErrors: false });
  const receive = useServerAction(receiveSubmission, { toastErrors: false });
  const giveBack = useServerAction(returnSubmission, { toastErrors: false });
  const busy = submit.pending || remove.pending || receive.pending || giveBack.pending;
  const items = submission.items ?? [];
  const issues = Object.entries(itemNotes).filter(([, v]) => v.trim().length > 0).map(([dossierId, text]) => ({ dossierId, note: text }));
  const errors = validateReturn(note, issues);
  const report = (r: { message: string; errorId?: string }) => setMessage(r.errorId ? `${r.message} (Mã lỗi ${r.errorId})` : r.message);

  async function doSubmit() {
    setMessage(null);
    const result = await submit.run(submission.id);
    if (result.ok) { toast.success("Đã nộp đợt. Người tiếp nhận sẽ được báo."); router.refresh(); } else { report(result); router.refresh(); }
  }

  async function doDelete() {
    setMessage(null);
    const result = await remove.run(submission.id);
    if (result.ok) { toast.success("Đã xóa đợt đang soạn."); router.push(routes.archive); } else { report(result); setConfirming(null); }
  }

  async function doReceive() {
    setMessage(null);
    setProblems([]);
    const result = await receive.run(submission.id);
    setConfirming(null);
    if (result.ok) { toast.success("Đã tiếp nhận cả đợt; biên bản đã được tạo."); router.refresh(); }
    else { setProblems(readProblems(result.details)); report(result); router.refresh(); }
  }

  async function doReturn() {
    setTouched(true);
    setMessage(null);
    if (Object.keys(errors).length > 0) return;
    const result = await giveBack.run(submission.id, note, issues);
    if (result.ok) { toast.success("Đã trả lại đợt kèm lý do."); setGiving(false); router.refresh(); } else report(result);
  }

  if (!can.submit && !can.receive && !can.minutes) return null;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {can.submit && <Button variant="primary" onClick={doSubmit} disabled={busy || items.length === 0}>{submit.pending ? "Đang nộp…" : "Nộp đợt"}</Button>}
        {can.remove && (confirming === "delete" ? (
          <><span className="text-sm">Xóa đợt này? Các hồ sơ được giải phóng.</span><Button variant="danger" onClick={doDelete} disabled={busy}>Xóa đợt</Button><Button onClick={() => setConfirming(null)}>Giữ lại</Button></>
        ) : <Button onClick={() => setConfirming("delete")} disabled={busy}>Xóa đợt</Button>)}
        {can.receive && (confirming === "receive" ? (
          <><span className="text-sm">Tiếp nhận cả {submission.dossierCount} hồ sơ vào lưu trữ? Hồ sơ chuyển sang &ldquo;Đã lưu trữ&rdquo;.</span><Button variant="primary" onClick={doReceive} disabled={busy}>{receive.pending ? "Đang tiếp nhận…" : "Tiếp nhận"}</Button><Button onClick={() => setConfirming(null)} disabled={busy}>Hủy</Button></>
        ) : <Button variant="primary" onClick={() => setConfirming("receive")} disabled={busy}>Tiếp nhận cả đợt</Button>)}
        {can.giveBack && <Button onClick={() => { setTouched(false); setMessage(null); setGiving(true); }} disabled={busy}>Trả lại đợt</Button>}
        {can.minutes && submission.hasMinutes && (
          <a href={`/api/v1/archive-submissions/${submission.id}/minutes`} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "md")}><Download aria-hidden className="size-4" /> Tải biên bản (PDF)</a>
        )}
      </div>
      {message && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{message}</p>}
      {problems.length > 0 && (
        <ul className="grid gap-1 border border-bad p-2 text-sm" aria-label="Hồ sơ có vấn đề">
          {problems.map((p) => <li key={p.dossierId}><b>{p.code || "Hồ sơ"}</b>: {p.problem}</li>)}
        </ul>
      )}

      <Dialog open={giving} onClose={() => !busy && setGiving(false)} title="Trả lại đợt" description="Trả đợt về cho người gom, kèm lý do. Hồ sơ được giải phóng để gom lại sau khi sửa. Có thể nêu lỗi riêng từng hồ sơ."
        className="w-[min(40rem,calc(100vw-2rem))]"
        footer={<><Button onClick={() => setGiving(false)} disabled={busy}>Hủy</Button><Button variant="primary" onClick={doReturn} disabled={busy}>{giveBack.pending ? "Đang trả…" : "Trả lại đợt"}</Button></>}>
        <div className="grid gap-3">
          <label htmlFor={`${id}-note`} className="grid gap-1 text-[13px] font-semibold">Lý do trả lại (từ {MIN_RETURN_NOTE} ký tự)
            <textarea id={`${id}-note`} value={note} rows={2} onChange={(e) => setNote(e.target.value)} className="border border-line-strong bg-surface p-2 text-sm font-normal outline-none focus:border-primary" aria-invalid={touched && errors.note ? true : undefined} />
          </label>
          {touched && errors.note && <p role="alert" className="text-[13px] text-bad">{errors.note}</p>}
          <fieldset className="grid gap-2">
            <legend className="text-[13px] font-semibold">Lỗi từng hồ sơ (không bắt buộc)</legend>
            <ul className="grid max-h-56 gap-2 overflow-y-auto">
              {items.map((i) => (
                <li key={i.dossierId} className="grid gap-1 text-sm">
                  <label htmlFor={`${id}-${i.dossierId}`} className="font-semibold">{i.code} <span className="font-normal text-muted">{i.title}</span></label>
                  <input id={`${id}-${i.dossierId}`} value={itemNotes[i.dossierId] ?? ""} onChange={(e) => setItemNotes((c) => ({ ...c, [i.dossierId]: e.target.value }))} placeholder="Để trống nếu hồ sơ này không có lỗi" className="h-9 border border-line-strong bg-surface px-2 text-sm outline-none focus:border-primary" />
                </li>
              ))}
            </ul>
            {touched && errors.issues && <p role="alert" className="text-[13px] text-bad">{errors.issues}</p>}
          </fieldset>
          {message && giving && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{message}</p>}
        </div>
      </Dialog>
    </div>
  );
}
