"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { cn } from "@/lib/cn";

export type TabItem = { href: Route; label: string; count?: number };

/**
 * Tab là đường dẫn thật: mở được trong thẻ mới, gửi được cho người khác, nút Back hoạt động.
 * Tab đầu tiên (trang gốc) chỉ sáng khi khớp chính xác.
 */
export function TabsNav({ tabs, label }: { tabs: TabItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-4 sm:px-6">
      {tabs.map((tab, i) => {
        const active = i === 0 ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex-none border-b-[3px] px-3 py-2.5 text-sm font-semibold",
              active ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {tab.label}
            {tab.count !== undefined && <span className="ml-1.5 text-xs font-normal text-muted">{tab.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
