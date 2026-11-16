"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export type Step = { href: Route; label: string; match: string };

/** Thanh bước của luồng tiếp nhận: bước đã qua bấm quay lại được, bước sau chưa mở. */
export function Stepper({ steps, fallback = 0 }: { steps: Step[]; fallback?: number }) {
  const pathname = usePathname();
  const found = steps.findIndex((s) => pathname.endsWith(s.match));
  const current = found === -1 ? fallback : found;
  return (
    <ol aria-label="Các bước tiếp nhận" className="flex flex-wrap text-[13px] font-semibold">
      {steps.map((step, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        const content = (
          <>
            <span className={cn("grid size-5 place-items-center border text-[11px]", state === "current" ? "border-white" : "border-current")}>
              {state === "done" ? <Check aria-hidden className="size-3" /> : i + 1}
            </span>
            {step.label}
          </>
        );
        const cls = cn(
          "-ml-px flex items-center gap-2 border px-3 py-1.5",
          state === "current" && "border-primary bg-primary text-white",
          state === "done" && "border-line bg-surface text-primary hover:bg-soft",
          state === "todo" && "border-line bg-surface text-muted",
        );
        return (
          <li key={step.label}>
            {state === "done" ? (
              <Link href={step.href} className={cls}>{content}</Link>
            ) : (
              <span className={cls} aria-current={state === "current" ? "step" : undefined}>{content}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
