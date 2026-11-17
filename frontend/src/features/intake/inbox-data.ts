import "server-only";
import type { components } from "@/api/schema";
import { ok, serverApi } from "@/lib/api/server";

export type InboxItem = components["schemas"]["InboxItem"];
export type InboxPage = components["schemas"]["PageOfInboxItem"];
export type InboxStatus = "inbox" | "filed" | "discarded";

/** Tab trên URL (?trang-thai=) ↔ trạng thái của API. */
export const INBOX_TABS = [
  { key: "cho-xep", status: "inbox", label: "Chờ xếp hồ sơ" },
  { key: "da-xep", status: "filed", label: "Đã xếp" },
  { key: "da-bo", status: "discarded", label: "Đã bỏ" },
] as const satisfies readonly { key: string; status: InboxStatus; label: string }[];

export function inboxTab(key: string | string[] | undefined) {
  return INBOX_TABS.find((t) => t.key === key) ?? INBOX_TABS[0];
}

/** Trang đầu của hộp tiếp nhận (mặc định 50 mục). Trang kế dùng `cursor` do API trả, không coi phản hồi là mảng. */
export async function getInbox(status: InboxStatus, cursor?: string, limit = 50): Promise<InboxPage> {
  return ok(await serverApi().GET("/api/v1/intake/inbox", { params: { query: { status, cursor, limit } } }));
}
