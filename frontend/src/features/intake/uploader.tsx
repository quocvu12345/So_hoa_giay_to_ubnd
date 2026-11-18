"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileText, Loader2, RotateCw, UploadCloud, X } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { createBrowserApi, uploadPdf } from "@/lib/api/client";
import { friendlyMessage } from "@/lib/api/problem";
import { useAssignmentId } from "@/lib/auth/client-session";
import { cn } from "@/lib/cn";
import { useServerEvent } from "@/lib/events/server-events";
import { waitingLabel } from "@/lib/ai-queue";
import { toQueueKind } from "./ai-status";
import { progressLabel } from "./inbox-live";
import { checkFile, duplicateDocumentId, formatBytes, nextToStart, type UploadItem } from "./upload-queue";

export type BatchOption = { id: string; code: string; label: string };

/** Tình trạng đọc của một tệp đã tải lên xong, lấy từ GET /jobs/{id} rồi cập nhật qua SSE. */
type ReadState = { stage: "queued" | "reading" | "ready" | "failed" | "cancelled"; text: string };

const LAST_BATCH_KEY = "hoso:last-batch";

function newId() {
  return crypto.randomUUID();
}

/**
 * Bước 1 · Nạp PDF (FE-21): kéo thả hoặc chọn nhiều tệp, tải 3 tệp song song bằng XHR để có tiến độ, hủy từng tệp,
 * báo trùng kèm liên kết tới giấy tờ cũ, báo sai định dạng ngay tại tệp đó. Sau khi tải xong, tiến độ đọc của AI cập nhật qua SSE.
 */
