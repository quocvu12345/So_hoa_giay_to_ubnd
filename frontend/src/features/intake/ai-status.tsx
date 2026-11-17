import { Chip } from "@/components/ui/status-chip";
import { waitingLabel, type QueueKind } from "@/lib/ai-queue";

export type AiStage = "queued" | "reading" | "ready" | "failed" | "cancelled";

export type AiStatusInput = {
  stage: AiStage;
  queueKind?: QueueKind | null;
  queuePosition?: number | null;
  etaSeconds?: number | null;
  progress?: string | null;
  attentionCount?: number;
};

/** API trả stage là chuỗi; giá trị lạ coi như đang chờ để giao diện không vỡ khi backend thêm trạng thái. */
export function toAiStage(value: string): AiStage {
  return value === "reading" || value === "ready" || value === "failed" || value === "cancelled" ? value : "queued";
}

export function toQueueKind(value: string | null | undefined): QueueKind | null {
  return value === "priority" || value === "interactive" || value === "background" ? value : null;
}

/** Tình trạng đọc của AI cho một giấy tờ ở hộp tiếp nhận. Luôn có chữ, không chỉ dựa vào màu. */
export function AiStatusChip({ item }: { item: AiStatusInput }) {
  if (item.stage === "ready") return <Chip tone="ok">Đã đọc xong{item.attentionCount ? ` · ${item.attentionCount} trường cần xem` : ""}</Chip>;
  if (item.stage === "reading") return <Chip tone="info">{item.progress ?? "Đang đọc"}</Chip>;
  if (item.stage === "queued") return <Chip tone={item.queueKind === "priority" ? "info" : "neutral"}>{waitingLabel(item.queueKind, item.queuePosition, item.etaSeconds)}</Chip>;
  if (item.stage === "cancelled") return <Chip tone="neutral">Đã hủy đọc</Chip>;
  return <Chip tone="bad">Đọc lỗi</Chip>;
}
