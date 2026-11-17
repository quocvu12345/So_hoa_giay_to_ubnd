"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastKind = "success" | "error" | "info";
type ToastAction = { label: string; onClick: () => void };
type ToastItem = { id: number; kind: ToastKind; message: string; errorId?: string; action?: ToastAction };

type ToastApi = {
  /** `action`: nút ngay trong thông báo, ví dụ "Hoàn tác". */
  success: (message: string, action?: ToastAction) => void;
  info: (message: string, action?: ToastAction) => void;
  /** Lỗi ở lại tới khi đóng, kèm Mã lỗi để người dùng báo cho quản trị. */
  error: (message: string, errorId?: string) => void;
};

const Context = createContext<ToastApi | null>(null);

const AUTO_CLOSE_MS = 6000;

/** Thông báo ngắn ở góc dưới phải. Thành công tự đóng; lỗi ở lại và đọc ngay cho trình đọc màn hình (role=alert). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setItems((current) => current.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (kind: ToastKind, message: string, errorId?: string, action?: ToastAction) => {
      const id = next.current++;
      setItems((current) => [...current.slice(-3), { id, kind, message, errorId, action }]);
      if (kind !== "error") setTimeout(() => dismiss(id), AUTO_CLOSE_MS);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, action) => push("success", message, undefined, action),
      info: (message, action) => push("info", message, undefined, action),
      error: (message, errorId) => push("error", message, errorId),
    }),
    [push],
  );

  return (
    <Context.Provider value={api}>
      {children}
      <div role="region" aria-label="Thông báo" className="pointer-events-none fixed right-4 bottom-4 z-50 grid w-[min(24rem,calc(100vw-2rem))] gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex items-start gap-2 border bg-surface p-3 text-sm shadow-md",
              t.kind === "error" ? "border-bad" : t.kind === "success" ? "border-ok" : "border-line-strong",
            )}
          >
            {t.kind === "error" ? <AlertCircle aria-hidden className="mt-0.5 size-4 flex-none text-bad" /> : <CheckCircle2 aria-hidden className="mt-0.5 size-4 flex-none text-ok" />}
            <div className="grid min-w-0 flex-1 gap-0.5">
              <span>{t.message}</span>
              {t.errorId && <span className="text-xs text-muted">Mã lỗi: <span className="font-mono">{t.errorId}</span></span>}
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  className="justify-self-start font-semibold text-primary hover:underline"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="grid size-6 flex-none place-items-center text-muted hover:text-ink" aria-label="Đóng thông báo">
              <X aria-hidden className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </Context.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(Context);
  if (!api) throw new Error("useToast phải nằm trong ToastProvider.");
  return api;
}
