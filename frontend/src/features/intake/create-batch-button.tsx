"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createBatch } from "@/app/actions/batches";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { routes } from "@/config/routes";
import { useServerAction } from "@/lib/use-server-action";
import { BATCH_LIMITS, validateBatchForm, type BatchFormErrors, type BatchFormInput } from "./batch-rules";

const EMPTY: BatchFormInput = { handedOverBy: "", boxLabel: "", expectedSheets: "", note: "" };

/** Tạo lô quét (FE-41, BE-40): mọi ô đều không bắt buộc. Tạo xong mở thẳng trang lô để nạp PDF. */
export function CreateBatchButton() {
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState<BatchFormInput>(EMPTY);
  const [errors, setErrors] = useState<BatchFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  // Hộp thoại modal làm vùng toast bị vô hiệu: lỗi hiện ngay trong hộp thoại.
  const action = useServerAction(createBatch, { toastErrors: false });

  function close() {
    if (action.pending) return;
    setOpen(false);
    setInput(EMPTY);
    setErrors({});
    setFormError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const found = validateBatchForm(input);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const result = await action.run(input);
    if (result.ok) {
      router.push(routes.intakeBatch(result.data.id));
    } else if (result.fieldErrors) {
      setErrors({
        handedOverBy: result.fieldErrors.handedOverBy?.[0], boxLabel: result.fieldErrors.boxLabel?.[0],
        expectedSheets: result.fieldErrors.expectedSheetCount?.[0], note: result.fieldErrors.note?.[0],
      });
    } else {
      setFormError(result.errorId ? `${result.message} (Mã lỗi ${result.errorId})` : result.message);
    }
  }

  const field = (key: keyof BatchFormInput) => ({ id: `${formId}-${key}`, value: input[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setInput((c) => ({ ...c, [key]: e.target.value })), "aria-invalid": errors[key] ? true : undefined, "aria-describedby": errors[key] ? `${formId}-${key}-error` : undefined });
  const inputClass = "h-9 border border-line-strong bg-surface px-2 text-sm font-normal outline-none focus:border-primary aria-[invalid=true]:border-bad";
  const error = (key: keyof BatchFormInput) => errors[key] && <span id={`${formId}-${key}-error`} role="alert" className="text-[13px] font-normal text-bad">{errors[key]}</span>;

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}><Plus aria-hidden className="size-4" /> Tạo lô quét</Button>
      <Dialog
        open={open}
        onClose={close}
        title="Tạo lô quét"
        description="Mỗi lô là một lần bàn giao hồ sơ giấy để quét. Tạo trước khi quét để truy từng trang về đúng lần bàn giao."
        footer={
          <>
            <Button onClick={close} disabled={action.pending}>Hủy</Button>
            <Button variant="primary" type="submit" form={`${formId}-form`} disabled={action.pending}>{action.pending ? "Đang tạo…" : "Tạo lô"}</Button>
          </>
        }
      >
        <form id={`${formId}-form`} onSubmit={submit} className="grid gap-3" noValidate>
          <label className="grid gap-1 text-[13px] font-semibold" htmlFor={`${formId}-handedOverBy`}>
            Đơn vị hoặc người bàn giao
            <input {...field("handedOverBy")} maxLength={BATCH_LIMITS.handedOverBy + 20} placeholder="Ví dụ: Phòng Nội vụ" className={inputClass} autoComplete="off" />
            {error("handedOverBy")}
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-[13px] font-semibold" htmlFor={`${formId}-boxLabel`}>
              Nhãn hộp
              <input {...field("boxLabel")} maxLength={BATCH_LIMITS.boxLabel + 20} placeholder="Ví dụ: Hộp 07" className={inputClass} autoComplete="off" />
              {error("boxLabel")}
            </label>
            <label className="grid gap-1 text-[13px] font-semibold" htmlFor={`${formId}-expectedSheets`}>
              Số tờ dự kiến
              <input {...field("expectedSheets")} inputMode="numeric" placeholder="Ví dụ: 120" className={inputClass} autoComplete="off" />
              {error("expectedSheets")}
            </label>
          </div>
          <label className="grid gap-1 text-[13px] font-semibold" htmlFor={`${formId}-note`}>
            Ghi chú
            <textarea {...field("note")} rows={2} maxLength={BATCH_LIMITS.note + 50} className="border border-line-strong bg-surface p-2 text-sm font-normal outline-none focus:border-primary" />
            {error("note")}
          </label>
          {formError && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{formError}</p>}
        </form>
      </Dialog>
    </>
  );
}
