"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { replaceScan, type ReplacementResult } from "@/lib/api/client";
import { useAssignmentId } from "@/lib/auth/client-session";
import { friendlyMessage } from "@/lib/api/problem";
import { MAX_REPLACE_REASON, validateReplaceReason } from "./batch-rules";
import { checkFile } from "./upload-queue";

type Props = {
  documentId: string;
  /** Tên giấy tờ hoặc tệp hiện hành, để người dùng biết đang thay bản nào. */
  label: string;
  /** Có lý do thì nút khóa kèm lời giải thích (ví dụ giấy tờ đang trong hồ sơ chờ xử lý). */
  disabledReason?: string;
  size?: "sm" | "md";
};

/** Tóm tắt kết quả cho toast: nói rõ phiên bản mới, và các hệ quả người dùng cần biết. */
export function describeReplacement(result: ReplacementResult): string {
  const parts = [`Đã thay bằng bản quét phiên bản ${result.versionNo}. Bản cũ vẫn được giữ lại.`];
  if (result.issuesClosed > 0) parts.push(`Đã đóng ${result.issuesClosed} lỗi ảnh của bản cũ.`);
  if (result.reviewReset) parts.push("Giấy tờ đã xác nhận trước đó cần đối chiếu lại.");
  parts.push(result.classify ? "AI đang đọc và gợi ý lại." : "AI chỉ đọc lại chữ để tìm kiếm, không đổi dữ liệu đã đối chiếu.");
  return parts.join(" ");
}

/**
 * Nút + hộp thoại "Thay bản quét" (FE-33, FE-41, BE-126). Chọn PDF mới và ghi lý do (10–500 ký tự); tải bằng XHR có tiến độ thẳng tới API
 * (tệp lớn không đi qua Server Action). Bản cũ không bị xóa: vẫn xem được ở "Phiên bản tệp".
 */
export function ReplaceScanDialog({ documentId, label, disabledReason, size = "sm" }: Props) {
  const router = useRouter();
  const toast = useToast();
  const assignmentId = useAssignmentId();
  const ids = { file: useId(), reason: useId() };
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const busy = progress !== null;

  const fileProblem = file ? checkFile(file) : null;
  const reasonProblem = validateReplaceReason(reason);

  function close() {
    if (busy) return;
    setOpen(false);
    setFile(null);
    setReason("");
    setTouched(false);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    setError(null);
    if (!file || fileProblem || reasonProblem) return;
    abort.current = new AbortController();
    setProgress(0);
    const outcome = await replaceScan(documentId, file, reason.trim(), { assignmentId, onProgress: setProgress, signal: abort.current.signal });
    setProgress(null);
    if (outcome.kind === "done") {
      toast.success(describeReplacement(outcome.result));
      close();
      router.refresh();
    } else if (outcome.kind === "failed") {
      const { problem } = outcome;
      if (problem.status === 401) router.push(`/dang-nhap?tiep=${encodeURIComponent(window.location.pathname + window.location.search)}` as "/dang-nhap");
      else setError(problem.errorId ? `${friendlyMessage(problem)} (Mã lỗi ${problem.errorId})` : friendlyMessage(problem));
    }
  }

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)} disabled={Boolean(disabledReason)} title={disabledReason} aria-label={`Thay bản quét của ${label}`}>
        <RefreshCw aria-hidden className="size-4" /> Thay bản quét
      </Button>
      {disabledReason && <span className="sr-only">{disabledReason}</span>}
      <Dialog
        open={open}
        onClose={close}
        title="Thay bản quét"
        description={`Giấy tờ: ${label}. Bản cũ được giữ lại để truy vết; bản mới trở thành bản hiện hành. Giấy tờ đã xác nhận dữ liệu sẽ về "chờ xác nhận lại".`}
        footer={
          <>
            <Button onClick={() => (busy ? abort.current?.abort() : close())}>{busy ? "Hủy tải lên" : "Đóng"}</Button>
            <Button variant="primary" type="submit" form={`${ids.file}-form`} disabled={busy}>{busy ? `Đang tải ${Math.round((progress ?? 0) * 100)}%` : "Thay bản quét"}</Button>
          </>
        }
      >
        <form id={`${ids.file}-form`} onSubmit={submit} className="grid gap-3" noValidate>
          <label htmlFor={ids.file} className="grid gap-1 text-[13px] font-semibold">
            Bản quét mới (PDF)
            <input id={ids.file} type="file" accept="application/pdf,.pdf" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm font-normal" aria-describedby={touched && (!file || fileProblem) ? `${ids.file}-error` : undefined} />
          </label>
          {touched && (!file || fileProblem) && <p id={`${ids.file}-error`} role="alert" className="text-[13px] text-bad">{fileProblem ?? "Chọn tệp PDF bản quét mới."}</p>}

          <label htmlFor={ids.reason} className="grid gap-1 text-[13px] font-semibold">
            Lý do thay (bắt buộc)
            <textarea id={ids.reason} value={reason} rows={3} maxLength={MAX_REPLACE_REASON + 50} disabled={busy} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: Quét lại trang 3 bị mờ" className="border border-line-strong bg-surface p-2 text-sm font-normal outline-none focus:border-primary" aria-describedby={`${ids.reason}-hint`} />
            <span id={`${ids.reason}-hint`} className={reason.trim().length > MAX_REPLACE_REASON ? "text-bad" : "text-xs font-normal text-muted"}>{reason.trim().length}/{MAX_REPLACE_REASON} ký tự</span>
          </label>
          {touched && reasonProblem && <p role="alert" className="text-[13px] text-bad">{reasonProblem}</p>}

          {busy && <progress value={progress ?? 0} max={1} className="h-2 w-full" aria-label="Tiến độ tải lên" />}
          {error && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{error}</p>}
        </form>
      </Dialog>
    </>
  );
}
