"use client";

import { useEffect, useState } from "react";
import { addDocuments } from "@/app/actions/dossier";
import { searchDossiers } from "@/app/actions/file-dossier";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { useServerAction } from "@/lib/use-server-action";
import type { DossierListItem } from "@/features/dossier/dossier-data";

/** Hồ sơ còn nhận giấy tờ: Đang chuẩn bị hoặc Yêu cầu bổ sung (cùng luật với bước xếp hồ sơ). */
const ACCEPTING = ["draft", "returned"];

/**
 * Xếp nhiều PDF đã đọc xong vào CÙNG MỘT hồ sơ (FE-21): tìm hồ sơ theo mã hoặc tên, chọn, thêm. Mỗi PDF một lệnh (BE-62), PDF nào lỗi báo riêng.
 * Chỉ dựng khi đang mở nên mỗi lần mở là trạng thái mới. Đối chiếu từng giấy tờ làm sau ở màn đối chiếu hoặc tab Giấy tờ của hồ sơ.
 */
export function BulkFileDialog({ documentIds, skipped, onClose, onDone }: { documentIds: string[]; skipped: number; onClose: () => void; onDone: (filed: number, dossier: DossierListItem) => void }) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DossierListItem[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const find = useServerAction(searchDossiers, { toastErrors: false });
  const add = useServerAction(addDocuments, { toastErrors: false });

  // Tìm sau khi ngừng gõ 300 ms; kết quả về muộn của lần gõ cũ bị bỏ.
  useEffect(() => {
    const text = query.trim();
    let stale = false;
    const timer = setTimeout(async () => {
      if (text.length < 2) {
        setResults(null);
        return;
      }
      const outcome = await find.run(text);
      if (!stale && outcome.ok) setResults(outcome.data);
    }, 300);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
    // `find.run` đổi theo mỗi lần render của hook; chỉ cần chạy lại khi câu hỏi đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const chosen = results?.find((d) => d.id === selected);

  async function submit() {
    if (!chosen) return;
    setFailure(null);
    const outcome = await add.run(chosen.id, documentIds);
    if (!outcome.ok) {
      setFailure(outcome.errorId ? `${outcome.message} (Mã lỗi: ${outcome.errorId})` : outcome.message);
      return;
    }
    const { added, failures } = outcome.data;
    if (failures.length > 0) {
      setFailure(`Đã xếp ${added}; ${failures.length} PDF chưa xếp được: ${[...new Set(failures.map((f) => f.message))].join(" ")}`);
      if (added > 0) onDone(added, chosen);          // phần đã xếp làm mới danh sách; hộp thoại giữ mở để thấy lỗi
      return;
    }
    toast.success(`Đã xếp ${added} PDF vào hồ sơ ${chosen.code}.`);
    onDone(added, chosen);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Xếp ${documentIds.length} PDF vào một hồ sơ`}
      description={skipped > 0 ? `${skipped} PDF chưa đọc xong được bỏ qua (xếp sau khi AI đọc xong).` : "Chọn hồ sơ đang chuẩn bị hoặc yêu cầu bổ sung. Chiều luân chuyển đặt là Đến, đổi ở tab Giấy tờ của hồ sơ."}
      className="w-[min(40rem,calc(100vw-2rem))]"
      footer={
        <>
          <Button onClick={onClose}>Đóng</Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!chosen || add.pending || documentIds.length === 0} aria-busy={add.pending}>
            {add.pending ? "Đang xếp…" : `Xếp ${documentIds.length} PDF`}
          </Button>
        </>
      }
    >
      <div className="grid gap-2">
        <Input label="Tìm hồ sơ" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Mã hoặc tên hồ sơ…" />
        <p role="status" aria-live="polite" className="text-xs text-muted">
          {find.pending ? "Đang tìm…" : results ? (results.length === 0 ? "Không có hồ sơ nào khớp trong phạm vi của bạn." : `${results.length} hồ sơ khớp.`) : "Gõ ít nhất 2 ký tự."}
        </p>
        {results && results.length > 0 && (
          <fieldset className="grid max-h-[40vh] gap-1.5 overflow-auto">
            <legend className="sr-only">Chọn hồ sơ</legend>
            {results.map((d) => {
              const ok = ACCEPTING.includes(d.status);
              return (
                <label key={d.id} className={cn("flex flex-wrap items-center gap-3 border border-line p-2.5 has-checked:border-primary has-checked:bg-accent-soft", ok ? "cursor-pointer" : "cursor-not-allowed opacity-60")}>
                  <input type="radio" name="bulk-dossier" value={d.id} checked={selected === d.id} disabled={!ok} onChange={() => setSelected(d.id)} className="accent-primary" />
                  <span className="grid min-w-0 flex-1 gap-0.5 text-sm">
                    <span className="font-mono text-xs text-muted">{d.code} · {d.workGroupCode} {d.workGroupTitle}</span>
                    <span className="font-semibold">{d.title}</span>
                    {!ok && <span className="text-xs text-warn">Đang ở bước “{d.statusLabel}”, không thêm giấy tờ được.</span>}
                  </span>
                  <span className="text-xs text-muted tabular-nums">{d.documentCount} giấy tờ</span>
                </label>
              );
            })}
          </fieldset>
        )}
        {failure && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{failure}</p>}
      </div>
    </Dialog>
  );
}
