"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Thuộc tính nối ô nhập với nhãn, gợi ý và lỗi của `Field` để trình đọc màn hình đọc đúng. */
export type ControlProps = { id: string; "aria-invalid"?: true; "aria-describedby"?: string };

/** Dòng lỗi dưới ô. Không `role="alert"`: lỗi gắn vào ô bằng `aria-describedby`, và biểu mẫu đưa tiêu điểm tới ô lỗi đầu tiên. */
export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  return children ? <p id={id} className="text-xs text-bad">{children}</p> : null;
}

/**
 * Nhãn, ô nhập, gợi ý và lỗi theo một khuôn (FE-03). `children` nhận `ControlProps` để gắn vào ô, nên không thể quên `htmlFor` hay `aria-describedby`.
 * `aside`: chữ nhỏ bên phải nhãn, ví dụ bộ đếm ký tự.
 */
export function Field({ label, hint, error, required, aside, className, children }: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  aside?: ReactNode;
  className?: string;
  children: (control: ControlProps) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn("grid gap-1", className)}>
      <label htmlFor={id} className="flex justify-between gap-2 text-[13px] font-semibold">
        <span>
          {label}
          {required && <span className="text-bad" title="Bắt buộc"> *</span>}
        </span>
        {aside && <span className="font-normal text-muted tabular-nums">{aside}</span>}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": [errorId, hintId].filter(Boolean).join(" ") || undefined })}
      {hint && <p id={hintId} className="text-xs text-muted">{hint}</p>}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}
