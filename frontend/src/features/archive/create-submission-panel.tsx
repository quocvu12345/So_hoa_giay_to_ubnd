"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSubmission } from "@/app/actions/archive";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { formatDate } from "@/lib/format";
import { useServerAction } from "@/lib/use-server-action";
import type { ReadyDossier } from "./archive-data";
import { MAX_DOSSIERS, MAX_NOTE, readProblems, toggleSelection, type ArchiveProblem } from "./archive-rules";

/**
 * Gom các hồ sơ chờ nộp lưu thành một đợt (FE-37, BE-84). Chọn nhiều hồ sơ (tối đa 200), ghi chú, tạo đợt. Hồ sơ không hợp lệ
 * (đã có đợt khác chưa xong, vừa đổi bước) được API báo từng hồ sơ; không tạo gì khi còn hồ sơ lỗi.
 */
export function CreateSubmissionPanel({ dossiers }: { dossiers: ReadyDossier[] }) {
  const router = useRouter();
  const id = useId();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [problems, setProblems] = useState<ArchiveProblem[]>([]);
  const action = useServerAction(createSubmission, { toastErrors: false });
  const allIds = dossiers.map((d) => d.id);
  const allSelected = allIds.length > 0 && allIds.every((x) => selected.has(x));

  function toggle(dossierId: string) {
    const { next, blocked } = toggleSelection(selected, dossierId);
    setSelected(next);
    setNotice(blocked ? `Một đợt tối đa ${MAX_DOSSIERS} hồ sơ.` : null);
  }

  function toggleAll() {
    setNotice(null);
    setSelected(allSelected ? new Set() : new Set(allIds.slice(0, MAX_DOSSIERS)));
    if (!allSelected && allIds.length > MAX_DOSSIERS) setNotice(`Đã chọn ${MAX_DOSSIERS} hồ sơ đầu; một đợt tối đa ${MAX_DOSSIERS} hồ sơ.`);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    setProblems([]);
    if (selected.size === 0) return setNotice("Chọn ít nhất một hồ sơ.");
    const result = await action.run([...selected], note);
    if (result.ok) router.push(routes.archiveSubmission(result.data.id));
    else {
      setProblems(readProblems(result.details));
      setNotice(result.errorId ? `${result.message} (Mã lỗi ${result.errorId})` : result.message);
    }
  }

  if (dossiers.length === 0) {
    return <p className="border border-dashed border-line-strong p-4 text-sm text-muted">Chưa có hồ sơ nào chờ nộp lưu. Hồ sơ đã đạt ở bước kiểm tra sẽ hiện ở đây.</p>;
  }

  return (
    <form onSubmit={submit} className="grid gap-3" noValidate>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="size-4 accent-primary" /> Chọn tất cả ({dossiers.length})</label>
        <span role="status" className="text-sm text-muted">Đã chọn {selected.size} hồ sơ</span>
      </div>
      <ul className="max-h-96 divide-y divide-line overflow-y-auto border border-line bg-surface" aria-label="Hồ sơ chờ nộp lưu">
        {dossiers.map((d) => {
          const problem = problems.find((p) => p.dossierId === d.id);
          return (
            <li key={d.id} className="px-3 py-2">
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} className="mt-1 size-4 accent-primary" aria-label={`Chọn hồ sơ ${d.code}`} />
                <span className="grid flex-1 gap-0.5">
                  <span className="flex flex-wrap items-center gap-2"><b>{d.code}</b>{d.title}{problem && <Chip tone="bad">Có vấn đề</Chip>}</span>
                  <span className="text-xs text-muted">{d.workGroupTitle} · {Number(d.documentCount)} giấy tờ · cập nhật {formatDate(d.updatedAt)}</span>
                  {problem && <span role="alert" className="text-[13px] text-bad">{problem.problem}</span>}
                </span>
                <Link href={routes.dossier(d.id)} className="text-xs text-primary hover:underline" onClick={(e) => e.stopPropagation()}>Mở</Link>
              </label>
            </li>
          );
        })}
      </ul>
      <label htmlFor={`${id}-note`} className="grid gap-1 text-[13px] font-semibold">Ghi chú của đợt (không bắt buộc)
        <textarea id={`${id}-note`} value={note} rows={2} maxLength={MAX_NOTE + 50} onChange={(e) => setNote(e.target.value)} className="border border-line-strong bg-surface p-2 text-sm font-normal outline-none focus:border-primary" />
      </label>
      {notice && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{notice}</p>}
      <div><Button type="submit" variant="primary" disabled={action.pending || selected.size === 0}>{action.pending ? "Đang tạo đợt…" : `Tạo đợt nộp lưu (${selected.size} hồ sơ)`}</Button></div>
    </form>
  );
}
