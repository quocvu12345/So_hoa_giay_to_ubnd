"use client";

import { Command } from "lucide-react";

/** Nút mở ô Đi nhanh cho người không quen phím tắt. */
export function OpenCommandButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("hoso:open-command"))}
      className="hidden h-10 items-center gap-2 border border-line px-3 text-[13px] text-muted hover:border-primary hover:text-primary lg:inline-flex"
    >
      <Command aria-hidden className="size-4" /> Đi nhanh
      <kbd className="border border-line px-1 text-[11px]">Ctrl K</kbd>
    </button>
  );
}
