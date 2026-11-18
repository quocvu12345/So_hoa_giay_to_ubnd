"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scissors, Undo2 } from "lucide-react";
import { splitDocument } from "@/app/actions/split";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { useServerAction } from "@/lib/use-server-action";
import { cutsToSegments, defaultTitle, MAX_TITLE, pagesIn, segmentLabel, thumbUrl, toggleCut, validateSplit, validateTitle } from "./split-rules";

type Props = { documentId: string; fileId: string; pageCount: number; initialCuts: number[]; baseTitle: string };

/**
 * Tách một PDF nhiều văn bản (FE-25, BE-51). Mỗi trang là một ảnh thu nhỏ; bấm "Tách ở đây" giữa hai trang để đặt điểm tách, bấm "Gộp lại" để gỡ.
 * Các phần dẫn xuất từ điểm tách nên luôn phủ kín 1..N trang, không chồng, không hở. Mỗi phần có thể đặt tên (bỏ trống: hệ thống đặt).
 * Xác nhận tạo các văn bản con vào hộp tiếp nhận; tệp gốc giữ nguyên. Chưa xác nhận thì "Bỏ hết điểm tách" là hoàn tác.
 */
export function SplitEditor({ documentId, fileId, pageCount, initialCuts, baseTitle }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [cuts, setCuts] = useState<number[]>(initialCuts);
  const [titles, setTitles] = useState<Record<number, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = useServerAction(splitDocument, { toastErrors: false });
  const segments = cutsToSegments(cuts, pageCount);
  const problem = validateSplit(cuts, pageCount);
  const titleFor = (from: number) => titles[from] ?? "";
  const titleList = segments.map((s) => titleFor(s.from));
  const titleProblem = titleList.map(validateTitle).find(Boolean) ?? null;

  async function submit() {
    setError(null);
    const result = await action.run(documentId, pageCount, cuts, titleList);
    if (result.ok) {
      toast.success(`Đã tách thành ${result.data.children.length} văn bản. Mỗi phần đã vào hộp tiếp nhận và được AI đọc riêng.`);
      router.push(routes.intake);
      router.refresh();
    } else {
      setConfirming(false);
      setError(result.errorId ? `${result.message} (Mã lỗi ${result.errorId})` : result.message);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 border border-line bg-surface p-3 text-sm">
        <span role="status" aria-live="polite"><b>{segments.length}</b> phần · <b>{pageCount}</b> trang · <b>{cuts.length}</b> điểm tách</span>
        <span className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setCuts([])} disabled={cuts.length === 0 || action.pending}><Undo2 aria-hidden className="size-4" /> Bỏ hết điểm tách</Button>
          <Button size="sm" variant="primary" onClick={() => { setError(null); setConfirming(true); }} disabled={Boolean(problem) || Boolean(titleProblem) || action.pending}><Scissors aria-hidden className="size-4" /> Tách thành {segments.length} văn bản…</Button>
        </span>
      </div>
      {problem && <p role="status" className="border border-dashed border-line-strong p-3 text-sm text-muted">{problem}</p>}
      {error && <p role="alert" className="border border-bad bg-bad-soft p-3 text-sm text-bad">{error}</p>}

      <ol className="grid gap-3" aria-label="Các phần sau khi tách">
        {segments.map((s, i) => (
          <li key={s.from} className="grid gap-2">
            <section className="grid gap-2 border border-line bg-surface p-3" aria-label={`Phần ${i + 1}: ${segmentLabel(s)}`}>
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid gap-0.5">
                  <h2 className="text-sm font-bold">Phần {i + 1} · {segmentLabel(s)}</h2>
                  <span className="text-xs text-muted">{pagesIn(s)} trang</span>
                </div>
                <label className="grid min-w-[240px] flex-1 gap-1 text-[13px] font-semibold">Tên văn bản (không bắt buộc)
                  <input value={titleFor(s.from)} maxLength={MAX_TITLE + 20} onChange={(e) => setTitles((c) => ({ ...c, [s.from]: e.target.value }))} placeholder={segments.length > 1 ? defaultTitle(baseTitle, i, segments.length) : baseTitle}
                    className="h-9 border border-line-strong bg-surface px-2 text-sm font-normal outline-none focus:border-primary" aria-invalid={validateTitle(titleFor(s.from)) ? true : undefined} />
                </label>
              </div>
              <ul className="flex flex-wrap items-center gap-2" aria-label={`Trang của phần ${i + 1}`}>
                {Array.from({ length: pagesIn(s) }, (_, n) => s.from + n).map((page) => (
                  <li key={page} className="flex items-center gap-1">
                    <figure className="grid gap-1">
                      {/* Ảnh trang qua cookie phân công (BE-118): <img> không gửi được header; ảnh WebP nhỏ, tải lười theo cuộn. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumbUrl(fileId, page)} alt={`Trang ${page}`} loading="lazy" width={96} height={136} className="h-[136px] w-24 border border-line bg-soft object-contain" />
                      <figcaption className="text-center text-xs text-muted">Trang {page}</figcaption>
                    </figure>
                    {page < s.to && (
                      <button type="button" onClick={() => setCuts((c) => toggleCut(c, page, pageCount))} aria-pressed={false} aria-label={`Tách ở đây, giữa trang ${page} và trang ${page + 1}`}
                        className="grid size-8 place-items-center border border-dashed border-line-strong text-muted hover:border-primary hover:text-primary"><Scissors aria-hidden className="size-4" /></button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
            {i < segments.length - 1 && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <span aria-hidden className="h-px flex-1 border-t border-dashed border-primary/60" />
                <button type="button" onClick={() => setCuts((c) => toggleCut(c, s.to, pageCount))} aria-pressed aria-label={`Gộp lại: gỡ điểm tách giữa trang ${s.to} và trang ${s.to + 1}`}
                  className={cn("inline-flex items-center gap-1 border border-primary bg-accent-soft px-2 py-1 font-semibold text-primary hover:bg-surface")}><Scissors aria-hidden className="size-3.5" /> Điểm tách sau trang {s.to} · gộp lại</button>
                <span aria-hidden className="h-px flex-1 border-t border-dashed border-primary/60" />
              </div>
            )}
          </li>
        ))}
      </ol>

      <Dialog open={confirming} onClose={() => !action.pending && setConfirming(false)} title={`Tách thành ${segments.length} văn bản?`}
        description="Mỗi phần thành một văn bản mới trong hộp tiếp nhận và được AI đọc riêng. Tệp gốc giữ nguyên, nhưng không tách lại được sau khi xác nhận."
        footer={<><Button onClick={() => setConfirming(false)} disabled={action.pending}>Xem lại</Button><Button variant="primary" onClick={submit} disabled={action.pending}>{action.pending ? "Đang tách…" : "Xác nhận tách"}</Button></>}>
        <ul className="grid gap-1 text-sm" aria-label="Tóm tắt các phần">
          {segments.map((s, i) => <li key={s.from}><b>{segmentLabel(s)}</b> · {titleFor(s.from).trim() || defaultTitle(baseTitle, i, segments.length)}</li>)}
        </ul>
      </Dialog>
    </div>
  );
}
