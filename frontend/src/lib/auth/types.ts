import type { Permission, RoleCode } from "./permissions";

/** Một phân công còn hiệu lực (bảng user_roles hoặc ủy quyền từ delegations). */
export type Assignment = {
  id: string;
  role: RoleCode;
  roleName: string;
  organizationCode: string | null;
  organizationName: string | null;
  departmentCode: string | null;
  departmentName: string | null;
  /** Có giá trị khi phân công đến từ ủy quyền có thời hạn. */
  delegatedUntil?: string | null;
};

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
};

/** Hình dạng của GET /api/v1/me (docs/02-kien-truc-server.md mục 8). */
export type Session = {
  user: SessionUser;
  assignments: Assignment[];
  activeAssignment: Assignment;
  permissions: Permission[];
  isMock: boolean;
};

export function scopeLabel(a: Assignment): string {
  return [a.roleName, a.departmentName ?? a.organizationName].filter(Boolean).join(" · ");
}
