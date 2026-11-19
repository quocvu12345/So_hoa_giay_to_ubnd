import "server-only";
import type { components } from "@/api/schema";
import { ok, serverApi } from "@/lib/api/server";
import type { AiAvailability } from "./ai-availability";
import { inboxQuery, NO_FILTERS, type InboxFilters } from "./inbox-filter";

export type InboxItem = components["schemas"]["InboxItem"];
export type InboxPage = components["schemas"]["PageOfInboxItem"];
export type InboxSummary = components["schemas"]["InboxSummary"];
export type InboxStatus = "inbox" | "filed" | "discarded";

/** AI-24: máy AI có đang đọc được không. Lỗi thì null: băng báo là phần phụ, không được làm hỏng hộp tiếp nhận. */
export async function getAiAvailability(): Promise<AiAvailability | null> {
  try {
    return ok(await serverApi().GET("/api/v1/ai/availability"));
  } catch {
    return null;
  }
}

/** Chỉ các PDF đã đọc xong: dùng ở chỗ cần "PDF kế tiếp" hay đếm, thay cho việc tải rồi tự lọc phần đầu hộp. */
export const READY_ONLY: InboxFilters = { ...NO_FILTERS, doc: "da-doc" };

/** Tab trên URL (?trang-thai=) ↔ trạng thái của API. */
export const INBOX_TABS = [
  { key: "cho-xep", status: "inbox", label: "Chờ xếp hồ sơ" },
  { key: "da-xep", status: "filed", label: "Đã xếp" },
  { key: "da-bo", status: "discarded", label: "Đã bỏ" },
] as const satisfies readonly { key: string; status: InboxStatus; label: string }[];

export function inboxTab(key: string | string[] | undefined) {
  return INBOX_TABS.find((t) => t.key === key) ?? INBOX_TABS[0];
}

/** Trang đầu của hộp tiếp nhận (mặc định 50 mục), lọc trên TOÀN hộp theo `filters` (BE-129, đặt cuối để các chỗ gọi cũ không đổi). Trang kế dùng `cursor` do API trả, không coi phản hồi là mảng. */
export async function getInbox(status: InboxStatus, cursor?: string, limit = 50, filters: InboxFilters = NO_FILTERS): Promise<InboxPage> {
  return ok(await serverApi().GET("/api/v1/intake/inbox", { params: { query: { status, cursor, limit, ...inboxQuery(filters) } } }));
}

/** Số PDF theo tình trạng đọc, cùng lô/nhóm với `filters` nhưng không áp tình trạng đọc, cho các nút lọc. */
export async function getInboxSummary(status: InboxStatus, filters: InboxFilters = NO_FILTERS): Promise<InboxSummary> {
  const { batch, group, type } = inboxQuery(filters);
  return ok(await serverApi().GET("/api/v1/intake/inbox/summary", { params: { query: { status, batch, group, type } } }));
}
