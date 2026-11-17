"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Hộp thoại dùng phần tử <dialog> gốc của trình duyệt: có sẵn bẫy tiêu điểm, đóng bằng Esc, nền phía sau bị vô hiệu.
 * Mở bằng `open`; mọi cách đóng (Esc, nút X, bấm nền) đều gọi `onClose`.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn("m-auto w-[min(32rem,calc(100vw-2rem))] border border-line-strong bg-surface p-0 text-ink backdrop:bg-black/40", className)}
    >
      <div className="grid gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 id={titleId} className="text-lg font-bold">{title}</h2>
            {description && <p id={descriptionId} className="text-sm text-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="grid size-8 flex-none place-items-center text-muted hover:text-ink" aria-label="Đóng">
            <X aria-hidden className="size-5" />
          </button>
        </div>
        {open && children}
        {footer && <div className="flex flex-wrap justify-end gap-2 pt-1">{footer}</div>}
      </div>
    </dialog>
  );
}
