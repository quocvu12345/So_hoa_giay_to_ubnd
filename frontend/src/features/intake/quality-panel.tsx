"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus } from "lucide-react";
import { createIssue, resolveIssue, setPageQuality } from "@/app/actions/batches";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Chip, type Tone } from "@/components/ui/status-chip";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/config/routes";
import { formatDateTime } from "@/lib/format";
import { useServerAction } from "@/lib/use-server-action";
import type { BatchFile, QualityIssue, SuspectPage } from "./batch-data";
import { ISSUE_STATUS, ISSUE_TYPE, ISSUE_TYPES, MIN_ACCEPT_NOTE, PAGE_QUALITY, pageLabel, SEVERITY, validateNote } from "./batch-rules";
import { ReplaceScanDialog } from "./replace-scan-dialog";

type Props = {
  batchId: string;
  files: BatchFile[];
  issues: QualityIssue[];
  suspectPages: SuspectPage[];
  /** `intake.qc`: ghi, xử lý lỗi ảnh. Không có thì chỉ xem. */
  canQc: boolean;
  /** `document.edit`: thay bản quét. */
  canReplace: boolean;
  /** Lô đã đóng: không ghi thêm lỗi, không đổi chất lượng trang. */
  closed: boolean;
};

const STATUS_TONE: Record<string, Tone> = { open: "warn", fixed: "ok", wont_fix: "neutral" };
const SEVERITY_TONE: Record<string, Tone> = { high: "bad", medium: "warn", low: "neutral" };

/**
 * Lỗi ảnh và trang nghi ngờ của một lô (FE-41, BE-53). Trang AI gắn cờ chờ người xác nhận ("Cần quét lại" mở lỗi và chặn đóng lô;
 * "Đạt" bỏ cờ). Lỗi mở xử lý bằng "Đã sửa" hoặc "Chấp nhận bỏ qua" kèm lý do. Thay bản quét (BE-126) tự đóng lỗi của bản cũ.
 */
