"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createAssignment, createDelegation, endAssignment, revokeDelegation, revokeUserSessions, updateUser } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Chip } from "@/components/ui/status-chip";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatDateTime } from "@/lib/format";
import { ROLE_NAMES, type RoleCode } from "@/lib/auth/permissions";
import { useServerAction } from "@/lib/use-server-action";
import type { AdminAssignment, AdminDelegation, AdminUser, RoleInfo } from "./admin-data";
import {
  ASSIGNMENT_STATE, DELEGATION_STATE, expiryChip, maxDelegationEnd, MIN_BASIS, roleScope, todayVietnam, validateAssignment, validateDelegation, validateUserForm,
  type AssignmentErrors, type DelegationErrors, type UserFormErrors,
} from "./user-rules";

const roleName = (code: string) => ROLE_NAMES[code as RoleCode] ?? code;
const field = "h-9 border border-line-strong bg-surface px-2 text-sm font-normal outline-none focus:border-primary aria-[invalid=true]:border-bad";
const area = "border border-line-strong bg-surface p-2 text-sm font-normal outline-none focus:border-primary aria-[invalid=true]:border-bad";
const err = (message?: string) => message && <span role="alert" className="text-[13px] font-normal text-bad">{message}</span>;
const failure = (r: { message: string; errorId?: string }) => (r.errorId ? `${r.message} (Mã lỗi ${r.errorId})` : r.message);

type Org = { code: string; name: string };
type Dep = { code: string; name: string };

