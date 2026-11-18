"use client";

import { useId, useState } from "react";
import { Button } from "./button";
import { Dialog } from "./dialog";

export type FieldSpec = {
  name: string;
  label: string;
  kind?: "text" | "textarea" | "number" | "select" | "checkbox";
  options?: { value: string; label: string }[];
  hint?: string;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  /** Chỉ đọc (hiện giá trị, không sửa), ví dụ mã đã cấp. */
  readOnly?: boolean;
};

export type Values = Record<string, string | boolean>;
export type SubmitOutcome = { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

const inputClass = "h-9 border border-line-strong bg-surface px-2 text-sm font-normal outline-none focus:border-primary aria-[invalid=true]:border-bad read-only:bg-soft";

/**
 * Hộp thoại biểu mẫu dùng chung cho các màn quản trị (FE-43): danh sách ô khai báo, kiểm tra phía giao diện khi bấm lưu (`validate` trả lỗi theo ô),
 * gửi qua `onSubmit`; lỗi theo ô của API hiện đúng ô, lỗi khác hiện trong hộp thoại (hộp thoại modal làm vùng toast bị vô hiệu).
 */
export function FormDialog({ open, onClose, title, description, fields, initial, submitLabel, validate, onSubmit }: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  fields: FieldSpec[];
  initial: Values;
  submitLabel: string;
  validate?: (values: Values) => Record<string, string | undefined>;
  onSubmit: (values: Values) => Promise<SubmitOutcome>;
}) {
  const id = useId();
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  // Mở lại thì nạp giá trị ban đầu mới (không giữ chữ đã gõ của lần trước).
  if (open && !wasOpen) {
    setWasOpen(true);
    setValues(initial);
    setErrors({});
    setFormError(null);
  }
  if (!open && wasOpen) setWasOpen(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const found = Object.fromEntries(Object.entries(validate?.(values) ?? {}).filter(([, v]) => v));
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setPending(true);
    const outcome = await onSubmit(values);
    setPending(false);
    if (outcome.ok) return;
    if (outcome.fieldErrors) {
      setErrors(Object.fromEntries(Object.entries(outcome.fieldErrors).map(([k, v]) => [k, v[0]])));
      setFormError(Object.keys(outcome.fieldErrors).some((k) => fields.some((f) => f.name === k)) ? null : outcome.message);
    } else setFormError(outcome.message);
  }

  return (
    <Dialog open={open} onClose={() => !pending && onClose()} title={title} description={description}
      footer={<><Button onClick={onClose} disabled={pending}>Hủy</Button><Button variant="primary" type="submit" form={`${id}-form`} disabled={pending}>{pending ? "Đang lưu…" : submitLabel}</Button></>}>
      <form id={`${id}-form`} onSubmit={submit} className="grid gap-3" noValidate>
        {fields.map((f) => {
          const fieldId = `${id}-${f.name}`;
          const error = errors[f.name];
          const common = { id: fieldId, "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${fieldId}-error` : f.hint ? `${fieldId}-hint` : undefined } as const;
          const set = (value: string | boolean) => { setValues((c) => ({ ...c, [f.name]: value })); setErrors((c) => ({ ...c, [f.name]: undefined })); };
          return (
            <div key={f.name} className="grid gap-1">
              {f.kind === "checkbox" ? (
                <label htmlFor={fieldId} className="flex items-center gap-2 text-[13px] font-semibold"><input {...common} type="checkbox" checked={Boolean(values[f.name])} onChange={(e) => set(e.target.checked)} className="size-4 accent-primary" /> {f.label}</label>
              ) : (
                <>
                  <label htmlFor={fieldId} className="text-[13px] font-semibold">{f.label}</label>
                  {f.kind === "textarea" ? <textarea {...common} value={String(values[f.name] ?? "")} rows={f.rows ?? 3} maxLength={f.maxLength ? f.maxLength + 50 : undefined} readOnly={f.readOnly} onChange={(e) => set(e.target.value)} placeholder={f.placeholder} className="border border-line-strong bg-surface p-2 text-sm font-normal outline-none focus:border-primary aria-[invalid=true]:border-bad" />
                    : f.kind === "select" ? <select {...common} value={String(values[f.name] ?? "")} onChange={(e) => set(e.target.value)} className={inputClass}>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                    : <input {...common} type="text" inputMode={f.kind === "number" ? "numeric" : undefined} value={String(values[f.name] ?? "")} maxLength={f.maxLength ? f.maxLength + 20 : undefined} readOnly={f.readOnly} onChange={(e) => set(e.target.value)} placeholder={f.placeholder} autoComplete="off" className={inputClass} />}
                </>
              )}
              {f.hint && !error && <span id={`${fieldId}-hint`} className="text-xs text-muted">{f.hint}</span>}
              {error && <span id={`${fieldId}-error`} role="alert" className="text-[13px] text-bad">{error}</span>}
            </div>
          );
        })}
        {formError && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{formError}</p>}
      </form>
    </Dialog>
  );
}
