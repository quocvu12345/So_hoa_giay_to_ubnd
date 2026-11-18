"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { canonicalViDate, parseViDate } from "@/lib/vi-date";
import { cn } from "@/lib/cn";
import { Field } from "./field";

export const controlClass =
  "w-full border border-line-strong bg-surface px-2 text-sm font-normal outline-none focus:border-primary aria-[invalid=true]:border-bad read-only:bg-soft disabled:opacity-60";

type Shared = { label: ReactNode; hint?: ReactNode; error?: string | null; required?: boolean; fieldClassName?: string };

/** Ô một dòng kèm nhãn, gợi ý, lỗi (FE-03). */
export function Input({ label, hint, error, required, fieldClassName, className, ...props }: Shared & Omit<InputHTMLAttributes<HTMLInputElement>, "id">) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={fieldClassName}>
      {(control) => <input {...props} {...control} className={cn(controlClass, "h-10", className)} />}
    </Field>
  );
}

/** Ô nhiều dòng; có `maxLength` và `value` thì nhãn hiện bộ đếm ký tự. */
export function Textarea({ label, hint, error, required, fieldClassName, className, ...props }: Shared & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id">) {
  const counter = props.maxLength != null && typeof props.value === "string" ? `${props.value.length}/${props.maxLength}` : undefined;
  return (
    <Field label={label} hint={hint} error={error} required={required} aside={counter} className={fieldClassName}>
      {(control) => <textarea {...props} {...control} className={cn(controlClass, "py-1.5", className)} />}
    </Field>
  );
}

/** Hộp chọn gốc của trình duyệt: dùng được bằng bàn phím và trên điện thoại. Lựa chọn là `<option>` hoặc `<optgroup>` truyền vào `children`. */
export function Select({ label, hint, error, required, fieldClassName, className, children, ...props }: Shared & Omit<SelectHTMLAttributes<HTMLSelectElement>, "id">) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={fieldClassName}>
      {(control) => (
        <select {...props} {...control} className={cn(controlClass, "h-10", className)}>
          {children}
        </select>
      )}
    </Field>
  );
}

/**
 * Ô ngày/tháng/năm (FE-03, "DatePicker"): gõ `dd/mm/yyyy`, rời ô thì đổi `-` hoặc `.` thành `/` và thêm số 0 đầu. Không dùng ô ngày gốc của trình duyệt
 * vì nó hiện theo ngôn ngữ máy (mm/dd/yyyy ở nhiều máy) và khó kiểm bằng bàn phím. Kiểm tra đúng lịch bằng `validateViDate` ở nơi lưu.
 */
export function DateInput({ value, onValueChange, onBlur, ...props }: Shared & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "value" | "onChange" | "inputMode" | "type"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Input
      {...props}
      value={value}
      inputMode="numeric"
      placeholder={props.placeholder ?? "dd/mm/yyyy"}
      maxLength={10}
      onChange={(event) => onValueChange(event.target.value)}
      onBlur={(event) => {
        if (parseViDate(event.target.value) !== null) onValueChange(canonicalViDate(event.target.value));
        onBlur?.(event);
      }}
    />
  );
}

/** Lỗi của ô ngày: rỗng là hợp lệ (ô tùy chọn), có chữ thì phải đúng dạng và đúng lịch. */
export function validateViDate(value: string): string | null {
  return value.trim() === "" || parseViDate(value) !== null ? null : "Nhập ngày dạng ngày/tháng/năm, ví dụ 20/01/2026.";
}