// =====================================================================================================================
// Thông tin người dùng
// =====================================================================================================================
export function UserInfoPanel({ user, subject, isSelf }: { user: AdminUser; subject: string | null; isSelf: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [locking, setLocking] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [form, setForm] = useState({ username: user.username, displayName: user.displayName, email: user.email ?? "", externalAuthSubject: subject ?? "" });
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const update = useServerAction(updateUser, { toastErrors: false });
  const revoke = useServerAction(revokeUserSessions, { toastErrors: false });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const found = validateUserForm(form, "edit");
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const result = await update.run(user.id, { displayName: form.displayName, email: form.email.trim(), externalAuthSubject: form.externalAuthSubject.trim() });
    if (result.ok) {
      toast.success("Đã lưu thông tin người dùng.");
      setEditing(false);
      router.refresh();
    } else setFormError(failure(result));
  }

  async function setActive(active: boolean) {
    setFormError(null);
    const result = await update.run(user.id, { active });
    if (result.ok) {
      toast.success(active ? "Đã mở khóa tài khoản." : "Đã khóa tài khoản; mọi phiên đang mở bị thu hồi.");
      setLocking(false);
      router.refresh();
    } else setFormError(failure(result));
  }

  async function revokeAll() {
    setFormError(null);
    const result = await revoke.run(user.id);
    if (result.ok) {
      toast.success(result.data.revoked > 0 ? `Đã buộc đăng xuất ${result.data.revoked} phiên.` : "Người này không có phiên nào đang mở.");
      setRevoking(false);
    } else setFormError(failure(result));
  }

  const busy = update.pending || revoke.pending;
  return (
    <section className="grid gap-3 border border-line bg-surface p-4" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id={`${id}-title`} className="text-base font-bold">Thông tin</h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => { setErrors({}); setFormError(null); setEditing(true); }}>Sửa thông tin</Button>
          <Button size="sm" onClick={() => { setFormError(null); setRevoking(true); }}>Buộc đăng xuất</Button>
          {user.active ? <Button size="sm" variant="danger" onClick={() => { setFormError(null); setLocking(true); }} disabled={isSelf} title={isSelf ? "Không thể tự khóa tài khoản của chính mình" : undefined}>Khóa tài khoản</Button> : <Button size="sm" variant="primary" onClick={() => setActive(true)} disabled={busy}>Mở khóa</Button>}
        </div>
      </div>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-xs text-muted">Tên đăng nhập</dt><dd className="font-mono">{user.username}</dd></div>
        <div><dt className="text-xs text-muted">Email</dt><dd>{user.email ?? "Chưa có"}</dd></div>
        <div><dt className="text-xs text-muted">Tình trạng</dt><dd>{user.active ? <Chip tone="ok">Đang dùng</Chip> : <Chip tone="bad">Đã khóa</Chip>}{user.isDemo && <> <Chip>Tài khoản mẫu</Chip></>}</dd></div>
        <div><dt className="text-xs text-muted">Đăng nhập gần nhất</dt><dd>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Chưa đăng nhập"}</dd></div>
      </dl>
      {formError && !editing && !locking && !revoking && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{formError}</p>}

      <Dialog open={editing} onClose={() => !busy && setEditing(false)} title="Sửa thông tin người dùng"
        footer={<><Button onClick={() => setEditing(false)} disabled={busy}>Hủy</Button><Button variant="primary" type="submit" form={`${id}-edit`} disabled={busy}>{update.pending ? "Đang lưu…" : "Lưu"}</Button></>}>
        <form id={`${id}-edit`} onSubmit={save} className="grid gap-3" noValidate>
          <label className="grid gap-1 text-[13px] font-semibold">Họ tên hiển thị
            <input value={form.displayName} onChange={(e) => setForm((c) => ({ ...c, displayName: e.target.value }))} className={field} aria-invalid={errors.displayName ? true : undefined} />{err(errors.displayName)}</label>
          <label className="grid gap-1 text-[13px] font-semibold">Email
            <input type="email" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} className={field} aria-invalid={errors.email ? true : undefined} />{err(errors.email)}</label>
          <label className="grid gap-1 text-[13px] font-semibold">Mã danh tính ở hệ thống đăng nhập
            <input value={form.externalAuthSubject} onChange={(e) => setForm((c) => ({ ...c, externalAuthSubject: e.target.value }))} className={field} aria-invalid={errors.externalAuthSubject ? true : undefined} />{err(errors.externalAuthSubject)}</label>
          {formError && editing && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{formError}</p>}
        </form>
      </Dialog>

      <Dialog open={locking} onClose={() => !busy && setLocking(false)} title={`Khóa tài khoản ${user.displayName}?`}
        description="Người này bị đăng xuất ngay trên mọi thiết bị và gói xuất của họ không tải được nữa. Mở khóa được bất kỳ lúc nào."
        footer={<><Button onClick={() => setLocking(false)} disabled={busy}>Giữ nguyên</Button><Button variant="danger" onClick={() => setActive(false)} disabled={busy}>{update.pending ? "Đang khóa…" : "Khóa tài khoản"}</Button></>}>
        {formError && locking && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{formError}</p>}
      </Dialog>

      <Dialog open={revoking} onClose={() => !busy && setRevoking(false)} title="Buộc đăng xuất mọi phiên?"
        description="Dùng khi mất thiết bị hoặc nghi lộ phiên đăng nhập. Người này đăng nhập lại được bình thường."
        footer={<><Button onClick={() => setRevoking(false)} disabled={busy}>Hủy</Button><Button variant="primary" onClick={revokeAll} disabled={busy}>{revoke.pending ? "Đang thực hiện…" : "Buộc đăng xuất"}</Button></>}>
        {formError && revoking && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{formError}</p>}
      </Dialog>
    </section>
  );
}

