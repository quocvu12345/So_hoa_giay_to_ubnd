import type { InboxItem } from "./inbox-data";
import { toAiStage, type AiStage } from "./ai-status";

/** Tiến độ đọc mới nhất nhận qua SSE `job.progress`, theo mã giấy tờ. */
export type LiveProgress = { processed: number; pageCount: number | null };

/** Nhãn tiến độ khớp cách API ghi ở hộp tiếp nhận: "Đang đọc trang 2/5". `processed` là số trang đã đọc xong. */
export function progressLabel(live: LiveProgress): string {
  const current = live.pageCount == null ? live.processed + 1 : Math.min(live.processed + 1, live.pageCount);
  return `Đang đọc trang ${current}/${live.pageCount ?? "?"}`;
}

/**
 * Phủ tiến độ trực tiếp lên một dòng đã tải: việc đang chờ hoặc đang đọc thì cập nhật nhãn và chuyển sang "đang đọc".
 * Dòng đã xong, lỗi, hủy không bị đổi: kết thúc việc luôn kèm tải lại danh sách từ API.
 */
export function withLiveProgress(item: InboxItem, live: LiveProgress | undefined): InboxItem {
  if (!live) return item;
  const stage = toAiStage(item.stage);
  if (stage !== "queued" && stage !== "reading") return item;
  return { ...item, stage: "reading", progress: progressLabel(live), queuePosition: null, etaSeconds: null };
}

/** `read`: giá trị gửi cho API `GET /intake/inbox?read=` (BE-129), lọc trên toàn hộp chứ không chỉ phần đã tải. */
export const AI_FILTERS = [
  { key: "tat-ca", label: "Tất cả", stages: null, read: null },
  { key: "dang-cho", label: "Chờ trong khay", stages: ["queued"], read: "queued" },
  { key: "dang-doc", label: "Đang đọc", stages: ["reading"], read: "reading" },
  { key: "da-doc", label: "Đã đọc xong", stages: ["ready"], read: "ready" },
  { key: "loi", label: "Lỗi", stages: ["failed", "cancelled"], read: "failed,cancelled" },
] as const satisfies readonly { key: string; label: string; stages: readonly AiStage[] | null; read: string | null }[];

export type AiFilterKey = (typeof AI_FILTERS)[number]["key"];

export function filterByStage(items: readonly InboxItem[], key: AiFilterKey): InboxItem[] {
  const filter = AI_FILTERS.find((f) => f.key === key);
  const stages = filter?.stages as readonly AiStage[] | null | undefined;
  if (!stages) return [...items];
  return items.filter((item) => stages.includes(toAiStage(item.stage)));
}
