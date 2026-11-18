"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { closeBatch } from "@/app/actions/batches";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useServerAction } from "@/lib/use-server-action";
import { closeWarning, MIN_ACCEPT_NOTE, validateNote } from "./batch-rules";

/**
 * Đóng lô (FE-41, BE-40, BE-125). Hết lỗi thì xác nhận một bước. Còn lỗi ảnh mở thì cảnh báo nhưng VẪN cho đóng: phải ghi lý do
 * chấp nhận bỏ qua (từ 10 ký tự); lý do được ghi vào từng lỗi cùng người và thời điểm xử lý.
 */
export function CloseBatchButton({ batchId, openIssues }: { batchId: string; openIssues: number }) {
  const router = useRouter();
  const toast = useToast();
  const noteId = useId();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const action = useServerAction(closeBatch, { toastErrors: false });
  const warning = closeWarning(openIssues);
  const noteProblem = warning ? validateNote(note) : null;

  function close() {
    if (action.pending) return;
    setOpen(false);
    setNote("");
    setTouched(false);
    setFormError(null);
  }

  async function confirm() {
    setTouched(true);
    setFormError(null);
    if (noteProblem) return;
    const result = await action.run(batchId, warning ? note.trim() : undefined);
    if (result.ok) {
      toast.success(warning ? `Đã đóng lô; ${openIssues} lỗi ảnh được ghi là chấp nhận bỏ qua.` : "Đã đóng lô quét.");
      setOpen(false);
      router.refresh();
    } else if (result.status === 409) {
      // Có người vừa mở lỗi mới hoặc đóng lô trước: tải lại để thấy tình trạng mới rồi bấm lại.
      setFormError(`${result.message} Trang sẽ tải lại để cập nhật.`);
      router.refresh();
    } else {
      setFormError(result.errorId ? `${result.message} (Mã lỗi ${result.errorId})` : result.message);
    }
  }

  return (
    <>
      <Button variant={openIssues > 0 ? "secondary" : "primary"} onClick={() => setOpen(true)}><Lock aria-hidden className="size-4" /> Đóng lô</Button>
      <Dialog
        open={open}
        onClose={close}
        title="Đóng lô quét"
        description={warning ?? "Đóng lô xong không nạp thêm tệp vào lô này nữa. Số trang đã quét được chốt theo các bản quét hiện hành."}
        footer={
          <>
            <Button onClick={close} disabled={action.pending}>Giữ lô mở</Button>
            <Button variant="primary" onClick={confirm} disabled={action.pending}>{action.pending ? "Đang đóng…" : warning ? `Chấp nhận bỏ qua ${openIssues} lỗi và đóng lô` : "Đóng lô"}</Button>
          </>
        }
      >
        {warning && (
          <div className="grid gap-1">
            <label htmlFor={noteId} className="text-[13px] font-semibold">Lý do chấp nhận bỏ qua (từ {MIN_ACCEPT_NOTE} ký tự)</label>
            <textarea id={noteId} value={note} rows={3} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Bản gốc đã mờ sẵn, không quét tốt hơn được" className="border border-line-strong bg-surface p-2 text-sm outline-none focus:border-primary" aria-invalid={touched && noteProblem ? true : undefined} aria-describedby={touched && noteProblem ? `${noteId}-error` : undefined} />
            {touched && noteProblem && <p id={`${noteId}-error`} role="alert" className="text-[13px] text-bad">{noteProblem}</p>}
          </div>
        )}
        {formError && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{formError}</p>}
      </Dialog>
    </>
  );
}
