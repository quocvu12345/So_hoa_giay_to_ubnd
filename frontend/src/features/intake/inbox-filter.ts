import { routes } from "@/config/routes";
import { AI_FILTERS, type AiFilterKey } from "./inbox-live";

/**
 * Bộ lọc của hộp tiếp nhận (FE-21, BE-129), nằm trên địa chỉ để gửi đường dẫn là mở đúng bộ lọc:
 * `?doc=` tình trạng đọc, `?lo=` lô quét, `?nhom=` nhóm hồ sơ do AI gợi ý. Lọc ở máy chủ trên toàn hộp, không chỉ phần đã tải.
 * Không `import "server-only"`: dùng được ở trình duyệt và trong test.
 */
export type InboxFilters = { doc: AiFilterKey; batch: string | null; group: string | null };

export const NO_FILTERS: InboxFilters = { doc: "tat-ca", batch: null, group: null };

type Params = Record<string, string | string[] | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GROUP_CODE = /^[A-Za-z0-9._-]{1,20}$/;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Giá trị lạ hoặc sai dạng bị bỏ (về "không lọc"), không đoán và không chuyển nguyên văn lên API. */
export function parseInboxFilters(params: Params): InboxFilters {
  const doc = AI_FILTERS.find((f) => f.key === first(params.doc))?.key ?? "tat-ca";
  const batch = first(params.lo)?.trim() ?? "";
  const group = first(params.nhom)?.trim() ?? "";
  return { doc, batch: UUID.test(batch) ? batch.toLowerCase() : null, group: GROUP_CODE.test(group) ? group : null };
}

export function isFiltered(filters: InboxFilters): boolean {
  return filters.doc !== "tat-ca" || filters.batch !== null || filters.group !== null;
}

/** Tham số gửi cho API. */
export function inboxQuery(filters: InboxFilters): { read?: string; batch?: string; group?: string } {
  const read = AI_FILTERS.find((f) => f.key === filters.doc)?.read ?? null;
  return { ...(read ? { read } : {}), ...(filters.batch ? { batch: filters.batch } : {}), ...(filters.group ? { group: filters.group } : {}) };
}

/** Địa chỉ của thẻ kèm bộ lọc; bỏ tham số mặc định cho gọn. */
export function inboxHref(tabKey: string, filters: Partial<InboxFilters> = {}): string {
  const query = new URLSearchParams();
  if (tabKey !== "cho-xep") query.set("trang-thai", tabKey);
  if (filters.doc && filters.doc !== "tat-ca") query.set("doc", filters.doc);
  if (filters.batch) query.set("lo", filters.batch);
  if (filters.group) query.set("nhom", filters.group);
  const text = query.toString();
  return text ? `${routes.intake}?${text}` : routes.intake;
}