// =====================================================================================================================
// Phân công
// =====================================================================================================================
export function AssignmentsPanel({ userId, assignments, roles, orgs, departments, now }: { userId: string; assignments: AdminAssignment[]; roles: RoleInfo[]; orgs: Org[]; departments: Record<string, Dep[]>; now: string }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [adding, setAdding] = useState(false);
  const [ending, setEnding] = useState<string | null>(null);
  const [form, setForm] = useState({ userId, roleCode: "employee", organizationCode: orgs[0]?.code ?? "", departmentCode: "", validFrom: "", validUntil: "", basis: "", isDeputy: false });
  const [errors, setErrors] = useState<AssignmentErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const create = useServerAction(createAssignment, { toastErrors: false });
  const end = useServerAction(endAssignment);
  const scope = roleScope(form.roleCode);
  const deps = departments[form.organizationCode] ?? [];
  const today = todayVietnam(new Date(now));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const payload = { ...form, organizationCode: scope.organization ? form.organizationCode : "", departmentCode: scope.department ? form.departmentCode : "" };
    const found = validateAssignment(payload);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const result = await create.run(payload);
    if (result.ok) {
      toast.success("Đã thêm phân công.");
      setAdding(false);
      setForm((c) => ({ ...c, basis: "", validFrom: "", validUntil: "", isDeputy: false }));
      router.refresh();
    } else if (result.fieldErrors) setErrors({ roleCode: result.fieldErrors.roleCode?.[0], organizationCode: result.fieldErrors.organizationCode?.[0], departmentCode: result.fieldErrors.departmentCode?.[0], validUntil: result.fieldErrors.validUntil?.[0], basis: result.fieldErrors.basis?.[0] });
    else setFormError(failure(result));
  }

  async function doEnd(a: AdminAssignment) {
    const result = await end.run(userId, a.id);
    setEnding(null);
    if (result.ok) {
      toast.success("Đã kết thúc phân công.");
      router.refresh();
    }
  }

  const open = assignments.filter((a) => a.state !== "ended");
  const past = assignments.filter((a) => a.state === "ended");
  const depName = (org: string | null, code: string | null) => (code ? (departments[org ?? ""]?.find((d) => d.code === code)?.name ?? code) : null);
  const orgName = (code: string | null) => (code ? (orgs.find((o) => o.code === code)?.name ?? code) : null);

  return (
    <section className="grid gap-3 border border-line bg-surface p-4" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-title`} className="text-base font-bold">Phân công ({open.length} còn hiệu lực hoặc sắp bắt đầu)</h2>
        <Button size="sm" variant="primary" onClick={() => { setErrors({}); setFormError(null); setAdding(true); }}>Thêm phân công</Button>
      </div>
      {assignments.length === 0 ? <p className="text-sm text-muted">Người này chưa có phân công nào, nên chưa dùng được hệ thống.</p> : (
        <ul className="grid divide-y divide-line border border-line" aria-label="Phân công">
          {[...open, ...past].map((a) => {
            const chip = a.state === "active" ? expiryChip(a.validUntil, new Date(now)) : null;
            return (
              <li key={a.id} className="grid gap-1 px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{roleName(a.role)}</b>
                  {a.isDeputy && <Chip>Kiêm nhiệm</Chip>}
                  <Chip tone={a.state === "active" ? "ok" : a.state === "upcoming" ? "info" : "neutral"}>{ASSIGNMENT_STATE[a.state] ?? a.state}</Chip>
                  {(a.endsSoon || chip) && a.state === "active" && <Chip tone={chip?.tone ?? "warn"}>{chip?.text ?? "Sắp hết hạn"}</Chip>}
                  {a.state !== "ended" && (
                    ending === a.id ? (
                      <span className="ml-auto flex flex-wrap items-center gap-2">
                        <span className="text-[13px]">Kết thúc phân công này ngay?</span>
                        <Button size="sm" variant="danger" onClick={() => doEnd(a)} disabled={end.pending}>Kết thúc</Button>
                        <Button size="sm" onClick={() => setEnding(null)}>Giữ lại</Button>
                      </span>
                    ) : a.state === "active" ? <Button size="sm" className="ml-auto" onClick={() => setEnding(a.id)} aria-label={`Kết thúc phân công ${roleName(a.role)}`}>Kết thúc</Button> : null
                  )}
                </div>
                <p className="text-muted">{[orgName(a.organizationCode), depName(a.organizationCode, a.departmentCode)].filter(Boolean).join(" · ") || "Không gắn cơ quan"} · từ {formatDate(a.validFrom)} {a.validUntil ? `đến ${formatDate(a.validUntil)}` : "(không thời hạn)"}</p>
                <p className="text-xs text-muted">Căn cứ: {a.basis}</p>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={adding} onClose={() => !create.pending && setAdding(false)} title="Thêm phân công" description="Phân công có thời hạn và căn cứ. Người có nhiều phân công đổi qua lại ở thanh trên cùng."
        footer={<><Button onClick={() => setAdding(false)} disabled={create.pending}>Hủy</Button><Button variant="primary" type="submit" form={`${id}-add`} disabled={create.pending}>{create.pending ? "Đang thêm…" : "Thêm phân công"}</Button></>}>
        <form id={`${id}-add`} onSubmit={submit} className="grid gap-3" noValidate>
          <label className="grid gap-1 text-[13px] font-semibold">Vai trò
            <select value={form.roleCode} onChange={(e) => setForm((c) => ({ ...c, roleCode: e.target.value }))} className={field} aria-invalid={errors.roleCode ? true : undefined}>
              {roles.map((r) => <option key={r.code} value={r.code}>{roleName(r.code)}</option>)}
            </select>{err(errors.roleCode)}</label>
          {scope.organization && (
            <label className="grid gap-1 text-[13px] font-semibold">Cơ quan
              <select value={form.organizationCode} onChange={(e) => setForm((c) => ({ ...c, organizationCode: e.target.value, departmentCode: "" }))} className={field} aria-invalid={errors.organizationCode ? true : undefined}>
                {orgs.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
              </select>{err(errors.organizationCode)}</label>
          )}
          {scope.department && (
            <label className="grid gap-1 text-[13px] font-semibold">Đơn vị (phòng, Ban)
              <select value={form.departmentCode} onChange={(e) => setForm((c) => ({ ...c, departmentCode: e.target.value }))} className={field} aria-invalid={errors.departmentCode ? true : undefined}>
                <option value="">Chọn đơn vị…</option>
                {deps.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
              </select>{err(errors.departmentCode)}</label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-[13px] font-semibold">Bắt đầu (bỏ trống: từ bây giờ)
              <input type="date" value={form.validFrom} min={today} onChange={(e) => setForm((c) => ({ ...c, validFrom: e.target.value }))} className={field} aria-invalid={errors.validFrom ? true : undefined} />{err(errors.validFrom)}</label>
            <label className="grid gap-1 text-[13px] font-semibold">Hết hạn (bỏ trống: không thời hạn)
              <input type="date" value={form.validUntil} min={form.validFrom || today} onChange={(e) => setForm((c) => ({ ...c, validUntil: e.target.value }))} className={field} aria-invalid={errors.validUntil ? true : undefined} />{err(errors.validUntil)}</label>
          </div>
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={form.isDeputy} onChange={(e) => setForm((c) => ({ ...c, isDeputy: e.target.checked }))} className="size-4 accent-primary" /> Phân công kiêm nhiệm</label>
          <label className="grid gap-1 text-[13px] font-semibold">Căn cứ (từ {MIN_BASIS} ký tự)
            <textarea value={form.basis} rows={2} onChange={(e) => setForm((c) => ({ ...c, basis: e.target.value }))} placeholder="Ví dụ: Quyết định 12/QĐ-UBND ngày 01/01/2026" className={area} aria-invalid={errors.basis ? true : undefined} />{err(errors.basis)}</label>
          {formError && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{formError}</p>}
        </form>
      </Dialog>
    </section>
  );
}

// =====================================================================================================================
// Ủy quyền
// =====================================================================================================================
export type UserChoice = { id: string; displayName: string; username: string };

export function DelegationsPanel({ userId, assignments, delegations, roles, users, now }: { userId: string; assignments: AdminAssignment[]; delegations: AdminDelegation[]; roles: RoleInfo[]; users: UserChoice[]; now: string }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const today = todayVietnam(new Date(now));
  const usable = assignments.filter((a) => a.state === "active");
  const [adding, setAdding] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [form, setForm] = useState({ fromAssignmentId: usable[0]?.id ?? "", toUserId: "", permissionCodes: [] as string[], validFrom: "", validUntil: "", basis: "" });
  const [errors, setErrors] = useState<DelegationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const create = useServerAction(createDelegation, { toastErrors: false });
  const revoke = useServerAction(revokeDelegation);
  const fromRole = usable.find((a) => a.id === form.fromAssignmentId)?.role;
  const choices = roles.find((r) => r.code === fromRole)?.permissions ?? [];
  const end = maxDelegationEnd(form.validFrom || today);

  function toggle(code: string) {
    setForm((c) => ({ ...c, permissionCodes: c.permissionCodes.includes(code) ? c.permissionCodes.filter((p) => p !== code) : [...c.permissionCodes, code] }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const found = validateDelegation(form, today);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const result = await create.run(userId, form);
    if (result.ok) {
      toast.success("Đã tạo ủy quyền.");
      setAdding(false);
      setForm((c) => ({ ...c, toUserId: "", permissionCodes: [], validFrom: "", validUntil: "", basis: "" }));
      router.refresh();
    } else if (result.fieldErrors) setErrors({ toUserId: result.fieldErrors.toUserId?.[0], permissionCodes: result.fieldErrors.permissionCodes?.[0], validUntil: result.fieldErrors.validUntil?.[0], fromAssignmentId: result.fieldErrors.fromAssignmentId?.[0], basis: result.fieldErrors.basis?.[0] });
    else setFormError(failure(result));
  }

  async function doRevoke(d: AdminDelegation) {
    const result = await revoke.run(userId, d.id);
    setRevoking(null);
    if (result.ok) {
      toast.success("Đã thu hồi ủy quyền.");
      router.refresh();
    }
  }

  const given = delegations.filter((d) => assignments.some((a) => a.id === d.fromAssignmentId));
  const received = delegations.filter((d) => d.toUserId === userId);
  const row = (d: AdminDelegation, mine: boolean) => (
    <li key={d.id} className="grid gap-1 px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <b>{mine ? `Ủy quyền cho ${d.toUsername}` : `Nhận ủy quyền vai trò ${roleName(d.fromRole)}`}</b>
        <Chip tone={d.state === "active" ? "ok" : d.state === "upcoming" ? "info" : "neutral"}>{DELEGATION_STATE[d.state] ?? d.state}</Chip>
        {mine && (d.state === "active" || d.state === "upcoming") && (
          revoking === d.id ? (
            <span className="ml-auto flex flex-wrap items-center gap-2"><span className="text-[13px]">Thu hồi ngay?</span><Button size="sm" variant="danger" onClick={() => doRevoke(d)} disabled={revoke.pending}>Thu hồi</Button><Button size="sm" onClick={() => setRevoking(null)}>Giữ lại</Button></span>
          ) : <Button size="sm" className="ml-auto" onClick={() => setRevoking(d.id)} aria-label={`Thu hồi ủy quyền cho ${d.toUsername}`}>Thu hồi</Button>
        )}
      </div>
      <p className="text-muted">Từ {formatDate(d.validFrom)} đến {formatDate(d.validUntil)}{d.revokedAt ? ` · thu hồi ${formatDateTime(d.revokedAt)}` : ""}</p>
      <p className="text-xs text-muted">Quyền: {d.permissionCodes.join(", ")} · Căn cứ: {d.basis}</p>
    </li>
  );

  return (
    <section className="grid gap-3 border border-line bg-surface p-4" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-title`} className="text-base font-bold">Ủy quyền</h2>
        <Button size="sm" onClick={() => { setErrors({}); setFormError(null); setAdding(true); }} disabled={usable.length === 0} title={usable.length === 0 ? "Người này chưa có phân công đang hiệu lực để ủy quyền" : undefined}>Tạo ủy quyền</Button>
      </div>
      {given.length === 0 && received.length === 0 ? <p className="text-sm text-muted">Chưa có ủy quyền nào. Ủy quyền có thời hạn tối đa {90} ngày và chỉ gồm phần quyền người ủy quyền đang có.</p> : (
        <>
          {given.length > 0 && <ul className="grid divide-y divide-line border border-line" aria-label="Ủy quyền đã trao">{given.map((d) => row(d, true))}</ul>}
          {received.length > 0 && <ul className="grid divide-y divide-line border border-line" aria-label="Ủy quyền đã nhận">{received.map((d) => row(d, false))}</ul>}
        </>
      )}

      <Dialog open={adding} onClose={() => !create.pending && setAdding(false)} title="Tạo ủy quyền" description="Người nhận dùng phần quyền được ủy quyền trong phạm vi của phân công người ủy quyền, tới khi hết hạn hoặc bị thu hồi."
        footer={<><Button onClick={() => setAdding(false)} disabled={create.pending}>Hủy</Button><Button variant="primary" type="submit" form={`${id}-add`} disabled={create.pending}>{create.pending ? "Đang tạo…" : "Tạo ủy quyền"}</Button></>}>
        <form id={`${id}-add`} onSubmit={submit} className="grid gap-3" noValidate>
          <label className="grid gap-1 text-[13px] font-semibold">Phân công của người ủy quyền
            <select value={form.fromAssignmentId} onChange={(e) => setForm((c) => ({ ...c, fromAssignmentId: e.target.value, permissionCodes: [] }))} className={field} aria-invalid={errors.fromAssignmentId ? true : undefined}>
              {usable.map((a) => <option key={a.id} value={a.id}>{roleName(a.role)}{a.departmentCode ? ` · ${a.departmentCode}` : ""}</option>)}
            </select>{err(errors.fromAssignmentId)}</label>
          <label className="grid gap-1 text-[13px] font-semibold">Người nhận ủy quyền
            <select value={form.toUserId} onChange={(e) => setForm((c) => ({ ...c, toUserId: e.target.value }))} className={field} aria-invalid={errors.toUserId ? true : undefined}>
              <option value="">Chọn người nhận…</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.displayName} ({u.username})</option>)}
            </select>{err(errors.toUserId)}</label>
          <fieldset className="grid gap-1.5" aria-describedby={errors.permissionCodes ? `${id}-perm-error` : undefined}>
            <legend className="text-[13px] font-semibold">Quyền ủy quyền</legend>
            <div className="grid max-h-48 gap-1 overflow-y-auto border border-line p-2">
              {choices.length === 0 && <p className="text-sm text-muted">Vai trò này không có quyền nào để ủy quyền.</p>}
              {choices.map((p) => (
                <label key={p.code} className="flex items-start gap-2 text-[13px]">
                  <input type="checkbox" checked={form.permissionCodes.includes(p.code)} onChange={() => toggle(p.code)} className="mt-0.5 size-4 accent-primary" />
                  <span><span className="font-mono">{p.code}</span>{p.description ? <span className="text-muted"> · {p.description}</span> : null}</span>
                </label>
              ))}
            </div>
            {errors.permissionCodes && <span id={`${id}-perm-error`} role="alert" className="text-[13px] text-bad">{errors.permissionCodes}</span>}
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-[13px] font-semibold">Bắt đầu (bỏ trống: từ bây giờ)
              <input type="date" value={form.validFrom} min={today} onChange={(e) => setForm((c) => ({ ...c, validFrom: e.target.value }))} className={field} /></label>
            <label className="grid gap-1 text-[13px] font-semibold">Hết hạn (tối đa {end.split("-").reverse().join("/")})
              <input type="date" value={form.validUntil} min={form.validFrom || today} max={end} onChange={(e) => setForm((c) => ({ ...c, validUntil: e.target.value }))} className={field} aria-invalid={errors.validUntil ? true : undefined} />{err(errors.validUntil)}</label>
          </div>
          <label className="grid gap-1 text-[13px] font-semibold">Căn cứ (từ {MIN_BASIS} ký tự)
            <textarea value={form.basis} rows={2} onChange={(e) => setForm((c) => ({ ...c, basis: e.target.value }))} placeholder="Ví dụ: Đi công tác theo Quyết định 33/QĐ-UBND" className={area} aria-invalid={errors.basis ? true : undefined} />{err(errors.basis)}</label>
          {formError && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{formError}</p>}
        </form>
      </Dialog>
    </section>
  );
}
