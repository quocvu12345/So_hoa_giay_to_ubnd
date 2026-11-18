"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { recordBackup, recordRestoreTest } from "@/app/actions/ops";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Chip } from "@/components/ui/status-chip";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";
import { useServerAction } from "@/lib/use-server-action";
import type { BackupRun, BackupStatus } from "./ops-data";
import { ageLabel, BACKUP_KIND_LABELS, BACKUP_STATUS_LABELS, formatBytes } from "./ops-rules";

/**
 * Sao lưu (FE-44, BE-88, BE-89): tình trạng tổng (đủ hạn không, đã diễn tập khôi phục gần đây chưa), từng loại sao lưu, các lần gần đây.
 * Script sao lưu tự báo kết quả bằng khóa máy; quản trị ghi tay khi sao lưu thủ công và ghi nhận đã diễn tập khôi phục.
 */
export function BackupsPanel({ status, runs }: { status: BackupStatus; runs: BackupRun[] }) {
  const router = useRouter();
  const toast = useToast();
  const [testing, setTesting] = useState<BackupRun | null>(null);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState("");
  const restore = useServerAction(recordRestoreTest, { toastErrors: false });
  const [error, setError] = useState<string | null>(null);

  async function confirmTest() {
    if (!testing) return;
    setError(null);
    const result = await restore.run(testing.id, note);
    if (result.ok) {
      toast.success("Đã ghi nhận lần diễn tập khôi phục.");
      setTesting(null);
      setNote("");
      router.refresh();
    } else setError(result.errorId ? `${result.message} (Mã lỗi ${result.errorId})` : result.message);
  }

  return (
    <div className="grid gap-4">
      <div role={status.healthy ? "status" : "alert"} className={status.healthy ? "flex items-start gap-2 border border-ok bg-ok-soft p-3 text-sm text-ok" : "grid gap-1 border border-bad bg-bad-soft p-3 text-sm text-bad"}>
        {status.healthy ? (
          <><CheckCircle2 aria-hidden className="mt-0.5 size-4 flex-none" /><p><b>Sao lưu đang ổn.</b> Mọi loại bắt buộc đều đủ hạn{status.lastRestoreTestedAt ? `; diễn tập khôi phục gần nhất ${formatDateTime(status.lastRestoreTestedAt)}` : ""}.</p></>
        ) : (
          <>
            <p className="flex items-center gap-2 font-bold"><AlertTriangle aria-hidden className="size-4" /> Sao lưu cần chú ý</p>
            <ul className="list-disc pl-5">{status.problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </>
        )}
      </div>

      <section className="grid gap-2 border border-line bg-surface p-4" aria-labelledby="loai-sao-luu">
        <h2 id="loai-sao-luu" className="text-base font-bold">Từng loại sao lưu</h2>
        <ul className="grid gap-2 sm:grid-cols-3" aria-label="Loại sao lưu">
          {status.kinds.map((k) => (
            <li key={k.kind} className="grid gap-1 border border-line p-3 text-sm">
              <span className="flex flex-wrap items-center gap-2 font-semibold">{BACKUP_KIND_LABELS[k.kind] ?? k.kind}{k.required ? <Chip tone="info">Bắt buộc</Chip> : <Chip>Tùy chọn</Chip>}</span>
              <span>{k.lastSuccessAt ? <>Thành công gần nhất <b>{ageLabel(k.ageHours == null ? null : Number(k.ageHours) * 3600)}</b> trước</> : "Chưa có lần thành công"}</span>
              {k.overdue && <Chip tone="bad">Quá hạn</Chip>}
              {k.lastRunStatus === "failed" && <Chip tone="bad">Lần chạy gần nhất thất bại</Chip>}
            </li>
          ))}
        </ul>
        {status.restoreTestOverdue && <p role="alert" className="text-sm text-warn">Đã lâu chưa diễn tập khôi phục. Khôi phục thử từ một bản sao lưu rồi ghi nhận bên dưới.</p>}
      </section>

      <section className="grid gap-2 border border-line bg-surface p-4" aria-labelledby="lan-sao-luu">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="lan-sao-luu" className="text-base font-bold">Các lần sao lưu gần đây</h2>
          <Button size="sm" onClick={() => setAdding(true)}>Ghi tay một lần sao lưu</Button>
        </div>
        {runs.length === 0 ? (
          <p className="text-sm text-muted">Chưa có lần sao lưu nào được ghi.</p>
        ) : (
          <ul className="grid divide-y divide-line border border-line" aria-label="Các lần sao lưu">
            {runs.map((b) => (
              <li key={b.id} className="grid gap-1 px-3 py-2.5 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <b>{BACKUP_KIND_LABELS[b.kind] ?? b.kind}</b>
                  <Chip tone={b.status === "succeeded" ? "ok" : b.status === "failed" ? "bad" : "info"}>{BACKUP_STATUS_LABELS[b.status] ?? b.status}</Chip>
                  <span className="text-xs text-muted">{formatDateTime(b.startedAt)}{b.finishedAt ? ` → ${formatDateTime(b.finishedAt)}` : ""} · {formatBytes(b.byteSize == null ? null : Number(b.byteSize))}</span>
                </span>
                {b.location && <span className="font-mono text-xs break-all text-muted">{b.location}</span>}
                {b.note && <span className="text-muted">{b.note}</span>}
                <span className="flex flex-wrap items-center gap-2">
                  {b.restoreTestedAt ? <Chip tone="ok">Đã diễn tập khôi phục {formatDateTime(b.restoreTestedAt)}</Chip> : b.status === "succeeded" && <Button size="sm" onClick={() => { setTesting(b); setNote(""); setError(null); }} aria-label={`Ghi nhận đã diễn tập khôi phục từ bản ${BACKUP_KIND_LABELS[b.kind] ?? b.kind} ${formatDateTime(b.startedAt)}`}>Ghi nhận đã diễn tập khôi phục</Button>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={testing !== null}
        onClose={() => !restore.pending && setTesting(null)}
        title="Ghi nhận đã diễn tập khôi phục"
        description="Xác nhận bạn đã khôi phục thử từ bản sao lưu này ra một nơi riêng và kiểm tra dữ liệu đọc được."
        footer={<><Button onClick={() => setTesting(null)} disabled={restore.pending}>Hủy</Button><Button variant="primary" onClick={confirmTest} disabled={restore.pending}>{restore.pending ? "Đang ghi…" : "Ghi nhận"}</Button></>}
      >
        <label className="grid gap-1 text-[13px] font-semibold">Ghi chú (không bắt buộc)
          <textarea value={note} rows={2} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Khôi phục sang máy thử, đối chiếu 20 hồ sơ ngẫu nhiên" className="border border-line-strong bg-surface p-2 text-sm font-normal outline-none focus:border-primary" />
        </label>
        {error && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{error}</p>}
      </Dialog>
      <AddBackupDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function AddBackupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [kind, setKind] = useState("database");
  const [result, setResult] = useState("succeeded");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const action = useServerAction(recordBackup, { toastErrors: false });
  const field = "h-9 border border-line-strong bg-surface px-2 text-sm font-normal outline-none focus:border-primary";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const outcome = await action.run({ kind, status: result, location, note });
    if (outcome.ok) {
      toast.success("Đã ghi nhận lần sao lưu.");
      setLocation(""); setNote("");
      onClose();
      router.refresh();
    } else setError(outcome.errorId ? `${outcome.message} (Mã lỗi ${outcome.errorId})` : outcome.message);
  }

  return (
    <Dialog open={open} onClose={() => !action.pending && onClose()} title="Ghi tay một lần sao lưu" description="Dùng khi sao lưu thủ công. Sao lưu tự động báo kết quả bằng khóa máy riêng, không cần ghi tay."
      footer={<><Button onClick={onClose} disabled={action.pending}>Hủy</Button><Button variant="primary" type="submit" form={`${id}-form`} disabled={action.pending}>{action.pending ? "Đang ghi…" : "Ghi nhận"}</Button></>}>
      <form id={`${id}-form`} onSubmit={submit} className="grid gap-3" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-[13px] font-semibold">Loại
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={field}>{Object.entries(BACKUP_KIND_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <label className="grid gap-1 text-[13px] font-semibold">Kết quả
            <select value={result} onChange={(e) => setResult(e.target.value)} className={field}><option value="succeeded">Thành công</option><option value="failed">Thất bại</option></select>
          </label>
        </div>
        <label className="grid gap-1 text-[13px] font-semibold">Nơi lưu
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ví dụ: /mnt/backup/hoso-20261118.dump" className={field} autoComplete="off" />
        </label>
        <label className="grid gap-1 text-[13px] font-semibold">Ghi chú
          <textarea value={note} rows={2} onChange={(e) => setNote(e.target.value)} className="border border-line-strong bg-surface p-2 text-sm font-normal outline-none focus:border-primary" />
        </label>
        {error && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{error}</p>}
      </form>
    </Dialog>
  );
}
