import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { WORKFLOW_LABELS, type WorkflowState } from "@/lib/mock/data";

export type Tone = "neutral" | "info" | "ok" | "warn" | "bad";

const tones: Record<Tone, string> = {
  neutral: "bg-soft text-ink border-line",
  info: "bg-accent-soft text-primary border-transparent",
  ok: "bg-ok-soft text-ok border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
  bad: "bg-bad-soft text-bad border-transparent",
};

export function Chip({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 border px-2 py-0.5 text-xs font-semibold whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

const WORKFLOW_TONES: Record<WorkflowState, Tone> = {
  draft: "neutral",
  returned: "bad",
  department_review: "warn",
  leadership_review: "warn",
  ready_archive: "info",
  archived: "ok",
};

/** Trạng thái hồ sơ: luôn có chữ, không chỉ dựa vào màu. */
export function WorkflowChip({ state }: { state: WorkflowState }) {
  return <Chip tone={WORKFLOW_TONES[state]}>{WORKFLOW_LABELS[state]}</Chip>;
}
