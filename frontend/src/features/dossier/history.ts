import type { HistoryItem } from "./dossier-data";

/** Gom theo loại sự kiện để lọc; thứ tự theo cách người dùng thường hỏi ("ai trả lại, ai trình"). */
export function actionKinds(items: readonly HistoryItem[]): { action: string; label: string; count: number }[] {
  const kinds = new Map<string, { action: string; label: string; count: number }>();
  for (const item of items) {
    const kind = kinds.get(item.action) ?? { action: item.action, label: item.actionLabel, count: 0 };
    kind.count++;
    kinds.set(item.action, kind);
  }
  return [...kinds.values()].sort((a, b) => b.count - a.count);
}
