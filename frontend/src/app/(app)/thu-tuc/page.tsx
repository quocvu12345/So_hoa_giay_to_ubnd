import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, NeedsRealApi, PageBody } from "@/components/ui/blocks";
import { PageHeader } from "@/components/ui/page-header";
import { Chip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { getProcedureDomains, getProcedureLevels, searchProcedures } from "@/features/procedure/procedure-data";
import { hasFilter, isRetired, LIFECYCLE_LABELS, pageCount, PAGE_SIZE, parseProcedureFilter, procedureListHref } from "@/features/procedure/procedure-filter";
import { pageSession } from "@/lib/auth/page-guard";
import { serverEnv } from "@/lib/env";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Thủ tục hành chính" };

const select = "h-10 min-w-0 border border-line-strong bg-surface px-2 text-sm outline-none focus:border-primary";

/**
 * Thủ tục hành chính (FE-35, BE-33, BE-122): tìm theo tên không dấu hoặc mã; lọc lĩnh vực, cấp thực hiện, tình trạng hiệu lực.
 * Mọi bộ lọc và trang nằm trên URL. Thủ tục đã bãi bỏ hoặc thay thế vẫn tra được (để đối chiếu hồ sơ cũ) nhưng luôn có cảnh báo.
 */
export default async function ProceduresPage({ searchParams }: PageProps<"/thu-tuc">) {
  await pageSession();
  const filter = parseProcedureFilter(await searchParams);
  const real = !serverEnv().mock;
  const [result, domains, levels] = real ? await Promise.all([searchProcedures(filter), getProcedureDomains(), getProcedureLevels()]) : [null, [], []];
  const total = Number(result?.total ?? 0);
  const pages = pageCount(total);

  return (
    <>
      <PageHeader
        title="Thủ tục hành chính"
        description="Thành phần hồ sơ, mẫu biểu và tình trạng hiệu lực của thủ tục theo danh mục Hà Nội và các thủ tục cấp xã trên Cổng DVC."
        breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Thủ tục hành chính" }]}
      />
      <PageBody>
        {!result ? (
          <NeedsRealApi what="Thủ tục hành chính" />
        ) : (
          <>
            <form role="search" className="grid gap-3 border border-line bg-surface p-3 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_12rem_11rem_auto]">
              <label className="grid gap-1 text-[13px] font-semibold sm:col-span-2 lg:col-span-1">
                Từ khóa (tên hoặc mã, không cần gõ dấu)
                <input name="q" defaultValue={filter.q} placeholder="Ví dụ: khai sinh, 1.000894" autoComplete="off" className={cn(select, "font-normal")} />
              </label>
              <label className="grid gap-1 text-[13px] font-semibold">Lĩnh vực
                <select name="linh-vuc" defaultValue={filter.domain} className={cn(select, "font-normal")}>
                  <option value="">Tất cả</option>
                  {domains.map((d) => <option key={d.domain} value={d.domain}>{d.domain} ({d.count})</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-[13px] font-semibold">Cấp thực hiện
                <select name="cap" defaultValue={filter.level} className={cn(select, "font-normal")}>
                  <option value="">Tất cả</option>
                  {levels.map((l) => <option key={l.level} value={l.level}>{l.level} ({l.count})</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-[13px] font-semibold">Hiệu lực
                <select name="hieu-luc" defaultValue={filter.status} className={cn(select, "font-normal")}>
                  <option value="">Tất cả</option>
                  {Object.entries(LIFECYCLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <div className="flex items-end gap-2">
                <Button type="submit" variant="primary">Tìm</Button>
                {hasFilter(filter) && <Link href={routes.procedures} className="h-10 content-center text-sm text-primary hover:underline">Xóa lọc</Link>}
              </div>
            </form>

            <p role="status" className="text-sm text-muted">
              {total === 0 ? "Không có thủ tục khớp bộ lọc." : `${total.toLocaleString("vi-VN")} thủ tục${pages > 1 ? ` · trang ${Math.min(filter.page, pages)}/${pages}` : ""}`}
            </p>

            {result.items.length === 0 ? (
              <EmptyState icon={BookOpen} title="Không tìm thấy thủ tục">Thử bớt bộ lọc hoặc gõ một phần tên, không cần dấu. Thủ tục đã bãi bỏ vẫn tìm được khi chọn &ldquo;Hiệu lực: Đã bãi bỏ&rdquo;.</EmptyState>
            ) : (
              <ul className="grid gap-2" aria-label="Danh sách thủ tục">
                {result.items.map((p) => (
                  <li key={p.id} className="border border-line bg-surface">
                    <Link href={routes.procedure(p.id)} data-row className="grid gap-1 p-3 hover:bg-soft focus-visible:outline-2 focus-visible:-outline-offset-2">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold">{p.name}</span>
                        {isRetired(p.lifecycleStatus) && <Chip tone="bad">{LIFECYCLE_LABELS[p.lifecycleStatus]}</Chip>}
                        {p.lifecycleStatus === "unverified" && <Chip tone="warn">{LIFECYCLE_LABELS.unverified}</Chip>}
                      </span>
                      <span className="text-[13px] text-muted">
                        {[p.procedureCode && `Mã ${p.procedureCode}`, p.domain, p.executionLevel, p.managingAgency].filter(Boolean).join(" · ")} · {p.componentCount} thành phần hồ sơ
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {pages > 1 && (
              <nav aria-label="Trang" className="flex items-center justify-between gap-2 text-sm">
                {filter.page > 1 ? <Link href={procedureListHref(filter, { page: filter.page - 1 }) as "/thu-tuc"} rel="prev" className="border border-line-strong px-3 py-1.5 hover:border-primary">← Trang trước</Link> : <span />}
                <span className="text-muted">{PAGE_SIZE} thủ tục mỗi trang</span>
                {filter.page < pages ? <Link href={procedureListHref(filter, { page: filter.page + 1 }) as "/thu-tuc"} rel="next" className="border border-line-strong px-3 py-1.5 hover:border-primary">Trang sau →</Link> : <span />}
              </nav>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}
