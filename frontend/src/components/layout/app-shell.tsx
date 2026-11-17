import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, LogOut, Search } from "lucide-react";
import { mockSignOut } from "@/app/actions/session";
import { routes } from "@/config/routes";
import { can } from "@/lib/auth/session";
import { scopeLabel, type Session } from "@/lib/auth/types";
import { AssignmentSwitcher } from "./assignment-switcher";
import { CommandPalette } from "./command-palette";
import { ConnectionBanner } from "./connection-banner";
import { LogoutButton } from "./logout-button";
import { SessionNotices } from "./session-notices";
import { MobileNav } from "./mobile-nav";
import { NavList, type NavBadges } from "./nav-list";
import { OpenCommandButton } from "./open-command-button";

/**
 * Khung chung của mọi màn sau đăng nhập:
 * - Sidebar trái cố định (≥1024px) hoặc ngăn kéo (màn hẹp), nhóm theo tần suất dùng.
 * - Thanh trên: tìm nhanh, Đi nhanh (Ctrl K), thông báo, phân công đang dùng, đăng xuất.
 * - Vùng nội dung có id để phím tắt "Bỏ qua menu" nhảy tới.
 */
export function AppShell({ session, badges, unread, children }: { session: Session; badges: NavBadges; unread: number; children: ReactNode }) {
  const canSearch = can(session, "document.view");
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <a href="#noi-dung" className="sr-only z-50 bg-primary px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Bỏ qua menu, đến nội dung
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 overflow-y-auto border-r border-line bg-surface px-3 py-4 lg:flex">
        <Link href={routes.home} className="grid gap-0.5 px-3">
          <span className="text-[11px] font-bold tracking-[0.08em] text-primary uppercase">UBND · HĐND phường Từ Liêm</span>
          <span className="text-lg font-bold text-heading">Hồ sơ số</span>
        </Link>
        <NavList permissions={session.permissions} badges={badges} />
        {session.isMock && (
          <p className="mt-auto border border-dashed border-warn bg-warn-soft px-3 py-2 text-xs text-warn">
            Đang chạy dữ liệu giả lập (HOSO_MOCK=1). Không phải dữ liệu thật của cơ quan.
          </p>
        )}
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-surface px-4 py-2 sm:px-6">
          <MobileNav permissions={session.permissions} badges={badges} />
          {canSearch && (
            <form action={routes.search} role="search" className="flex min-w-0 flex-1 items-center gap-2 border border-line px-3 focus-within:border-primary md:max-w-md">
              <Search aria-hidden className="size-4 flex-none text-muted" />
              <label htmlFor="tim-nhanh" className="sr-only">Tìm văn bản, hồ sơ</label>
              <input id="tim-nhanh" name="q" type="search" placeholder="Tìm số ký hiệu, mã hồ sơ, trích yếu…" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </form>
          )}
          <div className="ml-auto flex items-center gap-2">
            <OpenCommandButton />
            <Link href={routes.notifications} className="relative grid size-10 place-items-center border border-line hover:border-primary" aria-label={`Thông báo, ${unread} chưa đọc`}>
              <Bell aria-hidden className="size-5" />
              {unread > 0 && <span className="absolute -top-1 -right-1 min-w-5 bg-bad px-1 text-center text-[11px] font-bold text-white">{unread}</span>}
            </Link>
            <AssignmentSwitcher assignments={session.assignments} activeId={session.activeAssignment.id} />
            <Link href={routes.account} className="hidden h-10 max-w-48 items-center truncate border border-line px-3 text-[13px] font-semibold hover:border-primary xl:inline-flex">
              {session.user.displayName}
            </Link>
            {session.isMock ? (
              <form action={mockSignOut}>
                <button type="submit" className="grid size-10 place-items-center border border-line hover:border-primary" aria-label="Đăng xuất">
                  <LogOut aria-hidden className="size-5" />
                </button>
              </form>
            ) : (
              <LogoutButton />
            )}
          </div>
        </header>
        <SessionNotices assignmentReset={Boolean(session.assignmentReset)} mfaRequired={Boolean(session.mfaRequired)} activeLabel={scopeLabel(session.activeAssignment)} />
        <ConnectionBanner />
        <main id="noi-dung" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          {children}
        </main>
      </div>

      <CommandPalette permissions={session.permissions} canSearch={canSearch} />
    </div>
  );
}
