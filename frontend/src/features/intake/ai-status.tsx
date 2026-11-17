import { Chip } from "@/components/ui/status-chip";
import { waitingLabel, type QueueKind } from "@/lib/ai-queue";

export type AiStatusInput = {
  stage: "queued" | "reading" | "ready" | "failed";
  queueKind?: QueueKind | null;
  queuePosition?: number | null;
  etaSeconds?: number | null;
  progress?: string;
  attentionCount?: number;
};

/** Tình trạng đọc của AI cho một giấy tờ ở hộp tiếp nhận. Luôn có chữ, không chỉ dựa vào màu. */
export function AiStatusChip({ item }: { item: AiStatusInput }) {
  if (item.stage === "ready") return <Chip tone="ok">Đã đọc xong{item.attentionCount ? ` · ${item.attentionCount} trường cần xem` : ""}</Chip>;
  if (item.stage === "reading") return <Chip tone="info">{item.progress ?? "Đang đọc"}</Chip>;
  if (item.stage === "queued") return <Chip tone={item.queueKind === "priority" ? "info" : "neutral"}>{waitingLabel(item.queueKind, item.queuePosition, item.etaSeconds)}</Chip>;
  return <Chip tone="bad">Đọc lỗi một phần</Chip>;
}
