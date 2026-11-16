"use client";

import { useState } from "react";
import type { AllowedAction } from "@/lib/workflow";
import { cn } from "@/lib/cn";

const MIN_NOTE = 10;

/**
 * Thanh thao tác hồ sơ, dính ở đáy màn hình.
 * - Chỉ hiện nút mà API cho phép ở bước hiện tại với phân công đang dùng.
 * - Nút cần ý kiến mở ô ý kiến ngay cạnh, đếm đủ 10 ký tự mới gửi được.
 * - Không có thao tác: nói rõ hồ sơ đang chờ ai.
 */
export function ActionBar({ actions, blockedReason, waitingFor }: { actions: AllowedAction[]; blockedReason?: string; waitingFor: string }) {
  const [selected, setSelected] = useState<AllowedAction | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);

  if (actions.length === 0) {
    return (
      <div className="sticky bottom-0 z-10 border-t border-line bg-surface px-4 py-3 text-[13px] text-muted sm:px-6">
        Bạn không có thao tác ở bước này. {waitingFor}
      </div>
    );
  }

  const noteOk = !selected?.requiresNote || note.trim().length >= MIN_NOTE;
  const primaryBlocked = Boolean(blockedReason);

  return (
    <div className="sticky bottom-0 z-10 grid gap-3 border-t border-line bg-surface px-4 py-3 sm:px-6">
      {selected?.requiresNote && (
        <div className="grid gap-1">
          <label htmlFor="action-note" className="text-[13px] font-semibold">
            Ý kiến khi “{selected.label.toLowerCase()}” <span className="font-normal text-muted">(bắt buộc, ghi rõ nội dung cần làm)</span>
          </label>
          <textarea
            id="action-note"
            autoFocus
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="border border-line-strong p-2 text-sm focus:border-primary"
          />
          <span className={cn("text-xs", noteOk ? "text-ok" : "text-muted")}>
            {note.trim().length}/{MIN_NOTE} ký tự tối thiểu
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-muted">{done ?? blockedReason ?? "Chọn thao tác. Mọi thao tác được ghi vào nhật ký hồ sơ."}</span>
        <div className="flex flex-wrap gap-2">
          {selected && (
            <button type="button" onClick={() => { setSelected(null); setNote(""); }} className="h-10 border border-transparent px-3 text-sm hover:bg-soft">
              Hủy
            </button>
          )}
          {actions.map((a) => {
            const isSelected = selected?.action === a.action;
            const disabled = (a.primary && primaryBlocked) || (isSelected && !noteOk);
            return (
              <button
                key={a.action}
                type="button"
                disabled={disabled}
                title={a.primary && primaryBlocked ? blockedReason : undefined}
                onClick={() => {
                  if (a.requiresNote && !isSelected) {
                    setSelected(a);
                    return;
                  }
                  // TODO(FE-30, BE-67): POST /api/v1/dossiers/{id}/transitions { action, note, expectedVersion }
                  setDone(`Giả lập: đã gửi “${a.label}”. Bản thật sẽ chuyển bước và thông báo người nhận.`);
                  setSelected(null);
                  setNote("");
                }}
                className={cn(
                  "h-10 border px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50",
                  a.primary ? "border-primary bg-primary text-white hover:bg-primary-hover" : "border-line-strong bg-surface hover:border-bad hover:text-bad",
                )}
              >
                {isSelected ? `Gửi: ${a.label}` : a.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
