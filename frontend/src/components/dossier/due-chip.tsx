import { Chip } from "@/components/ui/status-chip";
import { daysUntil, formatDate } from "@/lib/format";

/**
 * Hạn nội bộ của hồ sơ: quá hạn thì chip đỏ, còn tối đa 2 ngày thì chip vàng, còn lại chỉ hiện ngày.
 * Luôn có chữ ("Quá hạn 3 ngày"), không chỉ dựa vào màu. Hồ sơ đã nộp lưu không còn hạn nên không gọi.
 */
export function DueChip({ dueOn, now }: { dueOn: string | null | undefined; now?: Date }) {
  const days = daysUntil(dueOn, now);
  if (days === null) return <span className="text-muted">—</span>;
  if (days < 0) return <Chip tone="bad">Quá hạn {-days} ngày · {formatDate(dueOn)}</Chip>;
  if (days <= 2) return <Chip tone="warn">{days === 0 ? "Hết hạn hôm nay" : `Còn ${days} ngày`} · {formatDate(dueOn)}</Chip>;
  return <span className="tabular-nums">{formatDate(dueOn)}</span>;
}
