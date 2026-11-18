"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { addRelation, removeRelation, searchDocumentChoices, type DocumentChoice } from "@/app/actions/relations";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/config/routes";
import { useServerAction } from "@/lib/use-server-action";
import type { Relation as DocumentRelation } from "./document-data";
import { RELATION_LABELS } from "./labels";

/** `direction` do API trả: "outgoing" (văn bản này khai) hoặc "incoming" (văn bản kia khai). */
export const OUTGOING = "outgoing";

const failure = (r: { message: string; errorId?: string }) => (r.errorId ? `${r.message} (Mã lỗi ${r.errorId})` : r.message);

/**
 * Liên kết văn bản (FE-33, BE-50): phụ lục, thay thế, sửa đổi, trả lời, liên quan. Người có quyền sửa thêm liên kết tới văn bản khác trong phạm vi và gỡ liên kết
 * do chính văn bản này khai ("outgoing"); liên kết do văn bản kia khai ("incoming") gỡ ở trang văn bản kia. API từ chối liên kết tạo vòng và trùng.
 */
export function RelationsEditor({ documentId, relations, canEdit }: { documentId: string; relations: DocumentRelation[]; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("related");
  const [q, setQ] = useState("");
  const [choices, setChoices] = useState<DocumentChoice[]>([]);
  const [picked, setPicked] = useState<DocumentChoice | null>(null);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const search = useServerAction(searchDocumentChoices, { toastErrors: false });
  const add = useServerAction(addRelation, { toastErrors: false });
  const remove = useServerAction(removeRelation, { toastErrors: false });
  useEffect(() => () => clearTimeout(timer.current), []);

  function reset() {
    setKind("related"); setQ(""); setChoices([]); setPicked(null); setNote(""); setTouched(false); setError(null);
  }

  function onQuery(value: string) {
    setQ(value);
    clearTimeout(timer.current);
    if (value.trim().length < 2) return setChoices([]);
    timer.current = setTimeout(async () => {
      const result = await search.run(value);
      if (result.ok) setChoices(result.data.filter((c) => c.id !== documentId));
    }, 300);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    setError(null);
    if (!picked) return;
    const result = await add.run(documentId, picked.id, kind, note);
    if (result.ok) { toast.success("Đã thêm liên kết."); reset(); setOpen(false); router.refresh(); } else setError(failure(result));
  }

  async function doRemove(r: DocumentRelation) {
    setMessage(null);
    const result = await remove.run(documentId, r.otherDocumentId, r.relation);
    if (result.ok) { toast.success("Đã gỡ liên kết."); router.refresh(); } else setMessage(failure(result));
  }

  return (
    <div className="grid gap-2">
      {relations.length === 0 ? (
        <p className="text-sm text-muted">Chưa có liên kết (phụ lục, thay thế, sửa đổi, trả lời).</p>
      ) : (
        <ul className="grid gap-1.5 text-sm" aria-label="Liên kết văn bản">
          {relations.map((r) => {
            const label = RELATION_LABELS[r.relation] ?? { out: r.relation, in: r.relation };
            return (
              <li key={`${r.otherDocumentId}-${r.relation}-${r.direction}`} className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted">{r.direction === OUTGOING ? label.out : label.in}:</span>
                <Link href={routes.document(r.otherDocumentId)} className="font-semibold text-primary hover:underline">{r.otherNumber ? `${r.otherNumber} · ` : ""}{r.otherTitle}</Link>
                {r.note && <span className="text-xs text-muted">({r.note})</span>}
                {canEdit && r.direction === OUTGOING && (
                  <button type="button" onClick={() => doRemove(r)} disabled={remove.pending} aria-label={`Gỡ liên kết ${label.out} ${r.otherTitle}`} className="ml-1 grid size-6 place-items-center text-muted hover:text-bad"><X aria-hidden className="size-4" /></button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {message && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{message}</p>}
      {canEdit && <div><Button size="sm" onClick={() => { reset(); setOpen(true); }}><Plus aria-hidden className="size-4" /> Thêm liên kết</Button></div>}

      <Dialog open={open} onClose={() => { if (!add.pending) { reset(); setOpen(false); } }} title="Thêm liên kết văn bản" description="Liên kết từ văn bản này tới một văn bản khác trong phạm vi của bạn."
        className="w-[min(40rem,calc(100vw-2rem))]"
        footer={<><Button onClick={() => { reset(); setOpen(false); }} disabled={add.pending}>Hủy</Button><Button variant="primary" type="submit" form={`${id}-form`} disabled={add.pending}>{add.pending ? "Đang thêm…" : "Thêm liên kết"}</Button></>}>
        <form id={`${id}-form`} onSubmit={submit} className="grid gap-3" noValidate>
          <label className="grid gap-1 text-[13px] font-semibold">Văn bản này
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-9 border border-line-strong bg-surface px-2 text-sm font-normal outline-none focus:border-primary">
              {Object.entries(RELATION_LABELS).map(([value, l]) => <option key={value} value={value}>{l.out}…</option>)}
            </select>
          </label>
          {picked ? (
            <div className="flex flex-wrap items-center gap-2 border border-ok bg-ok-soft p-2 text-sm"><span className="flex-1"><b>{picked.title}</b>{picked.number ? ` · ${picked.number}` : ""}</span><Button size="sm" onClick={() => setPicked(null)}>Chọn văn bản khác</Button></div>
          ) : (
            <div className="grid gap-1">
              <label htmlFor={`${id}-q`} className="text-[13px] font-semibold">Văn bản cần liên kết</label>
              <input id={`${id}-q`} type="search" value={q} onChange={(e) => onQuery(e.target.value)} placeholder="Gõ số ký hiệu hoặc trích yếu, không cần dấu…" autoComplete="off" className="h-9 border border-line-strong bg-surface px-2 text-sm outline-none focus:border-primary" />
              <ul className="max-h-48 divide-y divide-line overflow-y-auto border border-line" aria-label="Kết quả tìm văn bản">
                {choices.length === 0 && <li className="px-3 py-2 text-sm text-muted">{q.trim().length < 2 ? "Gõ ít nhất 2 ký tự để tìm." : search.pending ? "Đang tìm…" : "Không thấy văn bản khớp trong phạm vi của bạn."}</li>}
                {choices.map((c) => <li key={c.id}><button type="button" onClick={() => setPicked(c)} className="grid w-full gap-0.5 px-3 py-2 text-left text-sm hover:bg-soft"><span className="font-semibold">{c.title}</span><span className="text-xs text-muted">{[c.number, c.subtitle].filter(Boolean).join(" · ")}</span></button></li>)}
              </ul>
              {touched && <p role="alert" className="text-[13px] text-bad">Chọn văn bản cần liên kết.</p>}
            </div>
          )}
          <label className="grid gap-1 text-[13px] font-semibold">Ghi chú (không bắt buộc)
            <input value={note} maxLength={520} onChange={(e) => setNote(e.target.value)} className="h-9 border border-line-strong bg-surface px-2 text-sm font-normal outline-none focus:border-primary" />
          </label>
          {error && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{error}</p>}
        </form>
      </Dialog>
    </div>
  );
}
