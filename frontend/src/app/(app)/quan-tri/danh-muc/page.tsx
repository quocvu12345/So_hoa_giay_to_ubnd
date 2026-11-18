import type { Metadata } from "next";
import Link from "next/link";
import { NeedsRealApi, PageBody } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { Chip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { getAllDepartments, getOrganizations } from "@/features/admin/admin-data";
import { foldText } from "@/features/dossier/assign-rules";
import { getAllGroups, getRetentionRules, getTypes } from "@/features/catalog/catalog-data";
import { CreateGroupButton, GroupPanel, RetentionPanel, TypesPanel } from "@/features/catalog/catalog-panels";
import { groupByDepartment } from "@/features/catalog/catalog-rules";
import { pageSession } from "@/lib/auth/page-guard";
import { serverEnv } from "@/lib/env";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Danh mục" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

/**
 * Quản trị danh mục (FE-43, BE-32, BE-35): nhóm hồ sơ → loại giấy tờ → trường dữ liệu, thời hạn bảo quản. Sửa, xác nhận, ngừng dùng (không xóa mục đã có dữ liệu).
 * Danh mục dùng chung cho tiếp nhận, đối chiếu, xếp hồ sơ nên mọi thay đổi có hiệu lực ngay. Nhóm đang xem nằm trên URL (`?nhom=`).
 */
export default async function AdminCatalogPage({ searchParams }: PageProps<"/quan-tri/danh-muc">) {
  const { session, allowed } = await pageSession("catalog.manage");
  if (!allowed) return <NoAccess session={session} what="quản lý danh mục" />;
  const params = await searchParams;
  const q = first(params.q).slice(0, 100);
  const selected = first(params.nhom);
  const real = !serverEnv().mock;

  const groups = real ? await getAllGroups() : [];
  const orgs = real ? await getOrganizations() : [];
  const departments = real ? (await Promise.all(orgs.map((o) => getAllDepartments(o.code)))).flat() : [];
  const departmentNames = new Map(departments.map((d) => [d.code, d.name]));
  const group = groups.find((g) => g.code === selected) ?? null;
  const [types, rules] = real && group ? await Promise.all([getTypes(group.code), getRetentionRules(group.code)]) : [[], []];
  const grouped = groupByDepartment(groups, q, foldText);
  const uniqueDepartments = [...new Map(departments.map((d) => [d.code, d])).values()];

  return (
    <>
      <PageHeader
        title="Danh mục"
        description="Nhóm hồ sơ, loại giấy tờ, trường dữ liệu và thời hạn bảo quản. Thay đổi có hiệu lực ngay ở mọi màn."
        breadcrumbs={[{ label: "Quản trị" }, { label: "Danh mục" }]}
        actions={real ? <CreateGroupButton orgs={orgs.map((o) => ({ code: o.code, name: o.name }))} departments={uniqueDepartments.map((d) => ({ code: d.code, name: d.name, organizationCodes: d.organizationCodes }))} /> : undefined}
      />
      <PageBody>
        {!real ? <NeedsRealApi what="Danh mục" /> : (
          <div className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
            <aside className="grid content-start gap-3" aria-label="Nhóm hồ sơ">
              <form role="search" className="flex gap-2">
                <label className="sr-only" htmlFor="loc-nhom">Tìm nhóm hồ sơ</label>
                <input id="loc-nhom" name="q" defaultValue={q} placeholder="Tìm mã hoặc tên nhóm…" autoComplete="off" className="h-9 min-w-0 flex-1 border border-line-strong bg-surface px-2 text-sm outline-none focus:border-primary" />
                {selected && <input type="hidden" name="nhom" value={selected} />}
                <button type="submit" className="h-9 border border-primary bg-primary px-3 text-sm font-semibold text-white hover:bg-primary-hover">Tìm</button>
              </form>
              {grouped.length === 0 && <p className="text-sm text-muted">Không có nhóm nào khớp.</p>}
              {grouped.map((g) => (
                <div key={g.department} className="grid gap-1">
                  <h2 className="text-xs font-bold tracking-wide text-muted uppercase">{departmentNames.get(g.department) ?? g.department}</h2>
                  <ul className="grid border border-line bg-surface" aria-label={departmentNames.get(g.department) ?? g.department}>
                    {g.items.map((item) => (
                      <li key={item.code} className="border-t border-line first:border-t-0">
                        <Link href={`${routes.adminCatalog}?nhom=${item.code}${q ? `&q=${encodeURIComponent(q)}` : ""}` as "/quan-tri/danh-muc"} data-row aria-current={item.code === selected ? "page" : undefined}
                          className={cn("flex flex-wrap items-center gap-2 px-3 py-2 text-sm hover:bg-soft focus-visible:outline-2 focus-visible:-outline-offset-2", item.code === selected && "bg-accent-soft font-semibold")}>
                          <span className={cn("font-mono text-xs", item.code === selected ? "text-ink" : "text-muted")}>{item.code}</span>
                          <span className="flex-1">{item.title}</span>
                          {!item.active && <Chip>Ngừng dùng</Chip>}
                          {item.verificationStatus !== "confirmed" && item.active && <Chip tone="warn">Chưa xác nhận</Chip>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </aside>

            <div className="grid content-start gap-4">
              {!group ? (
                <p className="border border-dashed border-line-strong p-6 text-sm text-muted">{selected ? `Không có nhóm ${selected}.` : "Chọn một nhóm hồ sơ ở bên trái để xem và sửa loại giấy tờ, trường dữ liệu và thời hạn bảo quản."}</p>
              ) : (
                <>
                  <GroupPanel group={group} />
                  <TypesPanel group={group} types={types} />
                  <RetentionPanel group={group} rules={rules} types={types} />
                </>
              )}
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}
