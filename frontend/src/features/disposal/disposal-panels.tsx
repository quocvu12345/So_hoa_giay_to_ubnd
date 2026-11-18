"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { approveDisposal, executeDisposal, rejectDisposal, requestDisposal, searchDecisionDocuments, type DocumentChoice } from "@/app/actions/disposals";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Chip, type Tone } from "@/components/ui/status-chip";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/config/routes";
import { formatDate, formatDateTime } from "@/lib/format";
import { useServerAction } from "@/lib/use-server-action";
import type { Disposal, EligibleDossier } from "./disposal-data";
import { describeResult, DISPOSAL_STATUS, disposalActions, EXECUTE_WARNING, MAX_REASON, MIN_REASON, validateReason } from "./disposal-rules";

const TONE: Record<string, Tone> = { requested: "warn", approved: "info", executing: "info", executed: "ok", rejected: "neutral" };
const area = "border border-line-strong bg-surface p-2 text-sm font-normal outline-none focus:border-primary aria-[invalid=true]:border-bad";
const failure = (r: { message: string; errorId?: string }) => (r.errorId ? `${r.message} (Mã lỗi ${r.errorId})` : r.message);

// =====================================================================================================================
// Hồ sơ đủ điều kiện hủy (cho người có quyền đề nghị)
// =====================================================================================================================
export function EligibleList({ dossiers }: { dossiers: EligibleDossier[] }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [target, setTarget] = useState<EligibleDossier | null>(null);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = useServerAction(requestDisposal, { toastErrors: false });
  const problem = validateReason(reason);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    setError(null);
    if (!target || problem) return;
    const result = await action.run(target.dossierId, reason);
    if (result.ok) {
      toast.success(`Đã đề nghị hủy hồ sơ ${target.code}. Chờ người có thẩm quyền phê duyệt.`);
      setTarget(null);
      setReason("");
      setTouched(false);
      router.refresh();
    } else setError(failure(result));
  }

  if (dossiers.length === 0) {
    return <p className="border border-dashed border-line-strong p-4 text-sm text-muted">Chưa có hồ sơ nào đủ điều kiện hủy. Hồ sơ phải đã lưu trữ, có quy tắc bảo quản đã được xác nhận (người xác nhận và căn cứ pháp lý) và đã đủ số năm. Hệ thống không tự đặt thời hạn.</p>;
  }
  return (
    <>
      <ul className="grid divide-y divide-line border border-line" aria-label="Hồ sơ đủ điều kiện hủy">
        {dossiers.map((d) => (
          <li key={d.dossierId} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
            <span className="grid flex-1 gap-0.5">
              <span><Link href={routes.dossier(d.dossierId)} className="font-bold text-primary hover:underline">{d.code}</Link> {d.title}</span>
              <span className="text-xs text-muted">Lưu trữ {formatDate(d.archivedAt)} · thời hạn bảo quản {d.retentionLabel} ({Number(d.retentionYears)} năm) · đủ điều kiện từ {formatDate(d.eligibleSince)}</span>
            </span>
            <Button size="sm" onClick={() => { setTarget(d); setReason(""); setTouched(false); setError(null); }} aria-label={`Đề nghị hủy hồ sơ ${d.code}`}>Đề nghị hủy</Button>
          </li>
        ))}
      </ul>
      <Dialog open={target !== null} onClose={() => !action.pending && setTarget(null)} title={target ? `Đề nghị hủy hồ sơ ${target.code}` : "Đề nghị hủy"}
        description="Đề nghị chuyển người có thẩm quyền phê duyệt. Chưa xóa gì cho tới khi được phê duyệt kèm văn bản quyết định và được thực hiện."
        footer={<><Button onClick={() => setTarget(null)} disabled={action.pending}>Hủy</Button><Button variant="primary" type="submit" form={`${id}-form`} disabled={action.pending}>{action.pending ? "Đang gửi…" : "Gửi đề nghị"}</Button></>}>
        <form id={`${id}-form`} onSubmit={submit} className="grid gap-2" noValidate>
          <label htmlFor={`${id}-reason`} className="text-[13px] font-semibold">Lý do đề nghị hủy (từ {MIN_REASON} ký tự)</label>
          <textarea id={`${id}-reason`} value={reason} rows={3} maxLength={MAX_REASON + 50} onChange={(e) => setReason(e.target.value)} className={area} aria-invalid={touched && problem ? true : undefined} />
          {touched && problem && <p role="alert" className="text-[13px] text-bad">{problem}</p>}
          {error && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{error}</p>}
        </form>
      </Dialog>
    </>
  );
}

