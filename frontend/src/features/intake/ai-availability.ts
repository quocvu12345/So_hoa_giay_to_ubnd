import type { components } from "@/api/schema";
import { formatDateTime } from "@/lib/format";

/** AI-24, BE-133: máy AI có đang đọc được không (GET /api/v1/ai/availability). Chỉ trạng thái và thời điểm, không có chi tiết kỹ thuật. */
export type AiAvailability = components["schemas"]["AiAvailability"];

export type AiNotice = { title: string; body: string };

/**
 * Lời báo cho cán bộ khi PDF chưa được đọc vì máy AI, hoặc null khi bình thường (kể cả trạng thái lạ: không báo bừa).
 * Nói rõ PDF đã nạp không mất và không cần nạp lại, vì đó là điều người dùng lo nhất khi thấy "đang chờ" mãi.
 */
export function aiAvailabilityNotice(availability: AiAvailability | null | undefined): AiNotice | null {
  if (!availability) return null;
  const since = availability.since ? formatDateTime(availability.since) : null;
  switch (availability.state) {
    case "engine_down":
      return {
        title: `Máy AI tạm thời không trả lời${since ? ` từ ${since}` : ""}`,
        body: "PDF vẫn nạp được và nằm chờ trong hàng; AI tự đọc tiếp khi máy trở lại, không cần nạp lại. Cần gấp thì báo quản trị kỹ thuật.",
      };
    case "no_worker":
      return {
        title: "Bộ đọc PDF đang không hoạt động",
        body: `PDF vẫn nạp được và nằm chờ; sẽ được đọc khi bộ đọc chạy lại.${since ? ` Lần cuối thấy bộ đọc lúc ${since}.` : ""} Báo quản trị kỹ thuật nếu kéo dài.`,
      };
    default:
      return null;
  }
}