export function QualityPanel({ batchId, files, issues, suspectPages, canQc, canReplace, closed }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [skipping, setSkipping] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteTouched, setNoteTouched] = useState(false);
  const resolve = useServerAction(resolveIssue);
  const quality = useServerAction(setPageQuality);
  const nameOf = (fileId: string | null) => files.find((f) => f.fileId === fileId)?.fileName ?? "Cả lô";
  const open = issues.filter((i) => i.status === "open");
  const done = issues.filter((i) => i.status !== "open");
  const noteProblem = validateNote(note);
  const writable = canQc && !closed;

  async function markFixed(issue: QualityIssue) {
    const result = await resolve.run(issue.id, batchId, "fixed", "");
    if (result.ok) {
      toast.success("Đã đánh dấu lỗi là đã sửa.");
      router.refresh();
    }
  }

  async function skip(issue: QualityIssue) {
    setNoteTouched(true);
    if (noteProblem) return;
    const result = await resolve.run(issue.id, batchId, "wont_fix", note);
    if (result.ok) {
      toast.success("Đã chấp nhận bỏ qua lỗi, kèm lý do.");
      setSkipping(null);
      setNote("");
      setNoteTouched(false);
      router.refresh();
    }
  }

  async function mark(page: SuspectPage, status: "ok" | "rescan_required") {
    const result = await quality.run(batchId, page.fileId, Number(page.pageNo), status, "");
    if (result.ok) {
      toast.success(status === "ok" ? "Đã xác nhận trang đạt." : "Đã đánh dấu cần quét lại; lô chưa đóng được cho tới khi quét lại.");
      router.refresh();
    }
  }

  return (
    <div className="grid gap-4">
      {suspectPages.length > 0 && (
        <section className="grid gap-2 border border-warn bg-surface p-4" aria-labelledby="nghi-ngo">
          <h2 id="nghi-ngo" className="flex items-center gap-2 text-base font-bold"><AlertTriangle aria-hidden className="size-4 text-warn" /> Trang AI nghi ngờ ({suspectPages.length})</h2>
          <p className="text-[13px] text-muted">AI gắn cờ các trang có vẻ trắng, mờ hoặc nghiêng. Xem lại bản quét rồi xác nhận: đạt, hoặc cần quét lại.</p>
          <ul className="grid divide-y divide-line border border-line" aria-label="Trang nghi ngờ">
            {suspectPages.map((p) => (
              <li key={`${p.fileId}-${p.pageNo}`} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <Link href={`${routes.document(p.documentId)}?trang=${p.pageNo}&tep=${p.fileId}` as never} className="font-semibold text-primary hover:underline">{p.fileName} · trang {p.pageNo}</Link>
                {p.flags.map((flag) => <Chip key={flag} tone="warn">{ISSUE_TYPE[flag] ?? flag}</Chip>)}
                <Chip tone={p.status === "rescan_required" ? "bad" : "neutral"}>{PAGE_QUALITY[p.status] ?? p.status}</Chip>
                {writable && (
                  <span className="ml-auto flex flex-wrap gap-2">
                    {p.status !== "rescan_required" && <Button size="sm" onClick={() => mark(p, "rescan_required")} disabled={quality.pending} aria-label={`Đánh dấu cần quét lại ${p.fileName} trang ${p.pageNo}`}>Cần quét lại</Button>}
                    <Button size="sm" onClick={() => mark(p, "ok")} disabled={quality.pending} aria-label={`Xác nhận đạt ${p.fileName} trang ${p.pageNo}`}>Đạt</Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-2 border border-line bg-surface p-4" aria-labelledby="loi-anh">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="loi-anh" className="text-base font-bold">Lỗi ảnh {open.length > 0 ? <Chip tone="warn">{open.length} đang mở</Chip> : <Chip tone="ok">Không còn lỗi mở</Chip>}</h2>
          {writable && <Button size="sm" onClick={() => setAdding(true)}><Plus aria-hidden className="size-4" /> Ghi lỗi</Button>}
        </div>
        {issues.length === 0 ? (
          <p className="text-sm text-muted">Chưa có lỗi ảnh nào được ghi cho lô này.</p>
        ) : (
          <ul className="grid divide-y divide-line border border-line" aria-label="Lỗi ảnh">
            {[...open, ...done].map((i) => (
              <li key={i.id} className="grid gap-2 px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{nameOf(i.fileId)} · {pageLabel(i.pageNo)}</span>
                  <Chip>{ISSUE_TYPE[i.issueType] ?? i.issueType}</Chip>
                  <Chip tone={SEVERITY_TONE[i.severity] ?? "neutral"}>{SEVERITY[i.severity] ?? i.severity}</Chip>
                  <Chip tone={STATUS_TONE[i.status] ?? "neutral"}>{ISSUE_STATUS[i.status] ?? i.status}</Chip>
                  <span className="ml-auto text-xs text-muted">Ghi lúc {formatDateTime(i.raisedAt)}{i.resolvedAt ? ` · xử lý ${formatDateTime(i.resolvedAt)}` : ""}</span>
                </div>
                {i.description && <p className="text-muted">{i.description}</p>}
                {i.status === "open" && writable && (
                  skipping === i.id ? (
                    <div className="grid gap-2 border border-dashed border-line-strong p-2">
                      <label className="grid gap-1 text-[13px] font-semibold">
                        Lý do chấp nhận bỏ qua (từ {MIN_ACCEPT_NOTE} ký tự)
                        <textarea value={note} rows={2} onChange={(e) => setNote(e.target.value)} className="border border-line-strong bg-surface p-2 text-sm font-normal outline-none focus:border-primary" aria-invalid={noteTouched && noteProblem ? true : undefined} />
                      </label>
                      {noteTouched && noteProblem && <p role="alert" className="text-[13px] text-bad">{noteProblem}</p>}
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="primary" onClick={() => skip(i)} disabled={resolve.pending}>Chấp nhận bỏ qua</Button>
                        <Button size="sm" onClick={() => { setSkipping(null); setNote(""); setNoteTouched(false); }}>Hủy</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => markFixed(i)} disabled={resolve.pending}>Đã sửa</Button>
                      <Button size="sm" onClick={() => { setSkipping(i.id); setNote(""); setNoteTouched(false); }}>Chấp nhận bỏ qua…</Button>
                      {canReplace && i.documentId && <ReplaceScanDialog documentId={i.documentId} label={nameOf(i.fileId)} />}
                    </div>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <AddIssueDialog open={adding} onClose={() => setAdding(false)} batchId={batchId} files={files} />
    </div>
  );
}

function AddIssueDialog({ open, onClose, batchId, files }: { open: boolean; onClose: () => void; batchId: string; files: BatchFile[] }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [fileId, setFileId] = useState("");
  const [page, setPage] = useState("");
  const [type, setType] = useState<string>("blurry");
  const [severity, setSeverity] = useState("medium");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const action = useServerAction(createIssue, { toastErrors: false });
  const selected = files.find((f) => f.fileId === fileId);
  const pageNumber = page.trim() === "" ? null : Number(page);
  const pageProblem = pageNumber !== null && (!Number.isInteger(pageNumber) || pageNumber < 1 || (selected?.pageCount ? pageNumber > Number(selected.pageCount) : false))
    ? `Nhập số trang từ 1${selected?.pageCount ? ` đến ${selected.pageCount}` : ""}.` : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (pageProblem) return;
    const result = await action.run({ batchId, fileId: fileId || null, pageNo: fileId ? pageNumber : null, issueType: type, severity, description });
    if (result.ok) {
      toast.success("Đã ghi lỗi ảnh. Lô chưa đóng được cho tới khi xử lý lỗi.");
      setFileId(""); setPage(""); setDescription("");
      onClose();
      router.refresh();
    } else setFormError(result.errorId ? `${result.message} (Mã lỗi ${result.errorId})` : result.message);
  }

  const select = "h-9 border border-line-strong bg-surface px-2 text-sm font-normal outline-none focus:border-primary";
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Ghi lỗi ảnh"
      description="Ghi trang trắng, mờ, nghiêng, thiếu trang… Lỗi đang mở chặn đóng lô cho tới khi sửa hoặc chấp nhận bỏ qua."
      footer={<><Button onClick={onClose} disabled={action.pending}>Hủy</Button><Button variant="primary" type="submit" form={`${id}-form`} disabled={action.pending}>{action.pending ? "Đang ghi…" : "Ghi lỗi"}</Button></>}
    >
      <form id={`${id}-form`} onSubmit={submit} className="grid gap-3" noValidate>
        <label className="grid gap-1 text-[13px] font-semibold">Tệp
          <select value={fileId} onChange={(e) => setFileId(e.target.value)} className={select}>
            <option value="">Cả lô (không chỉ tệp nào)</option>
            {files.map((f) => <option key={f.fileId} value={f.fileId}>{f.fileName}</option>)}
          </select>
        </label>
        {fileId && (
          <label className="grid gap-1 text-[13px] font-semibold">Trang (bỏ trống nếu cả tệp)
            <input value={page} inputMode="numeric" onChange={(e) => setPage(e.target.value)} className={select} aria-invalid={pageProblem ? true : undefined} />
            {pageProblem && <span role="alert" className="text-[13px] font-normal text-bad">{pageProblem}</span>}
          </label>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-[13px] font-semibold">Loại lỗi
            <select value={type} onChange={(e) => setType(e.target.value)} className={select}>{ISSUE_TYPES.map((t) => <option key={t} value={t}>{ISSUE_TYPE[t]}</option>)}</select>
          </label>
          <label className="grid gap-1 text-[13px] font-semibold">Mức độ
            <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={select}>{Object.entries(SEVERITY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
        </div>
        <label className="grid gap-1 text-[13px] font-semibold">Mô tả
          <textarea value={description} rows={2} maxLength={1000} onChange={(e) => setDescription(e.target.value)} className="border border-line-strong bg-surface p-2 text-sm font-normal outline-none focus:border-primary" />
        </label>
        {formError && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{formError}</p>}
      </form>
    </Dialog>
  );
}
