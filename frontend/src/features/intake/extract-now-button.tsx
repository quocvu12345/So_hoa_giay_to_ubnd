"use client";

import { useState, useTransition } from "react";
import { Zap } from "lucide-react";
import { extractNow } from "@/app/actions/ai-extract";
import { Button } from "@/components/ui/button";
import { summarizeExtract } from "@/lib/ai-queue";
import { cn } from "@/lib/cn";

type Props = {
  scope: "document" | "dossier";
  id: string;
  /** Giấy tờ đã đọc xong: nút thành "Trích xuất lại" (gợi ý lại từ trang đã đọc, không OCR lại). */
  force?: boolean;
  /** Chỉ trích xuất một phần giấy tờ của hồ sơ. */
  documentIds?: string[];
  label?: string;
  size?: "sm" | "md";
  variant?: "primary" | "secondary";
  className?: string;
};

/**
 * "Trích xuất ngay": nâng giấy tờ hoặc cả hồ sơ lên đầu hàng đợi AI.
 * Kết quả hiện ngay cạnh nút (vùng aria-live); lỗi nghiệp vụ trả về dạng thông báo, không văng trang lỗi.
 */
export function ExtractNowButton({ scope, id, force = false, documentIds, label, size = "sm", variant = "secondary", className }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const text = label ?? (force ? "Trích xuất lại" : scope === "dossier" ? "Trích xuất ngay cả hồ sơ" : "Trích xuất ngay");

  function run() {
    setMessage(null);
    startTransition(async () => {
      const outcome = await extractNow({ scope, id, force, documentIds });
      setMessage(outcome.ok ? { text: summarizeExtract(outcome.result), ok: true } : { text: outcome.message, ok: false });
    });
  }

  return (
    <span className={cn("inline-flex flex-col items-end gap-1", className)}>
      <Button size={size} variant={variant} onClick={run} disabled={pending} aria-busy={pending}>
        <Zap aria-hidden className="size-4" /> {pending ? "Đang gửi…" : text}
      </Button>
      <span role="status" aria-live="polite" className={cn("max-w-72 text-right text-xs", message?.ok === false ? "text-bad" : "text-muted")}>
        {message?.text}
      </span>
    </span>
  );
}
