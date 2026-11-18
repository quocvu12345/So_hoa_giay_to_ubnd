"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelAiJob, loadMoreAiJobs, retryAiJob } from "@/app/actions/ops";
import { Button } from "@/components/ui/button";
import { Chip, type Tone } from "@/components/ui/status-chip";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";
import { useServerAction } from "@/lib/use-server-action";
import type { AdminJobRow } from "./ops-data";
import { JOB_STATUS_LABELS, JOB_TYPE_LABELS, PRIORITY_KIND_LABELS, type JobFilter } from "./ops-rules";

const STATUS_TONE: Record<string, Tone> = { queued: "info", running: "info", completed: "ok", failed: "bad", cancelled: "neutral" };

/**
 * Danh sách việc AI cho quản trị (FE-44, BE-120). Chỉ có tên tệp, không có tiêu đề hay nội dung giấy tờ.
 * Hủy việc đang chờ/chạy; chạy lại việc lỗi/đã hủy bằng việc MỚI (việc cũ giữ làm lịch sử). Nút khóa kèm lý do do API tính.
 */
export function AiJobsList({ initial, initialCursor, filter }: { initial: AdminJobRow[]; initialCursor: string | null; filter: JobFilter }) {
  const router = useRouter();
  const toast = useToast();
  const [more, setMore] = useState<AdminJobRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [confirming, setConfirming] = useState<string | null>(null);
  const cancel = useServerAction(cancelAiJob);
  const retry = useServerAction(retryAiJob);
  const loadMore = useServerAction(loadMoreAiJobs);
  const seen = new Set(initial.map((j) => j.id));
  const items = [...initial, ...more.filter((j) => !seen.has(j.id))];

  async function doCancel(job: AdminJobRow) {
    const result = await cancel.run(job.id);
    setConfirming(null);
    if (result.ok) {
      toast.success(`Đã hủy việc đọc ${job.fileName}.`);
      router.refresh();
    } else if (result.status === 409) router.refresh();
  }

  async function doRetry(job: AdminJobRow) {
    const result = await retry.run(job.id);
    if (result.ok) {
      toast.success(`Đã xếp việc đọc mới cho ${job.fileName}.`);
      router.refresh();
    } else if (result.status === 409) router.refresh();
  }

  async function older() {
    if (!cursor) return;
    const result = await loadMore.run(filter, cursor);
    if (result.ok) {
      setMore((current) => [...current, ...result.data.items]);
      setCursor(result.data.nextCursor);
    }
  }

  if (items.length === 0) return <p className="border border-dashed border-line-strong p-4 text-sm text-muted">Không có việc nào ở bộ lọc này.</p>;
  const busy = cancel.pending || retry.pending;

  return (
    <div className="grid gap-3">
      <ul className="grid divide-y divide-line border border-line bg-surface" aria-label="Việc AI">
        {items.map((j) => (
          <li key={j.id} className="grid gap-1.5 px-3 py-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold break-all">{j.fileName}</span>
              <Chip tone={STATUS_TONE[j.status] ?? "neutral"}>{JOB_STATUS_LABELS[j.status] ?? j.status}</Chip>
              <Chip>{JOB_TYPE_LABELS[j.jobType] ?? j.jobType}</Chip>
              <Chip>{PRIORITY_KIND_LABELS[j.priorityKind] ?? j.priorityKind}</Chip>
              {j.retryOf && <Chip tone="info">Chạy lại</Chip>}
            </div>
            <p className="text-xs text-muted">
              {j.status === "running" || j.status === "queued" ? `${Number(j.processedPages)}/${j.pageCount ?? "?"} trang${j.stage ? ` · ${j.stage}` : ""} · ` : ""}
              {Number(j.attempts)} lần thử · tạo {formatDateTime(j.createdAt)}{j.finishedAt ? ` · xong ${formatDateTime(j.finishedAt)}` : ""}{j.requestedByName ? ` · ${j.requestedByName}` : ""}
            </p>
            {j.error && <p className="text-bad">{j.error}</p>}
            <div className="flex flex-wrap items-center gap-2">
              {j.canCancel && (
                confirming === j.id ? (
                  <>
                    <span className="text-[13px]">Hủy việc đọc này? Worker dừng sau trang hiện tại.</span>
                    <Button size="sm" variant="danger" onClick={() => doCancel(j)} disabled={busy}>Hủy việc</Button>
                    <Button size="sm" onClick={() => setConfirming(null)}>Giữ lại</Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => setConfirming(j.id)} disabled={busy} aria-label={`Hủy việc đọc ${j.fileName}`}>Hủy việc</Button>
                )
              )}
              {(j.status === "failed" || j.status === "cancelled") && (
                j.canRetry ? (
                  <Button size="sm" onClick={() => doRetry(j)} disabled={busy} aria-label={`Chạy lại việc đọc ${j.fileName}`}>Chạy lại</Button>
                ) : (
                  <span className="text-[13px] text-muted">Chưa chạy lại được: {j.retryBlockedReason ?? "không rõ lý do"}</span>
                )
              )}
            </div>
          </li>
        ))}
      </ul>
      {cursor && <div className="flex justify-center"><Button onClick={older} disabled={loadMore.pending}>{loadMore.pending ? "Đang tải…" : "Tải thêm"}</Button></div>}
    </div>
  );
}
