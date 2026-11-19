"use client";

import { switchAssignment } from "@/app/actions/session";
import type { Assignment } from "@/lib/auth/types";
import { scopeLabel } from "@/lib/auth/types";

/**
 * Người có nhiều phân công (ví dụ chuyên viên kiêm văn thư) chọn phân công đang làm.
 * Menu, hàng việc và nút thao tác đổi theo phân công. Chỉ một phân công thì hiện nhãn tĩnh.
 * - `bar`: thanh trên cùng, từ 640px trở lên (màn hẹp không đủ chỗ).
 * - `menu`: đầu ngăn kéo menu của màn hẹp, để điện thoại và cửa sổ hẹp vẫn đổi được vai trò.
 */
export function AssignmentSwitcher({ assignments, activeId, variant = "bar" }: { assignments: Assignment[]; activeId: string; variant?: "bar" | "menu" }) {
  const active = assignments.find((a) => a.id === activeId) ?? assignments[0];
  const menu = variant === "menu";
  if (assignments.length < 2) {
    return menu ? (
      <p className="grid gap-0.5 border-b border-line px-4 py-3 text-[13px]">
        <span className="text-xs font-semibold text-muted">Vai trò</span>
        {scopeLabel(active)}
      </p>
    ) : (
      <span className="hidden text-[13px] text-muted sm:inline">{scopeLabel(active)}</span>
    );
  }
  const id = menu ? "assignment-switcher-menu" : "assignment-switcher";
  return (
    <form action={switchAssignment} className={menu ? "grid gap-1 border-b border-line px-4 py-3" : "hidden items-center gap-2 sm:flex"}>
      <label htmlFor={id} className={menu ? "text-xs font-semibold text-muted" : "hidden text-xs font-semibold text-muted md:inline"}>
        Vai trò
      </label>
      <select
        id={id}
        name="assignmentId"
        defaultValue={active.id}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={menu ? "h-10 w-full border border-line bg-surface px-2 text-[13px]" : "h-10 max-w-[220px] border border-line bg-surface px-2 text-[13px] lg:max-w-[280px]"}
      >
        {assignments.map((a) => (
          <option key={a.id} value={a.id}>
            {scopeLabel(a)}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="h-10 border border-line px-2 text-[13px]">Đổi</button>
      </noscript>
    </form>
  );
}