/** `presetBatchId`: lô chọn sẵn khi mở từ trang lô quét (`?lo=`); thắng lô nhớ lần trước. Không còn trong danh sách lô mở thì bỏ qua. */
export function Uploader({ batches, presetBatchId }: { batches: BatchOption[]; presetBatchId?: string | null }) {
  const inputId = useId();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [reads, setReads] = useState<Record<string, ReadState>>({});
  const [dragging, setDragging] = useState(false);
  const [batchId, setBatchId] = useState<string>("");
  const assignmentId = useAssignmentId();
  const files = useRef(new Map<string, File>());
  const controllers = useRef(new Map<string, AbortController>());
  const inputRef = useRef<HTMLInputElement>(null);

  // Nhớ lô vừa dùng; không còn trong danh sách lô mở thì bỏ qua.
  useEffect(() => {
    try {
      const saved = presetBatchId && batches.some((b) => b.id === presetBatchId) ? presetBatchId : localStorage.getItem(LAST_BATCH_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage chỉ có ở trình duyệt; đọc ở lần render đầu sẽ lệch với HTML máy chủ gửi về
      if (saved && batches.some((b) => b.id === saved)) setBatchId(saved);
    } catch {
      /* Không đọc được bộ nhớ trình duyệt thì thôi, không ảnh hưởng nạp tệp. */
    }
  }, [batches, presetBatchId]);

  const patch = useCallback((id: string, change: Partial<UploadItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)));
  }, []);

  const loadRead = useCallback(
    async (jobId: string) => {
      let data;
      try {
        ({ data } = await createBrowserApi(assignmentId).GET("/api/v1/jobs/{id}", { params: { path: { id: jobId } } }));
      } catch {
        return; // Mất mạng thoáng qua: tiến độ sẽ cập nhật ở sự kiện SSE kế tiếp.
      }
      if (!data) return;
      const stage = data.status === "running" ? "reading" : data.status === "completed" ? "ready" : data.status === "failed" ? "failed" : data.status === "cancelled" ? "cancelled" : "queued";
      const text =
        stage === "queued"
          ? waitingLabel(toQueueKind(data.queueKind), data.queuePosition, data.etaSeconds)
          : stage === "reading"
            ? progressLabel({ processed: data.processedPages, pageCount: data.pageCount })
            : stage === "ready"
              ? "Đã đọc xong"
              : stage === "failed"
                ? "Đọc lỗi"
                : "Đã hủy đọc";
      setReads((current) => ({ ...current, [jobId]: { stage, text } }));
    },
    [assignmentId],
  );

  const start = useCallback(
    async (id: string, batch: string) => {
      const file = files.current.get(id);
      if (!file) return;
      const controller = new AbortController();
      controllers.current.set(id, controller);
      patch(id, { status: "uploading", progress: 0, message: undefined });
      const outcome = await uploadPdf(file, { assignmentId, batchId: batch || null, signal: controller.signal, onProgress: (progress) => patch(id, { progress }) });
      controllers.current.delete(id);
      if (outcome.kind === "cancelled") {
        patch(id, { status: "cancelled", message: "Đã hủy tải lên.", retryable: true });
        return;
      }
      if (outcome.kind === "failed") {
        const { problem } = outcome;
        if (problem.status === 409 && problem.code === "duplicate_file") {
          patch(id, { status: "duplicate", progress: 1, message: problem.message, duplicateDocumentId: duplicateDocumentId(problem.details) });
        } else {
          const message = problem.errors?.file?.[0] ?? problem.errors?.File?.[0] ?? friendlyMessage(problem);
          // Lỗi tạm thời (mất mạng, máy chủ bận, quá tải) thì giữ tệp để bấm Thử lại; lỗi do chính tệp thì bỏ.
          const temporary = problem.status === 0 || problem.status === 429 || problem.status >= 500;
          patch(id, { status: "failed", message, errorId: problem.errorId, retryable: temporary });
          if (!temporary) files.current.delete(id);
          return;
        }
        files.current.delete(id);
        return;
      }
      files.current.delete(id);
      patch(id, { status: "done", progress: 1, documentId: outcome.result.documentId, jobId: outcome.result.jobId });
      void loadRead(outcome.result.jobId);
    },
    [patch, assignmentId, loadRead],
  );

  // Giữ tối đa 3 tệp đang tải; mỗi lần danh sách đổi thì nhận thêm tệp từ hàng chờ.
  useEffect(() => {
    for (const id of nextToStart(items)) void start(id, batchId);
  }, [items, batchId, start]);

  const readByJob = useRef(reads);
  useEffect(() => {
    readByJob.current = reads;
  });
  const jobIds = items.flatMap((i) => (i.jobId ? [i.jobId] : []));
  useServerEvent("job.progress", (event) => {
    if (!jobIds.includes(event.jobId)) return;
    if (event.processed != null) setReads((current) => ({ ...current, [event.jobId]: { stage: "reading", text: progressLabel({ processed: event.processed ?? 0, pageCount: event.pageCount ?? null }) } }));
    else void loadRead(event.jobId);
  });
  const onEnd = (event: { jobId: string }) => {
    if (jobIds.includes(event.jobId)) void loadRead(event.jobId);
  };
  useServerEvent("job.completed", onEnd);
  useServerEvent("job.failed", onEnd);
  useServerEvent("job.cancelled", onEnd);
  useServerEvent("resync", () => jobIds.forEach((id) => void loadRead(id)));

  function add(list: FileList | File[]) {
    const added: UploadItem[] = [];
    for (const file of Array.from(list)) {
      const id = newId();
      const problem = checkFile(file);
      added.push({ id, fileName: file.name, size: file.size, status: problem ? "failed" : "waiting", progress: 0, message: problem ?? undefined });
      if (!problem) files.current.set(id, file);
    }
    if (added.length > 0) setItems((current) => [...current, ...added]);
  }

  function cancel(id: string) {
    const controller = controllers.current.get(id);
    if (controller) controller.abort();
    else {
      patch(id, { status: "cancelled", message: "Đã hủy tải lên.", retryable: true });
    }
  }

  function retry(id: string) {
    // Chỉ tệp còn giữ trong bộ nhớ mới thử lại được (lỗi tạm thời hoặc người dùng đã hủy).
    if (!files.current.has(id)) return;
    patch(id, { status: "waiting", progress: 0, message: undefined, errorId: undefined, retryable: false });
  }

  function changeBatch(value: string) {
    setBatchId(value);
    try {
      if (value) localStorage.setItem(LAST_BATCH_KEY, value);
      else localStorage.removeItem(LAST_BATCH_KEY);
    } catch {
      /* Bỏ qua. */
    }
  }

  const uploaded = items.filter((i) => i.status === "done").length;
  const active = items.some((i) => i.status === "waiting" || i.status === "uploading");

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label htmlFor="lo-quet" className="font-semibold">Lô quét</label>
        <select id="lo-quet" value={batchId} onChange={(e) => changeBatch(e.target.value)} className="h-9 min-w-56 border border-line-strong bg-surface px-2">
          <option value="">Không thuộc lô nào</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </select>
        <span className="text-xs text-muted">Chọn trước khi nạp; tệp đã tải không đổi lô được.</span>
      </div>

      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        className={cn(
          "grid cursor-pointer justify-items-center gap-2 border-2 border-dashed bg-surface px-6 py-12 text-center focus-within:border-primary hover:border-primary hover:bg-soft",
          dragging ? "border-primary bg-soft" : "border-line-strong",
        )}
      >
        <UploadCloud aria-hidden className="size-10 text-primary" />
        <span className="text-lg font-bold text-heading">Kéo thả PDF vào đây hoặc bấm để chọn</span>
        <span className="text-sm text-muted">Nhiều tệp một lúc · tối đa {formatBytes(200 * 1024 * 1024)} mỗi tệp · chỉ nhận PDF</span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {items.length > 0 && (
        <section aria-label="Tiến độ nạp" className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">
              Đã nạp {uploaded}/{items.length} tệp{active ? " · đang tải…" : ""}
            </h2>
            <div className="flex gap-2">
              {!active && (
                <Button size="sm" variant="ghost" onClick={() => setItems((current) => current.filter((i) => i.status === "done"))}>
                  Xóa tệp lỗi khỏi danh sách
                </Button>
              )}
              <ButtonLink size="sm" variant={active ? "secondary" : "primary"} href={routes.intake}>Mở hộp tiếp nhận</ButtonLink>
            </div>
          </div>
          <ul className="grid gap-1.5" role="list">
            {items.map((item) => (
              <UploadRow key={item.id} item={item} read={item.jobId ? reads[item.jobId] : undefined} onCancel={() => cancel(item.id)} onRetry={() => retry(item.id)} />
            ))}
          </ul>
          <p role="status" aria-live="polite" className="sr-only">
            {uploaded} trên {items.length} tệp đã nạp
          </p>
        </section>
      )}
    </div>
  );
}

