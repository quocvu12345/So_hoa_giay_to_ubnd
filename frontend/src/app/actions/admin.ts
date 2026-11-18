"use server";

import { revalidatePath } from "next/cache";
import { UUID } from "@/features/dossier/dossier-data";
import type { AdminAssignment, AdminDelegation, AdminUserDetail } from "@/features/admin/admin-data";
import { dayToInstant, validateAssignment, validateUserForm, type AssignmentForm, type DelegationForm, type UserForm } from "@/features/admin/user-rules";
import type { ActionResult } from "@/lib/action-result";
import { ok, serverApi } from "@/lib/api/server";
import { runAction } from "@/lib/actions";
import { log } from "@/lib/log";

function assertId(id: string) {
  if (!UUID.test(id)) throw new TypeError("Mã không hợp lệ.");
}

function refresh(userId?: string) {
  revalidatePath("/quan-tri/nguoi-dung");
  if (userId) revalidatePath(`/quan-tri/nguoi-dung/${userId}`);
}

const text = (value: string) => value.trim() || null;

/** Thêm người dùng (BE-34). Đăng nhập thật qua Keycloak; ở đây chỉ tạo hồ sơ người dùng, rồi thêm phân công. */
export async function createUser(form: UserForm): Promise<ActionResult<AdminUserDetail>> {
  return runAction("admin_user_create", async () => {
    if (Object.keys(validateUserForm(form)).length > 0) throw new TypeError("Thông tin người dùng không hợp lệ.");
    const created = ok(await serverApi().POST("/api/v1/admin/users", { body: { username: form.username.trim().toLowerCase(), displayName: form.displayName.trim(), email: text(form.email), externalAuthSubject: text(form.externalAuthSubject) } }));
    log.info("admin_user_created", { userId: created.user.id });
    refresh();
    return created;
  });
}

/** Sửa họ tên, email, mã danh tính; khóa hoặc mở khóa. Khóa thu hồi mọi phiên đang mở; API từ chối khóa chính mình hoặc quản trị cuối cùng. */
export async function updateUser(id: string, input: { displayName?: string; email?: string; externalAuthSubject?: string; active?: boolean }): Promise<ActionResult<AdminUserDetail>> {
  return runAction("admin_user_update", async () => {
    assertId(id);
    const detail = ok(await serverApi().PATCH("/api/v1/admin/users/{id}", { params: { path: { id } }, body: { displayName: input.displayName?.trim() ?? null, email: input.email ?? null, externalAuthSubject: input.externalAuthSubject ?? null, active: input.active ?? null } }));
    log.info("admin_user_updated", { userId: id, locked: input.active === false });
    refresh(id);
    return detail;
  });
}

/** Buộc đăng xuất mọi phiên đang mở của một người (mất thiết bị, nghi lộ cookie). */
export async function revokeUserSessions(id: string): Promise<ActionResult<{ revoked: number }>> {
  return runAction("admin_user_revoke_sessions", async () => {
    assertId(id);
    const result = ok(await serverApi().POST("/api/v1/admin/users/{id}/revoke-sessions", { params: { path: { id } } }));
    log.info("admin_sessions_revoked", { userId: id });
    return { revoked: Number((result as { revoked?: number } | undefined)?.revoked ?? 0) };
  });
}

/** Thêm phân công có thời hạn và căn cứ (BE-34). Ngày là ngày Việt Nam: bắt đầu từ 00:00, hết hạn bao gồm cả ngày cuối. */
export async function createAssignment(form: AssignmentForm & { isDeputy: boolean }): Promise<ActionResult<AdminAssignment>> {
  return runAction("admin_assignment_create", async () => {
    assertId(form.userId);
    if (Object.keys(validateAssignment(form)).length > 0) throw new TypeError("Phân công không hợp lệ.");
    const created = ok(
      await serverApi().POST("/api/v1/admin/assignments", {
        body: {
          userId: form.userId, roleCode: form.roleCode, organizationCode: text(form.organizationCode), departmentCode: text(form.departmentCode),
          validFrom: form.validFrom ? dayToInstant(form.validFrom, "start") : null, validUntil: form.validUntil ? dayToInstant(form.validUntil, "end") : null,
          basis: form.basis.trim(), isDeputy: form.isDeputy,
        },
      }),
    );
    log.info("admin_assignment_created", { userId: form.userId, role: form.roleCode });
    refresh(form.userId);
    return created;
  });
}

/** Kết thúc phân công ngay. Gói xuất tạo bằng phân công này không còn tải được. API từ chối kết thúc phân công quản trị cuối cùng. */
export async function endAssignment(userId: string, assignmentId: string): Promise<ActionResult<AdminAssignment>> {
  return runAction("admin_assignment_end", async () => {
    assertId(userId);
    assertId(assignmentId);
    const ended = ok(await serverApi().POST("/api/v1/admin/assignments/{id}/end", { params: { path: { id: assignmentId } } }));
    log.info("admin_assignment_ended", { userId, assignmentId });
    refresh(userId);
    return ended;
  });
}

/** Ủy quyền có thời hạn (tối đa 90 ngày, chỉ phần quyền người ủy quyền đang có). `ownerUserId` để làm mới trang của người ủy quyền. */
export async function createDelegation(ownerUserId: string, form: DelegationForm): Promise<ActionResult<AdminDelegation>> {
  return runAction("admin_delegation_create", async () => {
    assertId(ownerUserId);
    assertId(form.fromAssignmentId);
    assertId(form.toUserId);
    if (form.permissionCodes.length === 0 || form.permissionCodes.length > 40 || form.permissionCodes.some((c) => !/^[a-z]+\.[a-z_]+$/.test(c))) throw new TypeError("Quyền không hợp lệ.");
    const until = dayToInstant(form.validUntil, "end");
    if (!until) throw new TypeError("Ngày hết hạn không hợp lệ.");
    const created = ok(
      await serverApi().POST("/api/v1/admin/delegations", {
        body: { fromAssignmentId: form.fromAssignmentId, toUserId: form.toUserId, permissionCodes: form.permissionCodes, validFrom: form.validFrom ? dayToInstant(form.validFrom, "start") : null, validUntil: until, basis: form.basis.trim() },
      }),
    );
    log.info("admin_delegation_created", { from: form.fromAssignmentId, to: form.toUserId });
    refresh(ownerUserId);
    revalidatePath(`/quan-tri/nguoi-dung/${form.toUserId}`);
    return created;
  });
}

export async function revokeDelegation(ownerUserId: string, delegationId: string): Promise<ActionResult> {
  return runAction("admin_delegation_revoke", async () => {
    assertId(ownerUserId);
    assertId(delegationId);
    ok(await serverApi().POST("/api/v1/admin/delegations/{id}/revoke", { params: { path: { id: delegationId } } }));
    log.info("admin_delegation_revoked", { delegationId });
    refresh(ownerUserId);
  });
}
