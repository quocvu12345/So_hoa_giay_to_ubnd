"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { approveLoan, lendLoan, rejectLoan, requestLoan, returnLoan, searchDossiersForLoan, type DossierChoice } from "@/app/actions/loans";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Chip, type Tone } from "@/components/ui/status-chip";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/config/routes";
import { formatDate, formatDateTime } from "@/lib/format";
import { useServerAction } from "@/lib/use-server-action";
import type { Loan } from "./loan-data";
import { addDays, DEFAULT_LOAN_DAYS, LOAN_STATUS, loanActions, MAX_LOAN_DAYS, MAX_PURPOSE, overdueDays, validateDue, validatePurpose, validateRejectNote } from "./loan-rules";

const TONE: Record<string, Tone> = { requested: "warn", approved: "info", lent: "info", overdue: "bad", returned: "ok", rejected: "neutral" };
const area = "border border-line-strong bg-surface p-2 text-sm font-normal outline-none focus:border-primary aria-[invalid=true]:border-bad";
const field = "h-9 border border-line-strong bg-surface px-2 text-sm font-normal outline-none focus:border-primary aria-[invalid=true]:border-bad";
const failure = (r: { message: string; errorId?: string }) => (r.errorId ? `${r.message} (Mã lỗi ${r.errorId})` : r.message);

// =====================================================================================================================
// Đề nghị mượn
// =====================================================================================================================
export function RequestLoanButton({ today }: { today: string }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [choices, setChoices] = useState<DossierChoice[]>([]);
  const [picked, setPicked] = useState<DossierChoice | null>(null);
  const [purpose, setPurpose] = useState("");
  const [due, setDue] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const search = useServerAction(searchDossiersForLoan, { toastErrors: false });
  const request = useServerAction(requestLoan, { toastErrors: false });
  const purposeProblem = validatePurpose(purpose);
  const dueProblem = validateDue(due, today);

  useEffect(() => () => clearTimeout(timer.current), []);

  function reset() {
    setQ(""); setChoices([]); setPicked(null); setPurpose(""); setDue(""); setTouched(false); setError(null);
  }

  function onQuery(value: string) {
    setQ(value);
    clearTimeout(timer.current);
    if (value.trim().length < 2) return setChoices([]);
    timer.current = setTimeout(async () => {
      const result = await search.run(value);
      if (result.ok) setChoices(result.data);
    }, 300);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    setError(null);
    if (!picked || purposeProblem || dueProblem) return;
    const result = await request.run(picked.id, purpose, due);
    if (result.ok) {
      toast.success(`Đã đề nghị mượn hồ sơ ${picked.code}. Chờ người có thẩm quyền duyệt.`);
      reset();
      setOpen(false);
      router.refresh();
    } else setError(failure(result));
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}><Plus aria-hidden className="size-4" /> Đề nghị mượn</Button>
      <Dialog open={open} onClose={() => { if (!request.pending) { reset(); setOpen(false); } }} title="Đề nghị mượn bản giấy" description="Chọn hồ sơ cần mượn bản giấy và nêu mục đích. Người có thẩm quyền duyệt, giao rồi nhận trả."
        className="w-[min(40rem,calc(100vw-2rem))]"
        footer={<><Button onClick={() => { reset(); setOpen(false); }} disabled={request.pending}>Hủy</Button><Button variant="primary" type="submit" form={`${id}-form`} disabled={request.pending}>{request.pending ? "Đang gửi…" : "Gửi đề nghị"}</Button></>}>
        <form id={`${id}-form`} onSubmit={submit} className="grid gap-3" noValidate>
          {picked ? (
            <div className="flex flex-wrap items-center gap-2 border border-ok bg-ok-soft p-2 text-sm"><span className="flex-1"><b>{picked.code}</b> {picked.title}</span><Button size="sm" onClick={() => setPicked(null)}>Chọn hồ sơ khác</Button></div>
          ) : (
            <div className="grid gap-1">
              <label htmlFor={`${id}-q`} className="text-[13px] font-semibold">Hồ sơ cần mượn</label>
              <input id={`${id}-q`} type="search" value={q} onChange={(e) => onQuery(e.target.value)} placeholder="Gõ mã hoặc tên hồ sơ, không cần dấu…" autoComplete="off" className={field} />
              <ul className="max-h-48 divide-y divide-line overflow-y-auto border border-line" aria-label="Kết quả tìm hồ sơ">
                {choices.length === 0 && <li className="px-3 py-2 text-sm text-muted">{q.trim().length < 2 ? "Gõ ít nhất 2 ký tự để tìm." : search.pending ? "Đang tìm…" : "Không thấy hồ sơ khớp trong phạm vi của bạn."}</li>}
                {choices.map((c) => <li key={c.id}><button type="button" onClick={() => setPicked(c)} className="grid w-full gap-0.5 px-3 py-2 text-left text-sm hover:bg-soft"><span className="font-semibold">{c.code} · {c.title}</span><span className="text-xs text-muted">{c.statusLabel}</span></button></li>)}
              </ul>
              {touched && <p role="alert" className="text-[13px] text-bad">Chọn hồ sơ cần mượn.</p>}
            </div>
          )}
          <label htmlFor={`${id}-purpose`} className="grid gap-1 text-[13px] font-semibold">Mục đích mượn
            <textarea id={`${id}-purpose`} value={purpose} rows={2} maxLength={MAX_PURPOSE + 50} onChange={(e) => setPurpose(e.target.value)} className={area} aria-invalid={touched && purposeProblem ? true : undefined} />
            {touched && purposeProblem && <span role="alert" className="text-[13px] font-normal text-bad">{purposeProblem}</span>}
          </label>
          <label htmlFor={`${id}-due`} className="grid gap-1 text-[13px] font-semibold">Hạn trả đề nghị (bỏ trống: người duyệt đặt, mặc định {DEFAULT_LOAN_DAYS} ngày)
            <input id={`${id}-due`} type="date" value={due} min={today} max={addDays(today, MAX_LOAN_DAYS)} onChange={(e) => setDue(e.target.value)} className={field} aria-invalid={touched && dueProblem ? true : undefined} />
            {touched && dueProblem && <span role="alert" className="text-[13px] font-normal text-bad">{dueProblem}</span>}
          </label>
          {error && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{error}</p>}
        </form>
      </Dialog>
    </>
  );
}

