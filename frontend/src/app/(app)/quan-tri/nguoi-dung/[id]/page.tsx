import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NeedsRealApi, PageBody } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { Chip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { getAllDepartments, getOrganizations, getRoles, getUser, getUsers } from "@/features/admin/admin-data";
import { AssignmentsPanel, DelegationsPanel, UserInfoPanel } from "@/features/admin/user-panels";
import { UUID } from "@/features/dossier/dossier-data";
import { pageSession } from "@/lib/auth/page-guard";
import { serverEnv } from "@/lib/env";
import { loadOrNotFound } from "@/lib/load-or-not-found";

export const metadata: Metadata = { title: "Chi tiết người dùng" };

/**
 * Chi tiết người dùng (FE-42): thông tin và khóa/mở khóa, phân công (kể cả đã kết thúc) với hạn và căn cứ, ủy quyền đã trao và đã nhận.
 * Mọi thay đổi ghi nhật ký; API chặn khóa chính mình, khóa hay kết thúc phân công quản trị cuối cùng.
 */
export default async function AdminUserPage({ params }: PageProps<"/quan-tri/nguoi-dung/[id]">) {
  const { session, allowed } = await pageSession("admin.users");
  if (!allowed) return <NoAccess session={session} what="quản lý người dùng" />;
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  if (serverEnv().mock) return <><PageHeader title="Chi tiết người dùng" breadcrumbs={[{ label: "Quản trị" }, { label: "Người dùng", href: routes.adminUsers }]} /><PageBody><NeedsRealApi what="Người dùng" /></PageBody></>;

  const detail = await loadOrNotFound(() => getUser(id));
  const [roles, orgs, everyone] = await Promise.all([getRoles(), getOrganizations(), getUsers({ active: true })]);
  const departments = Object.fromEntries(await Promise.all(orgs.map(async (o) => [o.code, (await getAllDepartments(o.code)).map((d) => ({ code: d.code, name: d.name }))] as const)));
  const user = detail.user;
  const now = new Date().toISOString();

  return (
    <>
      <PageHeader
        title={user.displayName}
        description={`Tài khoản ${user.username}`}
        breadcrumbs={[{ label: "Quản trị" }, { label: "Người dùng", href: routes.adminUsers }, { label: user.displayName }]}
        meta={user.active ? <Chip tone="ok">Đang dùng</Chip> : <Chip tone="bad">Đã khóa</Chip>}
      />
      <PageBody>
        <UserInfoPanel user={user} subject={detail.externalAuthSubject ?? null} isSelf={session.user.username === user.username} />
        <AssignmentsPanel userId={user.id} assignments={detail.assignments} roles={roles} orgs={orgs.map((o) => ({ code: o.code, name: o.name }))} departments={departments} now={now} />
        <DelegationsPanel userId={user.id} assignments={detail.assignments} delegations={detail.delegations} roles={roles} users={everyone.filter((u) => u.id !== user.id).map((u) => ({ id: u.id, displayName: u.displayName, username: u.username }))} now={now} />
      </PageBody>
    </>
  );
}
