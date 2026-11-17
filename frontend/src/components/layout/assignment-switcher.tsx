"use client";

import { switchAssignment } from "@/app/actions/session";
import type { Assignment } from "@/lib/auth/types";
import { scopeLabel } from "@/lib/auth/types";

/**
 * Người có nhiều phân công (ví dụ chuyên viên kiêm văn thư) chọn phân công đang làm.
 * Menu, hàng việc và nút thao tác đổi theo phân công. Chỉ một phân công thì hiện nhãn tĩnh.
 */
export function AssignmentSwitcher({ assignments, activeId }: { assignments: Assignment[]; activeId: string }) {
  const active = assignments.find((a) => a.id === activeId) ?? assignments[0];
  if (assignments.length < 2) {
    return <span className="hidden text-[13px] text-muted sm:inline">{scopeLabel(active)}</span>;
  }
  return (
    <form action={switchAssignment} className="hidden sm:block">
      <label className="sr-only" htmlFor="assignment-switcher">Đang làm với phân công</label>
      <select
        id="assignment-switcher"
        name="assignmentId"
        defaultValue={active.id}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-10 max-w-[220px] border border-line bg-surface px-2 text-[13px] lg:max-w-[280px]"
      >
        {assignments.map((a) => (
          <option key={a.id} value={a.id}>
            {scopeLabel(a)}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="ml-1 h-10 border border-line px-2 text-[13px]">Đổi</button>
      </noscript>
    </form>
  );
}
