import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, NeedsRealApi, PageBody } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { Chip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { getUsers } from "@/features/admin/admin-data";
import { CreateUserButton } from "@/features/admin/create-user-button";
import { expiryChip, parseUserFilter } from "@/features/admin/user-rules";
import { pageSession } from "@/lib/auth/page-guard";
import { ROLE_NAMES, type RoleCode } from "@/lib/auth/permissions";
import { serverEnv } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Người dùng và phân công" };

const select = "h-10 min-w-0 border border-line-strong bg-surface px-2 text-sm font-normal outline-none focus:border-primary";

/**
 * Người dùng và phân công (FE-42, BE-34, BE-121): tìm theo tên hoặc tên đăng nhập, lọc đang dùng/đã khóa, chỉ người có phân công sắp hết hạn (≤ 7 ngày).
 * Phân công sắp hết hạn có chip vàng ngay ở danh sách để gia hạn kịp. Bộ lọc nằm trên URL.
 */
export default async function AdminUsersPage({ searchParams }: PageProps<"/quan-tri/nguoi-dung">) {
  const { session, allowed } = await pageSession("admin.users");
  if (!allowed) return <NoAccess session={session} what="quản lý người dùng" />;
  const filter = parseUserFilter(await searchParams);
  const real = !serverEnv().mock;
  const users = real ? await getUsers({ q: filter.q, active: filter.status === "" ? undefined : filter.status === "active", expiring: filter.expiring }) : [];
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Người dùng và phân công"
        description="Tài khoản, phân công có thời hạn và căn cứ, ủy quyền, khóa tài khoản."
        breadcrumbs={[{ label: "Quản trị" }, { label: "Người dùng" }]}
        actions={real ? <CreateUserButton /> : undefined}
      />
      <PageBody>
        {!real ? <NeedsRealApi what="Người dùng" /> : (
          <>
            <form role="search" className="flex flex-wrap items-end gap-3 border border-line bg-surface p-3">
              <label className="grid min-w-[220px] flex-1 gap-1 text-[13px] font-semibold">Tên hoặc tên đăng nhập
                <input name="q" defaultValue={filter.q} placeholder="Ví dụ: nguyen, head_kt" autoComplete="off" className={select} />
              </label>
              <label className="grid gap-1 text-[13px] font-semibold">Tình trạng
                <select name="tt" defaultValue={filter.status} className={select}><option value="">Tất cả</option><option value="active">Đang dùng</option><option value="locked">Đã khóa</option></select>
              </label>
              <label className="flex h-10 items-center gap-2 text-[13px] font-semibold"><input type="checkbox" name="sap-het-han" value="1" defaultChecked={filter.expiring} className="size-4 accent-primary" /> Chỉ phân công sắp hết hạn (≤ 7 ngày)</label>
              <Button type="submit" variant="primary">Tìm</Button>
              {(filter.q || filter.status || filter.expiring) && <Link href={routes.adminUsers} className="h-10 content-center text-sm text-primary hover:underline">Xóa lọc</Link>}
            </form>

            <p role="status" className="text-sm text-muted">{users.length === 0 ? "Không có người dùng khớp." : `${users.length} người dùng${users.length >= 500 ? " (hiện tối đa 500; thu hẹp bằng ô tìm)" : ""}`}</p>

            {users.length === 0 ? (
              <EmptyState icon={Users} title="Không có người dùng khớp">Bỏ bớt bộ lọc, hoặc thêm người dùng mới.</EmptyState>
            ) : (
              <ul className="grid gap-2" aria-label="Danh sách người dùng">
                {users.map((u) => {
                  const chip = Number(u.expiringAssignments) > 0 ? expiryChip(u.nextAssignmentEndsAt, now) : null;
                  return (
                    <li key={u.id} className="border border-line bg-surface">
                      <Link href={routes.adminUser(u.id)} data-row className="grid gap-1 p-3 hover:bg-soft focus-visible:outline-2 focus-visible:-outline-offset-2">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold">{u.displayName}</span>
                          <span className="font-mono text-xs text-muted">{u.username}</span>
                          {!u.active && <Chip tone="bad">Đã khóa</Chip>}
                          {u.isDemo && <Chip>Tài khoản mẫu</Chip>}
                          {Number(u.expiringAssignments) > 0 && <Chip tone={chip?.tone ?? "warn"}>{Number(u.expiringAssignments)} phân công sắp hết hạn{chip ? ` · ${chip.text.toLowerCase()}` : ""}</Chip>}
                          {Number(u.activeAssignments) === 0 && u.active && <Chip tone="warn">Chưa có phân công</Chip>}
                        </span>
                        <span className={cn("text-[13px] text-muted")}>
                          {u.roles.length > 0 ? u.roles.map((r) => ROLE_NAMES[r as RoleCode] ?? r).join(", ") : "Không có vai trò"} · {Number(u.activeAssignments)} phân công hiệu lực · {u.lastLoginAt ? `đăng nhập ${formatDateTime(u.lastLoginAt)}` : "chưa đăng nhập"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}

