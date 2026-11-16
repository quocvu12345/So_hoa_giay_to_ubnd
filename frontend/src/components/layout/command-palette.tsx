"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { CornerDownLeft, Search } from "lucide-react";
import { visibleNavigation } from "@/config/navigation";
import type { Permission } from "@/lib/auth/permissions";
import { cn } from "@/lib/cn";

/** Bỏ dấu tiếng Việt để gõ "ho so" vẫn ra "Hồ sơ". */
function fold(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

type Option = { key: string; label: string; hint: string; href: Route };

/**
 * Ô Đi nhanh: Ctrl+K (⌘K trên Mac) hoặc phím "/" để mở.
 * Gõ tên màn hình để chuyển ngay; gõ số ký hiệu hoặc mã hồ sơ để tìm trong Tra cứu.
 */
export function CommandPalette({ permissions, canSearch }: { permissions: Permission[]; canSearch: boolean }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const pages = useMemo<Option[]>(
    () =>
      visibleNavigation(permissions).flatMap((g) =>
        g.items.map((i) => ({ key: i.href, label: i.label, hint: i.description, href: i.href, search: fold(`${i.label} ${i.description} ${i.keywords ?? ""}`) })),
      ),
    [permissions],
  );

  const options = useMemo<Option[]>(() => {
    const q = fold(query.trim());
    const matched = q ? pages.filter((p) => (p as Option & { search: string }).search.includes(q)) : pages;
    const searchOption: Option[] =
      canSearch && query.trim()
        ? [{ key: "search", label: `Tìm “${query.trim()}”`, hint: "Tìm trong số ký hiệu, trích yếu, mã hồ sơ và nội dung đã đọc", href: `/tra-cuu?q=${encodeURIComponent(query.trim())}` as Route }]
        : [];
    return [...matched, ...searchOption];
  }, [pages, query, canSearch]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable=true]");
      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing)) {
        event.preventDefault();
        setQuery("");
        setActive(0);
        dialogRef.current?.showModal();
      }
    }
    function onOpenRequest() {
      setQuery("");
      setActive(0);
      dialogRef.current?.showModal();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("hoso:open-command", onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("hoso:open-command", onOpenRequest);
    };
  }, []);

  function go(option: Option | undefined) {
    if (!option) return;
    dialogRef.current?.close();
    router.push(option.href);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label="Đi nhanh"
      className="mx-auto mt-[12vh] w-[min(640px,calc(100vw-32px))] border border-line-strong bg-surface p-0 text-ink shadow-xl backdrop:bg-heading/40"
      onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
    >
      <div className="flex items-center gap-2 border-b border-line px-3">
        <Search aria-hidden className="size-4 text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(options[active]);
            }
          }}
          placeholder="Gõ tên màn hình, mã hồ sơ hoặc số ký hiệu…"
          aria-label="Tìm màn hình hoặc hồ sơ"
          className="h-12 flex-1 bg-transparent text-[15px] outline-none"
        />
        <kbd className="border border-line px-1.5 text-[11px] text-muted">Esc</kbd>
      </div>
      <ul role="listbox" aria-label="Kết quả" className="max-h-[50vh] overflow-y-auto py-1">
        {options.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Không có màn hình nào khớp.</li>}
        {options.map((option, i) => (
          <li key={option.key} role="option" aria-selected={i === active}>
            <button
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => go(option)}
              className={cn("flex w-full items-center gap-3 px-4 py-2 text-left", i === active && "bg-accent-soft")}
            >
              <span className="grid flex-1 gap-0.5">
                <span className="text-sm font-semibold">{option.label}</span>
                <span className="text-xs text-muted">{option.hint}</span>
              </span>
              {i === active && <CornerDownLeft aria-hidden className="size-4 text-muted" />}
            </button>
          </li>
        ))}
      </ul>
      <p className="border-t border-line px-4 py-2 text-xs text-muted">↑ ↓ để chọn · Enter để mở · Ctrl K hoặc / để mở lại</p>
    </dialog>
  );
}
