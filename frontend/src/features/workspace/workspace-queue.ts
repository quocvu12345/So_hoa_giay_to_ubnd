import type { RoleCode } from "@/lib/auth/permissions";
import { daysUntil } from "@/lib/format";

/**
 * Hàng việc theo vai trò (FE-20). `kind` là loại hàng do API tính từ `my_queue` theo phân công đang dùng
 * (BE-69): assigned (đang chuẩn bị hoặc cần bổ sung), to_review (chờ trưởng phòng/Ban), to_decide (chờ lãnh đạo), to_archive (chờ nộp lưu).
 * Giao diện chỉ quyết định hiện hàng nào ở đầu và đặt tiêu đề, không tự suy ra ai phải làm gì.
 */
export type QueueKind = "assigned" | "to_review" | "to_decide" | "to_archive";

export type QueueSection = { kind: QueueKind; title: string; hint: string; allHref: string };

const SECTIONS: Record<QueueKind, QueueSection> = {
  assigned: { kind: "assigned", title: "Cần bạn làm", hint: "Hồ sơ đang chuẩn bị hoặc bị trả lại để bổ sung. Quá hạn lên đầu.", allHref: "/ho-so?cua-toi=1" },
  to_review: { kind: "to_review", title: "Chờ bạn kiểm tra", hint: "Chuyên viên đã trình: Đạt, Trả lại hoặc Trình lãnh đạo.", allHref: "/ho-so?trang-thai=department_review" },
  to_decide: { kind: "to_decide", title: "Chờ bạn cho ý kiến", hint: "Hồ sơ được trình lên lãnh đạo.", allHref: "/ho-so?trang-thai=leadership_review" },
  to_archive: { kind: "to_archive", title: "Chờ tiếp nhận nộp lưu", hint: "Đã qua kiểm tra: kiểm tra bàn giao và vị trí bản giấy rồi tiếp nhận.", allHref: "/nop-luu" },
};

/** Các hàng hiện ở màn Việc của tôi của từng vai trò, theo thứ tự ưu tiên (docs/01 mục 3). */
const BY_ROLE: Record<RoleCode, QueueKind[]> = {
  employee: ["assigned"],
  clerk: ["to_archive", "assigned"],
  manager: ["to_review", "assigned"],
  chair: ["to_decide"],
  council: ["to_decide"],
  technical_admin: [],
};

export function sectionsFor(role: RoleCode): QueueSection[] {
  return BY_ROLE[role].map((kind) => SECTIONS[kind]);
}

export type QueueRow = { dossierId: string; status: string; dueOn: string | null; updatedAt: string };

/** Mức ưu tiên hiển thị: 0 quá hạn, 1 bị trả lại, 2 sắp đến hạn (≤ 2 ngày), 3 còn lại. */
export function priority(row: Pick<QueueRow, "status" | "dueOn">, now: Date = new Date()): 0 | 1 | 2 | 3 {
  const days = daysUntil(row.dueOn, now);
  if (days !== null && days < 0) return 0;
  if (row.status === "returned") return 1;
  if (days !== null && days <= 2) return 2;
  return 3;
}

/** Quá hạn lên đầu, rồi bị trả lại, rồi sắp đến hạn; trong cùng mức: hạn gần trước (không hạn ở cuối), mới cập nhật trước. */
export function orderQueue<T extends QueueRow>(rows: readonly T[], now: Date = new Date()): T[] {
  return [...rows].sort((a, b) => {
    const byPriority = priority(a, now) - priority(b, now);
    if (byPriority !== 0) return byPriority;
    if (a.dueOn !== b.dueOn) return a.dueOn === null ? 1 : b.dueOn === null ? -1 : a.dueOn < b.dueOn ? -1 : 1;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
}