// =====================================================================================================================
// Danh sách đề nghị và thao tác theo bước
// =====================================================================================================================
export function DisposalList({ items, canRequest, canApprove, myName }: { items: Disposal[]; canRequest: boolean; canApprove: boolean; myName: string }) {
  const router = useRouter();
  const toast = useToast();
  const [approving, setApproving] = useState<Disposal | null>(null);
  const [rejecting, setRejecting] = useState<Disposal | null>(null);
  const [executing, setExecuting] = useState<Disposal | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const execute = useServerAction(executeDisposal, { toastErrors: false });

  async function doExecute(d: Disposal) {
    setMessage(null);
    const result = await execute.run(d.id);
    if (result.ok) {
      setExecuting(null);
      if (result.data.status === "executed") toast.success(describeResult(result.data));
      else toast.info("Đã nhận yêu cầu hủy; hệ thống đang xóa nội dung và sẽ tiếp tục nếu kho tệp chưa sẵn sàng. Không cần gửi lại.");
      router.refresh();
    } else {
      setMessage(failure(result));
      setExecuting(null);
      router.refresh();
    }
  }

  if (items.length === 0) return <p className="border border-dashed border-line-strong p-4 text-sm text-muted">Không có đề nghị nào ở bộ lọc này.</p>;
  return (
    <>
      {message && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{message}</p>}
      <ul className="grid gap-2" aria-label="Đề nghị hủy">
        {items.map((d) => {
          const can = disposalActions(d.status, { canRequest, canApprove }, d.requestedByName === myName);
          return (
            <li key={d.id} className="grid gap-1.5 border border-line bg-surface p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={routes.dossier(d.dossierId)} className="font-bold text-primary hover:underline">{d.dossierCode}</Link>
                <span>{d.dossierTitle}</span>
                <Chip tone={TONE[d.status] ?? "neutral"}>{DISPOSAL_STATUS[d.status] ?? d.status}</Chip>
              </div>
              <p className="text-xs text-muted">Thời hạn bảo quản {d.retentionLabel}{d.retentionYears ? ` (${Number(d.retentionYears)} năm)` : ""}{d.legalReference ? ` · căn cứ ${d.legalReference}` : ""}</p>
              <p><b>Lý do:</b> {d.reason}</p>
              <p className="text-xs text-muted">{d.requestedByName} đề nghị {formatDateTime(d.requestedAt)}{d.decidedByName ? ` · ${d.status === "rejected" ? "từ chối" : "phê duyệt"} bởi ${d.decidedByName} ${formatDateTime(d.decidedAt)}` : ""}{d.executedByName ? ` · thực hiện bởi ${d.executedByName}${d.executedAt ? ` ${formatDateTime(d.executedAt)}` : ""}` : ""}</p>
              {d.decisionNote && <p className="text-xs text-muted">Ghi chú: {d.decisionNote}</p>}
              {d.decisionDocumentId && <p className="text-xs"><Link href={routes.document(d.decisionDocumentId)} className="text-primary hover:underline">Xem văn bản quyết định</Link></p>}
              {can.ownNote && <p className="text-[13px] text-muted">Bạn là người đề nghị nên không tự phê duyệt được; nhờ người khác có thẩm quyền.</p>}
              <div className="flex flex-wrap gap-2">
                {can.approve && <Button size="sm" variant="primary" onClick={() => setApproving(d)} aria-label={`Phê duyệt đề nghị hủy hồ sơ ${d.dossierCode}`}>Phê duyệt</Button>}
                {can.reject && <Button size="sm" onClick={() => setRejecting(d)} aria-label={`Từ chối đề nghị hủy hồ sơ ${d.dossierCode}`}>Từ chối</Button>}
                {can.execute && (executing?.id === d.id ? (
                  <span className="flex flex-wrap items-center gap-2 border border-bad p-2">
                    <span className="max-w-2xl text-[13px] text-bad">{EXECUTE_WARNING}</span>
                    <Button size="sm" variant="danger" onClick={() => doExecute(d)} disabled={execute.pending}>{execute.pending ? "Đang hủy…" : "Xác nhận hủy vĩnh viễn"}</Button>
                    <Button size="sm" onClick={() => setExecuting(null)} disabled={execute.pending}>Không hủy</Button>
                  </span>
                ) : <Button size="sm" variant="danger" onClick={() => setExecuting(d)} aria-label={`Thực hiện hủy hồ sơ ${d.dossierCode}`}>Thực hiện hủy…</Button>)}
                {d.status === "executing" && <span className="text-[13px] text-muted">Đang xóa nội dung; không cần gửi lại.</span>}
              </div>
            </li>
          );
        })}
      </ul>
      <ApproveDialog disposal={approving} onClose={() => setApproving(null)} />
      <RejectDialog disposal={rejecting} onClose={() => setRejecting(null)} />
    </>
  );
}

