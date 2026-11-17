"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/action-result";

/**
 * Gọi Server Action từ trình duyệt (FE-07): có trạng thái đang gửi, tự chuyển sang đăng nhập khi hết phiên,
 * và hiện toast kèm Mã lỗi khi thất bại. Lỗi theo từng ô (fieldErrors) để form tự hiện, không bắn toast.
 */
export function useServerAction<A extends unknown[], T>(action: (...args: A) => Promise<ActionResult<T>>, options: { toastErrors?: boolean } = {}) {
  const { toastErrors = true } = options;
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult<T> | null>(null);

  const run = useCallback(
    (...args: A) =>
      new Promise<ActionResult<T>>((resolve) => {
        startTransition(async () => {
          let outcome: ActionResult<T>;
          try {
            outcome = await action(...args);
          } catch {
            outcome = { ok: false, code: "client_error", message: "Chưa thực hiện được vì mất kết nối tới máy chủ. Kiểm tra mạng rồi thử lại." };
          }
          if (!outcome.ok) {
            if (outcome.status === 401) {
              router.push(`/dang-nhap?tiep=${encodeURIComponent(window.location.pathname + window.location.search)}` as "/dang-nhap");
            } else if (toastErrors && !outcome.fieldErrors) {
              toast.error(outcome.message, outcome.errorId);
            }
          }
          setResult(outcome);
          resolve(outcome);
        });
      }),
    [action, router, toast, toastErrors],
  );

  return { run, pending, result, reset: () => setResult(null) };
}
