"use client";

import { useRef, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";
import { NavList, type NavBadges } from "./nav-list";

/** Menu dạng ngăn kéo cho màn hẹp (dưới 1024px). Trên màn rộng dùng sidebar cố định. `top`: phần đặt trên menu (ô đổi vai trò). */
export function MobileNav({ permissions, badges, top }: { permissions: Permission[]; badges?: NavBadges; top?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="grid size-10 place-items-center border border-line text-ink lg:hidden"
        aria-label="Mở menu"
      >
        <Menu aria-hidden className="size-5" />
      </button>
      <dialog
        ref={ref}
        aria-label="Menu"
        className="m-0 h-dvh max-h-dvh w-[min(300px,85vw)] border-r border-line bg-surface p-0 backdrop:bg-heading/40"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="font-bold text-heading">Hồ sơ số</span>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Đóng menu" className="grid size-9 place-items-center">
            <X aria-hidden className="size-5" />
          </button>
        </div>
        {top}
        <div className="p-3">
          <NavList permissions={permissions} badges={badges} onNavigate={() => ref.current?.close()} />
        </div>
      </dialog>
    </>
  );
}