function ApproveDialog({ disposal, onClose }: { disposal: Disposal | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [q, setQ] = useState("");
  const [choices, setChoices] = useState<DocumentChoice[]>([]);
  const [picked, setPicked] = useState<DocumentChoice | null>(null);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchAction = useServerAction(searchDecisionDocuments, { toastErrors: false });
  const approve = useServerAction(approveDisposal, { toastErrors: false });

  useEffect(() => () => clearTimeout(timer.current), []);

  function onQuery(value: string) {
    setQ(value);
    clearTimeout(timer.current);
    if (value.trim().length < 2) return setChoices([]);
    // Đợi người dùng ngừng gõ 300 ms; bỏ kết quả về muộn của câu cũ.
    timer.current = setTimeout(async () => {
      const result = await searchAction.run(value);
      if (result.ok) setChoices(result.data);
    }, 300);
  }

  function reset() {
    setQ(""); setChoices([]); setPicked(null); setNote(""); setTouched(false); setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    setError(null);
    if (!disposal || !picked) return;
    const result = await approve.run(disposal.id, picked.id, note);
    if (result.ok) {
      toast.success("Đã phê duyệt kèm văn bản quyết định. Văn thư thực hiện hủy ở bước tiếp theo.");
      reset();
      onClose();
      router.refresh();
    } else setError(failure(result));
  }

  return (
    <Dialog open={disposal !== null} onClose={() => { if (!approve.pending) { reset(); onClose(); } }} title={disposal ? `Phê duyệt hủy hồ sơ ${disposal.dossierCode}` : "Phê duyệt"}
      description="Chọn văn bản quyết định hủy (giấy tờ đã có trong hệ thống, nằm ngoài hồ sơ bị hủy). Phê duyệt chưa xóa gì."
      className="w-[min(40rem,calc(100vw-2rem))]"
      footer={<><Button onClick={() => { reset(); onClose(); }} disabled={approve.pending}>Hủy</Button><Button variant="primary" type="submit" form={`${id}-form`} disabled={approve.pending}>{approve.pending ? "Đang phê duyệt…" : "Phê duyệt"}</Button></>}>
      <form id={`${id}-form`} onSubmit={submit} className="grid gap-3" noValidate>
        {picked ? (
          <div className="flex flex-wrap items-center gap-2 border border-ok bg-ok-soft p-2 text-sm"><span className="flex-1"><b>{picked.title}</b>{picked.number ? ` · ${picked.number}` : ""}</span><Button size="sm" onClick={() => setPicked(null)}>Chọn văn bản khác</Button></div>
        ) : (
          <div className="grid gap-1">
            <label htmlFor={`${id}-q`} className="text-[13px] font-semibold">Văn bản quyết định hủy</label>
            <input id={`${id}-q`} type="search" value={q} onChange={(e) => onQuery(e.target.value)} placeholder="Gõ số ký hiệu hoặc trích yếu, không cần dấu…" autoComplete="off" className="h-9 border border-line-strong bg-surface px-2 text-sm outline-none focus:border-primary" />
            <ul className="max-h-56 divide-y divide-line overflow-y-auto border border-line" aria-label="Kết quả tìm văn bản">
              {choices.length === 0 && <li className="px-3 py-2 text-sm text-muted">{q.trim().length < 2 ? "Gõ ít nhất 2 ký tự để tìm." : searchAction.pending ? "Đang tìm…" : "Không thấy văn bản khớp trong phạm vi của bạn."}</li>}
              {choices.map((c) => (
                <li key={c.id}><button type="button" onClick={() => setPicked(c)} className="grid w-full gap-0.5 px-3 py-2 text-left text-sm hover:bg-soft"><span className="font-semibold">{c.title}</span><span className="text-xs text-muted">{[c.number, c.subtitle, c.issuedOn && formatDate(c.issuedOn)].filter(Boolean).join(" · ")}</span></button></li>
              ))}
            </ul>
            {touched && <p role="alert" className="text-[13px] text-bad">Chọn văn bản quyết định hủy.</p>}
          </div>
        )}
        <label htmlFor={`${id}-note`} className="grid gap-1 text-[13px] font-semibold">Ghi chú (không bắt buộc)
          <textarea id={`${id}-note`} value={note} rows={2} onChange={(e) => setNote(e.target.value)} className={area} />
        </label>
        {error && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{error}</p>}
      </form>
    </Dialog>
  );
}

function RejectDialog({ disposal, onClose }: { disposal: Disposal | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = useServerAction(rejectDisposal, { toastErrors: false });
  const problem = validateReason(note);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    setError(null);
    if (!disposal || problem) return;
    const result = await action.run(disposal.id, note);
    if (result.ok) {
      toast.success("Đã từ chối đề nghị hủy.");
      setNote(""); setTouched(false);
      onClose();
      router.refresh();
    } else setError(failure(result));
  }

  return (
    <Dialog open={disposal !== null} onClose={() => !action.pending && onClose()} title={disposal ? `Từ chối hủy hồ sơ ${disposal.dossierCode}` : "Từ chối"}
      description="Hồ sơ giữ nguyên. Người đề nghị được báo kèm lý do."
      footer={<><Button onClick={onClose} disabled={action.pending}>Hủy</Button><Button variant="primary" type="submit" form={`${id}-form`} disabled={action.pending}>{action.pending ? "Đang gửi…" : "Từ chối đề nghị"}</Button></>}>
      <form id={`${id}-form`} onSubmit={submit} className="grid gap-2" noValidate>
        <label htmlFor={`${id}-note`} className="text-[13px] font-semibold">Lý do từ chối (từ {MIN_REASON} ký tự)</label>
        <textarea id={`${id}-note`} value={note} rows={3} onChange={(e) => setNote(e.target.value)} className={area} aria-invalid={touched && problem ? true : undefined} />
        {touched && problem && <p role="alert" className="text-[13px] text-bad">{problem}</p>}
        {error && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{error}</p>}
      </form>
    </Dialog>
  );
}
