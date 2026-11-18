import "server-only";
import type { components } from "@/api/schema";
import { ok, serverApi } from "@/lib/api/server";
import { dayEndExclusive, dayStart, type AuditFilter } from "./audit-filter";

export type AuditRow = components["schemas"]["AuditRow"];
export type ErrorEventRow = components["schemas"]["ErrorEventRow"];

/** Số dòng mỗi trang. Đủ trang thì có thể còn trang sau (API phân trang theo id giảm dần, không trả tổng). */
export const PAGE_SIZE = 50;

function range(f: AuditFilter) {
  return { from: f.from ? dayStart(f.from) : undefined, to: f.to ? dayEndExclusive(f.to) : undefined };
}

/**
 * Tra Mã lỗi người dùng gửi (BE-117) ra request, người và mã tương quan; khi lọc theo Mã lỗi hoặc mã tương quan còn kèm các lần truy cập cùng request.
 * Mã lỗi hết hạn lưu (90 ngày) hoặc chưa ghi kịp thì không có dòng nào: lúc đó tra log theo Mã lỗi.
 */
export async function getErrors(f: AuditFilter): Promise<ErrorEventRow[]> {
  return ok(
    await serverApi().GET("/api/v1/admin/errors", {
      params: { query: { errorId: f.errorId || undefined, correlationId: f.correlationId || undefined, ...range(f), before: f.before ? Number(f.before) : undefined, limit: PAGE_SIZE } },
    }),
  );
}

/** Nhật ký truy cập (kind=access) hoặc thay đổi dữ liệu (kind=change, chỉ tên cột, không giá trị). Chỉ đọc (BE-88). */
export async function getAudit(f: AuditFilter): Promise<AuditRow[]> {
  return ok(
    await serverApi().GET("/api/v1/admin/audit", {
      params: {
        query: {
          kind: f.view === "thay-doi" ? "change" : "access",
          objectType: f.objectType || undefined,
          correlationId: f.correlationId || undefined,
          ...range(f),
          before: f.before ? Number(f.before) : undefined,
          limit: PAGE_SIZE,
        },
      },
    }),
  );
}
