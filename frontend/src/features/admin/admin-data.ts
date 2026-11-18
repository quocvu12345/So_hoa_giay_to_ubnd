import "server-only";
import type { components } from "@/api/schema";
import { ok, serverApi } from "@/lib/api/server";

export type AdminUser = components["schemas"]["AdminUserListItem"];
export type AdminUserDetail = components["schemas"]["AdminUserDetail"];
export type AdminAssignment = components["schemas"]["AdminAssignmentDto"];
export type AdminDelegation = components["schemas"]["AdminDelegationDto"];
export type RoleInfo = components["schemas"]["RoleInfo"];
export type LoginEvent = { at: string; clientIp: string | null };

/** Người dùng (BE-34, BE-121): tìm theo tên/tên đăng nhập, lọc khóa/mở, chỉ người có phân công sắp hết hạn. */
export async function getUsers(filter: { q?: string; active?: boolean; expiring?: boolean }): Promise<AdminUser[]> {
  return ok(await serverApi().GET("/api/v1/admin/users", { params: { query: { q: filter.q || undefined, active: filter.active, expiring: filter.expiring || undefined } } }));
}

export async function getUser(id: string): Promise<AdminUserDetail> {
  return ok(await serverApi().GET("/api/v1/admin/users/{id}", { params: { path: { id } } }));
}

/** Vai trò và quyền của từng vai trò, để màn ủy quyền chỉ cho chọn phần quyền người ủy quyền thật sự có (BE-127). */
export async function getRoles(): Promise<RoleInfo[]> {
  return ok(await serverApi().GET("/api/v1/admin/roles"));
}

export async function getOrganizations() {
  return ok(await serverApi().GET("/api/v1/catalog/organizations"));
}

export async function getAllDepartments(organization: string) {
  return ok(await serverApi().GET("/api/v1/catalog/departments", { params: { query: { organization } } }));
}

/** Các lần đăng nhập gần đây của chính người dùng (BE-123). */
export async function getMyLogins(limit = 15): Promise<LoginEvent[]> {
  return ok(await serverApi().GET("/api/v1/me/logins", { params: { query: { limit } } })) as LoginEvent[];
}
