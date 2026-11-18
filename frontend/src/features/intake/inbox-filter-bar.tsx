"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { inboxHref, isFiltered, type InboxFilters } from "./inbox-filter";

export type BatchOption = { id: string; code: string; boxLabel: string | null };
export type GroupOption = { code: string; title: string };

const selectClass = "h-9 max-w-64 border border-line-strong bg-surface px-2 text-[13px]";

/**
 * Lọc hộp tiếp nhận theo lô quét và nhóm hồ sơ AI gợi ý (FE-21, BE-129). Chọn xong là đổi địa chỉ (máy chủ lọc trên toàn hộp),
 * nên gửi đường dẫn là mở đúng bộ lọc. Tình trạng đọc lọc bằng các nút ở bảng.
 */
export function InboxFilterBar({ tabKey, filters, batches, groups }: { tabKey: string; filters: InboxFilters; batches: BatchOption[]; groups: GroupOption[] }) {
  const router = useRouter();
  const go = (change: Partial<InboxFilters>) => router.push(inboxHref(tabKey, { ...filters, ...change }) as Route);
  // Giá trị đang lọc mà không còn trong danh sách (lô đã đóng quá cũ, nhóm ngừng dùng) vẫn hiện để biết đang lọc gì và bỏ được.
  const batchKnown = !filters.batch || batches.some((b) => b.id === filters.batch);
  const groupKnown = !filters.group || groups.some((g) => g.code === filters.group);

  return (
    <div role="group" aria-label="Lọc hộp tiếp nhận" className="flex flex-wrap items-center gap-3 text-[13px]">
      <label className="flex items-center gap-2">
        <span className="text-muted">Lô quét</span>
        <select className={selectClass} value={filters.batch ?? ""} onChange={(e) => go({ batch: e.target.value || null })}>
          <option value="">Tất cả lô</option>
          {!batchKnown && <option value={filters.batch ?? ""}>Lô đang chọn</option>}
          {batches.map((b) => (
            <option key={b.id} value={b.id}>{b.code}{b.boxLabel ? ` · ${b.boxLabel}` : ""}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="text-muted">Nhóm hồ sơ</span>
        <select className={selectClass} value={filters.group ?? ""} onChange={(e) => go({ group: e.target.value || null })}>
          <option value="">Tất cả nhóm</option>
          {!groupKnown && <option value={filters.group ?? ""}>{filters.group}</option>}
          {groups.map((g) => (
            <option key={g.code} value={g.code}>{g.code} · {g.title}</option>
          ))}
        </select>
      </label>
      {isFiltered(filters) && (
        <Link href={inboxHref(tabKey) as Route} className="text-primary hover:underline">Bỏ bộ lọc</Link>
      )}
    </div>
  );
}