function UploadRow({ item, read, onCancel, onRetry }: { item: UploadItem; read?: ReadState; onCancel: () => void; onRetry: () => void }) {
  const percent = Math.round(item.progress * 100);
  return (
    <li className="grid gap-1.5 border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-3">
        <FileText aria-hidden className="size-5 flex-none text-muted" />
        <span className="min-w-0 flex-1 font-semibold break-all">{item.fileName}</span>
        <span className="text-xs text-muted tabular-nums">{formatBytes(item.size)}</span>
        {item.status === "waiting" && <Chip>Đang chờ tới lượt</Chip>}
        {item.status === "uploading" && <Chip tone="info"><Loader2 aria-hidden className="size-3 animate-spin" /> Đang tải {percent}%</Chip>}
        {item.status === "done" && <Chip tone="ok"><CheckCircle2 aria-hidden className="size-3" /> Đã nạp</Chip>}
        {item.status === "duplicate" && <Chip tone="warn">Tệp trùng</Chip>}
        {item.status === "failed" && <Chip tone="bad">Không nạp được</Chip>}
        {item.status === "cancelled" && <Chip>Đã hủy</Chip>}
        {(item.status === "waiting" || item.status === "uploading") && (
          <Button size="sm" variant="ghost" onClick={onCancel} aria-label={`Hủy tải ${item.fileName}`}>
            <X aria-hidden className="size-4" /> Hủy
          </Button>
        )}
        {(item.status === "failed" || item.status === "cancelled") && item.retryable && (
          <Button size="sm" onClick={onRetry} aria-label={`Thử tải lại ${item.fileName}`}>
            <RotateCw aria-hidden className="size-4" /> Thử lại
          </Button>
        )}
      </div>

      {item.status === "uploading" && (
        <div role="progressbar" aria-label={`Tiến độ tải ${item.fileName}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-1.5 bg-soft">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      )}

      {item.status === "done" && read && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Chip tone={read.stage === "ready" ? "ok" : read.stage === "failed" ? "bad" : read.stage === "reading" ? "info" : "neutral"}>{read.text}</Chip>
          {read.stage === "ready" && item.documentId && (
            <Link href={routes.intakeReview(item.documentId)} className="font-semibold text-primary hover:underline">Đối chiếu ngay →</Link>
          )}
        </p>
      )}

      {item.status === "duplicate" && (
        <p className="text-sm text-warn">
          {item.message}{" "}
          {item.duplicateDocumentId && (
            <Link href={routes.intakeReview(item.duplicateDocumentId)} className="font-semibold text-primary hover:underline">Mở giấy tờ đã có</Link>
          )}
        </p>
      )}
      {(item.status === "failed" || item.status === "cancelled") && item.message && (
        <p className="text-sm text-bad" role="alert">
          {item.message}
          {item.errorId && <span className="ml-1 text-xs text-muted">Mã lỗi: <span className="font-mono">{item.errorId}</span></span>}
        </p>
      )}
    </li>
  );
}
