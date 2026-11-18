"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "./button";

/**
 * Xác nhận hai bước ngay trong trang (FE-03, "ConfirmInline"): bấm nút thì hiện câu hỏi kèm "Xác nhận" và "Hủy" tại chỗ, không mở hộp thoại.
 * Tiêu điểm vào "Hủy" (an toàn: Enter nhấn thừa không làm việc không thể đảo ngược), Esc hủy và trả tiêu điểm về nút ban đầu.
 */
export function ConfirmInline({ label, question, confirmLabel = "Xác nhận", cancelLabel = "Hủy", onConfirm, variant = "danger", disabled, pending, size = "sm" }: {
  label: ReactNode;
  question: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  variant?: "danger" | "primary" | "secondary";
  disabled?: boolean;
  pending?: boolean;
  size?: "sm" | "md";
}) {
  const [asking, setAsking] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  const close = () => {
    setAsking(false);
    setTimeout(() => opener.current?.focus(), 0);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    }
  };

  if (!asking) {
    return (
      <Button ref={opener} variant={variant} size={size} disabled={disabled || pending} onClick={() => { setAsking(true); setTimeout(() => cancel.current?.focus(), 0); }}>
        {label}
      </Button>
    );
  }
  return (
    <span role="group" aria-label={question} onKeyDown={onKeyDown} className="inline-flex flex-wrap items-center gap-2 text-sm">
      <span>{question}</span>
      <Button variant={variant} size={size} disabled={pending} onClick={async () => { await onConfirm(); setAsking(false); }}>
        {pending ? "Đang làm…" : confirmLabel}
      </Button>
      <Button ref={cancel} size={size} disabled={pending} onClick={close}>{cancelLabel}</Button>
    </span>
  );
}
