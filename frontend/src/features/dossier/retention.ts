import type { components } from "@/api/schema";
import { formatDate } from "@/lib/format";

export type DossierRetention = components["schemas"]["DossierRetention"];

/**
 * Câu mô tả thời hạn bảo quản của hồ sơ (FE-28, BE-130). Chỉ quy tắc ĐÃ xác nhận mới có hiệu lực; đề xuất hay nhiều quy tắc chưa gán thì nói rõ
 * là chưa tính được, không suy ra con số. Không `import "server-only"`: dùng được trong test.
 */
export function describeRetention(retention: DossierRetention | null | undefined): { text: string; hint: string | null; tone: "neutral" | "ok" | "warn" } {
  if (!retention) return { text: "Chưa có thông tin", hint: null, tone: "neutral" };
  switch (retention.status) {
    case "confirmed": {
      const base = retention.label || (retention.years != null ? `${retention.years} năm` : "Đã xác nhận");
      const text = retention.legalReference ? `${base} · ${retention.legalReference}` : base;
      if (!retention.eligibleSince) return { text, hint: "Hạn tính từ ngày hồ sơ được lưu trữ.", tone: "neutral" };
      return retention.eligible
        ? { text, hint: `Đã đủ hạn từ ${formatDate(retention.eligibleSince)}: có thể đề nghị hủy.`, tone: "warn" }
        : { text, hint: `Đủ hạn từ ${formatDate(retention.eligibleSince)}.`, tone: "ok" };
    }
    case "proposed":
      return { text: "Chưa xác nhận", hint: `Nhóm này mới có đề xuất${retention.label ? ` (${retention.label})` : ""}, chưa có hiệu lực nên chưa tính ngày đủ hạn.`, tone: "warn" };
    case "ambiguous":
      return { text: "Chưa xác định", hint: "Nhóm này có nhiều thời hạn đã xác nhận mà hồ sơ chưa gán thời hạn nào.", tone: "warn" };
    default:
      return { text: "Chưa có", hint: "Nhóm hồ sơ này chưa có thời hạn bảo quản. Quản trị danh mục đề xuất và xác nhận ở Quản trị › Danh mục.", tone: "neutral" };
  }
}