// =====================================================================================================================
// Danh sách khoản mượn
// =====================================================================================================================
export function LoanList({ loans, canApprove, today }: { loans: Loan[]; canApprove: boolean; today: string }) {
  const router = useRouter();
  const toast = useToast();
  const [approving, setApproving] = useState<Loan | null>(null);
  const [rejecting, setRejecting] = useState<Loan | null>(null);
  const [receiving, setReceiving] = useState<Loan | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const lend = useServerAction(lendLoan, { toastErrors: false });

  async function doLend(loan: Loan) {
    setMessage(null);
    const result = await lend.run(loan.id);
    if (result.ok) { toast.success(`Đã giao hồ sơ ${loan.dossierCode} cho ${loan.borrowerName}.`); router.refresh(); } else { setMessage(failure(result)); router.refresh(); }
  }

  if (loans.length === 0) return <p className="border border-dashed border-line-strong p-4 text-sm text-muted">Không có khoản mượn nào ở bộ lọc này.</p>;
  return (
    <>
      {message && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{message}</p>}
      <ul className="grid gap-2" aria-label="Khoản mượn">
        {loans.map((l) => {
          const can = loanActions(l.status, { canApprove });
          const late = overdueDays(l.dueOn, today);
          return (
            <li key={l.id} className="grid gap-1.5 border border-line bg-surface p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={routes.dossier(l.dossierId)} className="font-bold text-primary hover:underline">{l.dossierCode}</Link>
                <span>{l.dossierTitle}</span>
                <Chip tone={TONE[l.status] ?? "neutral"}>{LOAN_STATUS[l.status] ?? l.status}</Chip>
                {l.status === "overdue" || (l.status === "lent" && late > 0) ? <Chip tone="bad">Quá hạn {late > 0 ? `${late} ngày` : ""}</Chip> : null}
              </div>
              <p><b>Mục đích:</b> {l.purpose}</p>
              <p className="text-xs text-muted">{l.borrowerName} đề nghị {formatDateTime(l.requestedAt)}{l.dueOn ? ` · hạn trả ${formatDate(l.dueOn)}` : ""}{l.lentAt ? ` · giao ${formatDateTime(l.lentAt)}` : ""}{l.returnedAt ? ` · trả ${formatDateTime(l.returnedAt)}` : ""}</p>
              {l.decisionNote && <p className="text-xs text-muted">Ghi chú duyệt: {l.decisionNote}</p>}
              {l.conditionNote && <p className="text-xs text-muted">Tình trạng khi trả: {l.conditionNote}</p>}
              <div className="flex flex-wrap gap-2">
                {can.approve && <Button size="sm" variant="primary" onClick={() => setApproving(l)} aria-label={`Duyệt mượn hồ sơ ${l.dossierCode}`}>Duyệt</Button>}
                {can.reject && <Button size="sm" onClick={() => setRejecting(l)} aria-label={`Từ chối mượn hồ sơ ${l.dossierCode}`}>Từ chối</Button>}
                {can.lend && <Button size="sm" variant="primary" onClick={() => doLend(l)} disabled={lend.pending} aria-label={`Giao hồ sơ ${l.dossierCode}`}>Giao hồ sơ</Button>}
                {can.receive && <Button size="sm" variant="primary" onClick={() => setReceiving(l)} aria-label={`Nhận trả hồ sơ ${l.dossierCode}`}>Nhận trả</Button>}
              </div>
            </li>
          );
        })}
      </ul>
      <ApproveDialog loan={approving} today={today} onClose={() => setApproving(null)} />
      <RejectDialog loan={rejecting} onClose={() => setRejecting(null)} />
      <ReturnDialog loan={receiving} onClose={() => setReceiving(null)} />
    </>
  );
}

