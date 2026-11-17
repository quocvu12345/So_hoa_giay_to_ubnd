"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { transitionDossier } from "@/app/actions/dossier";
import { useToast } from "@/components/ui/toast";
import type { AllowedAction } from "@/features/dossier/dossier-data";
import { cn } from "@/lib/cn";
import { useServerAction } from "@/lib/use-server-action";

const MIN_NOTE = 10;

/**
 * Thanh thao tác hồ sơ, dính ở đáy màn hình (FE-30). Mọi nút lấy từ GET /dossiers/{id}/actions: giao diện không tự suy luật chuyển bước.
 * - Nút API khóa (`enabled=false`) vẫn hiện, mờ, kèm lý do ngay cạnh để người dùng biết cần làm gì.
 * - Nút cần ý kiến mở ô ý kiến ngay cạnh, đếm đủ 10 ký tự mới gửi được.
 * - Gửi kèm `version` đang xem; 409 thì báo "hồ sơ vừa thay đổi" và tải lại.
 * - Không có thao tác: nói rõ hồ sơ đang chờ ai.
 */
export function ActionBar({ dossierId, version, actions, waitingFor }: { dossierId: string; version: number; actions: AllowedAction[]; waitingFor: string }) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<AllowedAction | null>(null);
  const [note, setNote] = useState("");
  // Hộp thoại không dùng ở đây nên toast hiện được; lỗi 409 cần câu riêng nên tự xử lý.
  const transition = useServerAction(transitionDossier, { toastErrors: false });

  if (actions.length === 0) {
    return (
      <div className="sticky bottom-0 z-10 border-t border-line bg-surface px-4 py-3 text-[13px] text-muted sm:px-6">
        Bạn không có thao tác ở bước này. {waitingFor}
      </div>
    );
  }

  const noteOk = !selected?.requiresNote || note.trim().length >= MIN_NOTE;
  const reasons = actions.filter((a) => !a.enabled && a.disabledReason);

  async function send(action: AllowedAction) {
    const outcome = await transition.run({ dossierId, action: action.action, label: action.label, note, version });
    if (outcome.ok) {
      toast.success(`Đã “${action.label.toLowerCase()}”. Hồ sơ chuyển sang: ${outcome.data.statusLabel}.`);
      setSelected(null);
      setNote("");
      router.refresh();
      return;
    }
    if (outcome.status === 409) {
      toast.error("Hồ sơ vừa được người khác thay đổi nên chưa gửi được. Đã tải lại, kiểm tra rồi thao tác lại.");
      setSelected(null);
      router.refresh();
      return;
    }
    toast.error(outcome.message, outcome.errorId);
  }

  return (
    <div className="sticky bottom-0 z-10 grid gap-3 border-t border-line bg-surface px-4 py-3 sm:px-6">
      {selected?.requiresNote && (
        <div className="grid gap-1">
          <label htmlFor="action-note" className="text-[13px] font-semibold">
            Ý kiến khi “{selected.label.toLowerCase()}” <span className="font-normal text-muted">(bắt buộc, ghi rõ nội dung cần làm)</span>
          </label>
          <textarea id="action-note" autoFocus rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="border border-line-strong p-2 text-sm focus:border-primary" />
          <span className={cn("text-xs", noteOk ? "text-ok" : "text-muted")}>
            {note.trim().length}/{MIN_NOTE} ký tự tối thiểu
          </span>
        </div>
      )}
      {selected?.warning && (
        <p className="flex items-start gap-2 text-[13px] text-warn" role="status">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 flex-none" /> {selected.warning}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-0.5 text-[13px] text-muted" role="status">
          {reasons.length > 0 ? reasons.map((a) => <span key={a.action}>{reasons.length > 1 ? `${a.label}: ` : ""}{a.disabledReason}</span>) : <span>Chọn thao tác. Mọi thao tác được ghi vào nhật ký hồ sơ.</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {selected && (
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setNote("");
              }}
              className="h-10 border border-transparent px-3 text-sm hover:bg-soft"
            >
              Hủy
            </button>
          )}
          {actions.map((a) => {
            const isSelected = selected?.action === a.action;
            const disabled = !a.enabled || transition.pending || (isSelected && !noteOk);
            return (
              <button
                key={a.action}
                type="button"
                disabled={disabled}
                aria-busy={isSelected && transition.pending}
                title={a.enabled ? undefined : (a.disabledReason ?? undefined)}
                onClick={() => {
                  if (a.requiresNote && !isSelected) {
                    setSelected(a);
                    return;
                  }
                  setSelected(a);
                  void send(a);
                }}
                className={cn(
                  "h-10 border px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50",
                  a.primary ? "border-primary bg-primary text-white hover:bg-primary-hover" : "border-line-strong bg-surface hover:border-bad hover:text-bad",
                )}
              >
                {isSelected && transition.pending ? "Đang gửi…" : isSelected && a.requiresNote ? `Gửi: ${a.label}` : a.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
