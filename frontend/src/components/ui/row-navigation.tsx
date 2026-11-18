"use client";

import { useEffect } from "react";

/** Liên kết chính của một dòng danh sách: thêm `data-row` vào thẻ <a> mở dòng đó. */
export const ROW_SELECTOR = "a[data-row]";

/** Đang gõ chữ hoặc đang chọn trong một điều khiển có phím mũi tên riêng thì không chiếm phím. */
function ownsArrowKeys(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.closest("input, textarea, select, [role='listbox'], [role='menu'], [role='tablist'], [role='slider'], [role='radiogroup']")) return true;
  // Khung xem ảnh trang dùng mũi tên trái/phải để đổi trang; hộp thoại có vòng giữ phím riêng.
  return Boolean(target.closest("[role='dialog'], dialog[open]"));
}

function defaultVisible(element: HTMLElement): boolean {
  return element.getClientRects().length > 0;
}

/** Vị trí dòng kế tiếp theo phím; `current` = -1 khi chưa dòng nào đang được chọn. Hàm thuần để kiểm bằng test. */
export function nextRowIndex(key: string, current: number, count: number): number {
  if (count === 0) return -1;
  switch (key) {
    case "ArrowDown":
      return current < 0 ? 0 : Math.min(current + 1, count - 1);
    case "ArrowUp":
      return current < 0 ? count - 1 : Math.max(current - 1, 0);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return -1;
  }
}

/**
 * Đi trong danh sách bằng bàn phím (FE-48, docs/07 quy tắc 8): ↑ ↓ chuyển dòng, Home/End về đầu/cuối, Enter mở (dòng là liên kết nên Enter có sẵn).
 * Không vẽ gì: gắn một trình nghe phím cho cả trang, chỉ hoạt động khi trang có các liên kết `a[data-row]` đang hiện.
 * Nhường phím cho ô nhập, danh sách chọn, hộp thoại và mọi tổ hợp có Ctrl/Alt/⌘/Shift; không có dòng nào thì để trang cuộn như thường.
 * `visible`: cách xác định dòng đang hiện (mặc định dùng kích thước thật; bảng và thẻ cùng có mặt trong DOM nhưng chỉ một bên hiện).
 */
export function RowNavigation({ visible = defaultVisible }: { visible?: (element: HTMLElement) => boolean }) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      if (ownsArrowKeys(event.target)) return;
      const rows = [...document.querySelectorAll<HTMLElement>(ROW_SELECTOR)].filter(visible);
      if (rows.length === 0) return;
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const next = nextRowIndex(event.key, active ? rows.indexOf(active) : -1, rows.length);
      if (next < 0) return;
      event.preventDefault();
      rows[next].focus();
      rows[next].scrollIntoView?.({ block: "nearest" });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible]);
  return null;
}