function ApproveDialog({ loan, today, onClose }: { loan: Loan | null; today: string; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const action = useServerAction(approveLoan, { toastErrors: false });
  const problem = validateDue(due, today);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!loan || problem) return;
    const result = await action.run(loan.id, due, note);
    if (result.ok) {
      toast.success("Đã duyệt. Giao hồ sơ ở bước tiếp theo.");
      setDue(""); setNote("");
      onClose();
      router.refresh();
    } else setError(failure(result));
  }

  return (
    <Dialog open={loan !== null} onClose={() => !action.pending && onClose()} title={loan ? `Duyệt mượn hồ sơ ${loan.dossierCode}` : "Duyệt"} description={loan ? `Người mượn: ${loan.borrowerName}. Hạn trả tối đa ${MAX_LOAN_DAYS} ngày.` : undefined}
      footer={<><Button onClick={onClose} disabled={action.pending}>Hủy</Button><Button variant="primary" type="submit" form={`${id}-form`} disabled={action.pending}>{action.pending ? "Đang duyệt…" : "Duyệt"}</Button></>}>
      <form id={`${id}-form`} onSubmit={submit} className="grid gap-3" noValidate>
        <label htmlFor={`${id}-due`} className="grid gap-1 text-[13px] font-semibold">Hạn trả (bỏ trống: {DEFAULT_LOAN_DAYS} ngày kể từ hôm nay)
          <input id={`${id}-due`} type="date" value={due} min={today} max={addDays(today, MAX_LOAN_DAYS)} onChange={(e) => setDue(e.target.value)} className={field} aria-invalid={problem ? true : undefined} />
          {problem && <span role="alert" className="text-[13px] font-normal text-bad">{problem}</span>}
        </label>
        <label htmlFor={`${id}-note`} className="grid gap-1 text-[13px] font-semibold">Ghi chú (không bắt buộc)
          <textarea id={`${id}-note`} value={note} rows={2} onChange={(e) => setNote(e.target.value)} className={area} />
        </label>
        {error && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{error}</p>}
      </form>
    </Dialog>
  );
}

function RejectDialog({ loan, onClose }: { loan: Loan | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = useServerAction(rejectLoan, { toastErrors: false });
  const problem = validateRejectNote(note);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    setError(null);
    if (!loan || problem) return;
    const result = await action.run(loan.id, note);
    if (result.ok) { toast.success("Đã từ chối đề nghị mượn."); setNote(""); setTouched(false); onClose(); router.refresh(); } else setError(failure(result));
  }

  return (
    <Dialog open={loan !== null} onClose={() => !action.pending && onClose()} title={loan ? `Từ chối mượn hồ sơ ${loan.dossierCode}` : "Từ chối"}
      footer={<><Button onClick={onClose} disabled={action.pending}>Hủy</Button><Button variant="primary" type="submit" form={`${id}-form`} disabled={action.pending}>{action.pending ? "Đang gửi…" : "Từ chối"}</Button></>}>
      <form id={`${id}-form`} onSubmit={submit} className="grid gap-2" noValidate>
        <label htmlFor={`${id}-note`} className="text-[13px] font-semibold">Lý do từ chối (từ 5 ký tự)</label>
        <textarea id={`${id}-note`} value={note} rows={3} onChange={(e) => setNote(e.target.value)} className={area} aria-invalid={touched && problem ? true : undefined} />
        {touched && problem && <p role="alert" className="text-[13px] text-bad">{problem}</p>}
        {error && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{error}</p>}
      </form>
    </Dialog>
  );
}

function ReturnDialog({ loan, onClose }: { loan: Loan | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const action = useServerAction(returnLoan, { toastErrors: false });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!loan) return;
    const result = await action.run(loan.id, note);
    if (result.ok) { toast.success(`Đã nhận trả hồ sơ ${loan.dossierCode}.`); setNote(""); onClose(); router.refresh(); } else setError(failure(result));
  }

  return (
    <Dialog open={loan !== null} onClose={() => !action.pending && onClose()} title={loan ? `Nhận trả hồ sơ ${loan.dossierCode}` : "Nhận trả"} description="Ghi tình trạng hồ sơ khi nhận lại (nguyên vẹn, thiếu trang, hư hỏng…)."
      footer={<><Button onClick={onClose} disabled={action.pending}>Hủy</Button><Button variant="primary" type="submit" form={`${id}-form`} disabled={action.pending}>{action.pending ? "Đang ghi…" : "Nhận trả"}</Button></>}>
      <form id={`${id}-form`} onSubmit={submit} className="grid gap-2" noValidate>
        <label htmlFor={`${id}-note`} className="text-[13px] font-semibold">Tình trạng khi trả (không bắt buộc)</label>
        <textarea id={`${id}-note`} value={note} rows={3} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Nguyên vẹn, đủ số trang" className={area} />
        {error && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{error}</p>}
      </form>
    </Dialog>
  );
}
