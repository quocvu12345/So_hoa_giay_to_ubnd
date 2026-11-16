"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { visibleNavigation } from "@/config/navigation";
import type { Permission } from "@/lib/auth/permissions";
import { cn } from "@/lib/cn";

export type NavBadges = Partial<Record<string, number>>;

/**
 * Danh sách menu theo quyền của phân công đang dùng. Mục không có quyền không hiện
 * (không hiện rồi mới báo lỗi). Số đếm cạnh mục là việc đang chờ.
 */
export function NavList({ permissions, badges, onNavigate }: { permissions: Permission[]; badges?: NavBadges; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = visibleNavigation(permissions);
  return (
    <nav aria-label="Menu chính" className="grid gap-5">
      {groups.map((group) => (
        <div key={group.label} className="grid gap-1">
          <p className="px-3 text-[11px] font-bold tracking-[0.08em] text-muted uppercase">{group.label}</p>
          <ul className="grid gap-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const count = badges?.[item.href];
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={item.description}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 border-l-[3px] px-3 py-2 text-sm",
                      active ? "border-primary bg-accent-soft font-semibold text-primary" : "border-transparent text-ink hover:bg-soft",
                    )}
                  >
                    <Icon aria-hidden className="size-[18px] flex-none" />
                    <span className="flex-1">{item.label}</span>
                    {count ? (
                      <span className="min-w-6 bg-primary px-1.5 text-center text-[11px] font-bold text-white" aria-label={`${count} việc chờ`}>
                        {count}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
