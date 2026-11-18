import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, FolderPlus, Search, X } from "lucide-react";
import { DueChip } from "@/components/dossier/due-chip";
import { Button, ButtonLink, buttonClass } from "@/components/ui/button";
import { EmptyState, NeedsRealApi, PageBody } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { RowNavigation } from "@/components/ui/row-navigation";
import { PageHeader } from "@/components/ui/page-header";
import { WorkflowChip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { listDossiers, type DossierListItem } from "@/features/dossier/dossier-data";
import {
  ariaSort,
  exportHref,
  isFiltered,
  parseDossierFilter,
  SORT_LABELS,
  SORTS,
  sortedBy,
  toSearchParams,
  yearOptions,
  type DossierFilterState,
  type DossierSort,
} from "@/features/dossier/dossier-filter";
import { getWorkGroups } from "@/features/review/review-data";
import { pageSession } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { WORKFLOW_LABELS } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Hồ sơ" };

/**
 * Danh sách hồ sơ trong phạm vi (FE-26). Bộ lọc là form GET: nằm trên URL, gửi đường dẫn cho người khác
 * mở đúng bộ lọc, nút Back hoạt động, chạy được cả khi JavaScript chưa tải xong. Trang sau dùng cursor của API (keyset) trên URL.
 */
export default async function DossiersPage({ searchParams }: PageProps<"/ho-so">) {
  const { session, allowed } = await pageSession("dossier.read");
  if (!allowed) return <NoAccess session={session} what="xem hồ sơ" />;
  const filter = parseDossierFilter(await searchParams);
  const canCreate = can(session, "dossier.prepare");
  const canExport = can(session, "export.create");
  const real = !serverEnv().mock;
  const [page, groups] = real ? await Promise.all([listDossiers(filter), getWorkGroups(session.activeAssignment.organizationCode)]) : [null, []];
  const filtered = isFiltered(filter);
  // Người chủ trì đang lọc: mọi hồ sơ khớp cùng một người nên lấy tên từ dòng đầu; vị trí kho chỉ hiện mã vì danh sách không mang tên vị trí.
  const assigneeName = filter.assignee ? (page?.items.find((d) => d.assigneeName)?.assigneeName ?? null) : null;

  /** Đường dẫn giữ nguyên bộ lọc và thứ tự; có `cursor` thì mở trang sau của API, không có thì về trang đầu. */
  const hrefFor = (state: DossierFilterState, cursor?: string): Route => {
    const query = toSearchParams(state, cursor).toString();
    return (query ? `${routes.dossiers}?${query}` : routes.dossiers) as Route;
  };
  const hrefWith = (cursor?: string): Route => hrefFor(filter, cursor);
  const without = (patch: Partial<DossierFilterState>): Route => hrefFor({ ...filter, ...patch, cursor: "" });
  return (
    <>
      <PageHeader
        title="Hồ sơ"
        description="Hồ sơ thuộc phạm vi phân công của bạn. Nhấn vào mã hồ sơ để mở."
        breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Hồ sơ" }]}
        actions={
          <>
            {canExport && real ? (
              <a
                href={exportHref(filter)}
                className={buttonClass("secondary")}
                title="Tải CSV theo bộ lọc và thứ tự đang chọn. Tối đa 10.000 hồ sơ; nhiều hơn thì thu hẹp bộ lọc."
              >
                <Download aria-hidden className="size-4" /> Xuất danh sách
              </a>
            ) : (
              <Button disabled title={canExport ? "Cần API thật để xuất danh sách" : "Phân công đang dùng không có quyền xuất dữ liệu"}>
                <Download aria-hidden className="size-4" /> Xuất danh sách
              </Button>
            )}
            {canCreate && (
              <ButtonLink href={routes.dossierNew} variant="primary">
                <FolderPlus aria-hidden className="size-4" /> Tạo hồ sơ
              </ButtonLink>
            )}
          </>
        }
      />
      <PageBody>
        {!real || !page ? (
          <NeedsRealApi what="Danh sách hồ sơ" />
        ) : (
          <>
            <form className="flex flex-wrap items-end gap-3 border border-line bg-surface p-3" role="search">
              <label className="grid min-w-[240px] flex-1 gap-1 text-[13px] font-semibold">
                Từ khóa
                <span className="flex items-center gap-2 border border-line-strong px-2 focus-within:border-primary">
                  <Search aria-hidden className="size-4 text-muted" />
                  <input name="q" defaultValue={filter.q} placeholder="Mã, tên hồ sơ…" className="h-9 flex-1 bg-transparent font-normal outline-none" />
                </span>
              </label>
              <label className="grid gap-1 text-[13px] font-semibold">
                Trạng thái
                <select name="trang-thai" defaultValue={filter.status} className="h-[38px] border border-line-strong bg-surface px-2 font-normal">
                  <option value="">Tất cả</option>
                  {Object.entries(WORKFLOW_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-[13px] font-semibold">
                Nhóm hồ sơ
                <select name="nhom" defaultValue={filter.workGroup} className="h-[38px] max-w-64 border border-line-strong bg-surface px-2 font-normal">
                  <option value="">Tất cả</option>
                  {groups.map((g) => (
                    <option key={g.code} value={g.code}>{g.code} · {g.title}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-[13px] font-semibold">
                Năm
                <select name="nam" defaultValue={filter.year ?? ""} className="h-[38px] border border-line-strong bg-surface px-2 font-normal">
                  <option value="">Mọi năm</option>
                  {yearOptions(new Date(), filter.year).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-[13px] font-semibold">
                Sắp xếp theo
                <span className="flex">
                  <select name="sap-xep" defaultValue={filter.sort} className="h-[38px] border border-line-strong bg-surface px-2 font-normal" aria-label="Sắp xếp theo">
                    {SORTS.map((c) => (
                      <option key={c} value={c}>{SORT_LABELS[c]}</option>
                    ))}
                  </select>
                  <select name="chieu" defaultValue={filter.descending ? "giam" : "tang"} className="h-[38px] border border-l-0 border-line-strong bg-surface px-2 font-normal" aria-label="Chiều sắp xếp">
                    <option value="tang">Tăng dần</option>
                    <option value="giam">Giảm dần</option>
                  </select>
                </span>
              </label>
              <label className="flex h-[38px] items-center gap-2 text-[13px] font-semibold">
                <input type="checkbox" name="cua-toi" value="1" defaultChecked={filter.mine} className="size-4 accent-primary" /> Chỉ hồ sơ tôi chủ trì
              </label>
              <label className="flex h-[38px] items-center gap-2 text-[13px] font-semibold">
                <input type="checkbox" name="qua-han" value="1" defaultChecked={filter.overdue} className="size-4 accent-primary" /> Chỉ hồ sơ quá hạn
              </label>
              {/* Lọc theo người chủ trì và vị trí kho đến từ liên kết ở màn khác: giữ khi bấm Lọc. */}
              {filter.assignee && <input type="hidden" name="nguoi" value={filter.assignee} />}
              {filter.location && <input type="hidden" name="vi-tri" value={filter.location} />}
              <Button type="submit" variant="primary">Lọc</Button>
              {filtered && <Link href={routes.dossiers} className="h-10 content-center text-sm text-primary hover:underline">Xóa lọc</Link>}
            </form>

            {(filter.assignee || filter.location) && (
              <ul className="flex flex-wrap gap-2" aria-label="Bộ lọc đang áp dụng từ liên kết">
                {filter.assignee && (
                  <li>
                    <Link href={without({ assignee: "" })} className="inline-flex items-center gap-1.5 border border-line-strong bg-soft px-2 py-1 text-[13px] hover:border-primary" aria-label="Bỏ lọc theo người chủ trì">
                      Chủ trì: {assigneeName ?? "một người được chọn"} <X aria-hidden className="size-3.5" />
                    </Link>
                  </li>
                )}
                {filter.location && (
                  <li>
                    <Link href={without({ location: "" })} className="inline-flex items-center gap-1.5 border border-line-strong bg-soft px-2 py-1 text-[13px] hover:border-primary" aria-label="Bỏ lọc theo vị trí kho">
                      Đang lọc theo vị trí kho (gồm vị trí con) <X aria-hidden className="size-3.5" />
                    </Link>
                  </li>
                )}
              </ul>
            )}

            {page.items.length === 0 ? (
              <EmptyState title={filtered ? "Không có hồ sơ khớp bộ lọc" : "Chưa có hồ sơ nào trong phạm vi của bạn"} action={!filtered && canCreate ? <ButtonLink href={routes.dossierNew} variant="primary">Tạo hồ sơ</ButtonLink> : undefined}>
                {filtered ? "Thử bỏ bớt điều kiện lọc, hoặc tìm theo mã hồ sơ đầy đủ." : "Hồ sơ được giao cho bạn hoặc thuộc đơn vị của bạn sẽ hiện ở đây."}
              </EmptyState>
            ) : (
              <>
                <RowNavigation />
                <DossierCards rows={page.items} />
                <DossierTable rows={page.items} filter={filter} sortHref={(column) => hrefFor(sortedBy(filter, column))} />
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
              <span aria-live="polite">{page.items.length} hồ sơ trên trang này{filter.cursor ? " (đang xem trang sau)" : ""}.</span>
              <span className="flex gap-3">
                {filter.cursor && <Link href={hrefWith()} className="font-semibold text-primary hover:underline">← Về trang đầu</Link>}
                {page.nextCursor && <Link href={hrefWith(page.nextCursor)} className="font-semibold text-primary hover:underline">Trang sau →</Link>}
              </span>
            </div>
          </>
        )}
      </PageBody>
    </>
  );
}

/** Tiêu đề cột bấm được: đổi cột hoặc đảo chiều, về trang đầu. Có chữ và mũi tên (không chỉ màu), aria-sort cho trình đọc màn hình. */
function SortLink({ column, label, filter, href }: { column: DossierSort; label: string; filter: DossierFilterState; href: Route }) {
  const state = ariaSort(filter, column);
  const Icon = state === "ascending" ? ArrowUp : state === "descending" ? ArrowDown : ArrowUpDown;
  return (
    <Link href={href} className="inline-flex items-center gap-1 hover:text-primary" aria-label={`Sắp xếp theo ${label.toLowerCase()}`}>
      {label} <Icon aria-hidden className={state === "none" ? "size-3.5 text-muted" : "size-3.5 text-primary"} />
    </Link>
  );
}

function DossierTable({ rows, filter, sortHref }: { rows: DossierListItem[]; filter: DossierFilterState; sortHref: (column: DossierSort) => Route }) {
  return (
    <div className="hidden overflow-x-auto border border-line bg-surface xl:block">
      <table className="w-full min-w-[960px] text-sm">
        <caption className="sr-only">Danh sách hồ sơ, {rows.length} kết quả</caption>
        <thead className="bg-soft text-left text-[13px] text-heading">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold" aria-sort={filter.sort === "ma" ? ariaSort(filter, "ma") : ariaSort(filter, "ten")}>
              <span className="flex flex-wrap items-center gap-x-3">
                <SortLink column="ma" label="Mã" filter={filter} href={sortHref("ma")} />
                <SortLink column="ten" label="Tên hồ sơ" filter={filter} href={sortHref("ten")} />
              </span>
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">Nhóm</th>
            <th scope="col" className="px-3 py-2 font-semibold">Trạng thái</th>
            <th scope="col" className="px-3 py-2 font-semibold">Người chủ trì</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Giấy tờ đã đối chiếu</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold" aria-sort={ariaSort(filter, "cap-nhat")}>
              <SortLink column="cap-nhat" label="Cập nhật" filter={filter} href={sortHref("cap-nhat")} />
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold" aria-sort={ariaSort(filter, "han")}>
              <SortLink column="han" label="Hạn nội bộ" filter={filter} href={sortHref("han")} />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-t border-line hover:bg-soft/60">
              <td className="px-3 py-2.5">
                <Link href={routes.dossier(d.id)} data-row className="grid gap-0.5 hover:text-primary">
                  <span className="font-mono text-xs text-muted">{d.code}</span>
                  <span className="font-semibold">{d.title}</span>
                </Link>
              </td>
              <td className="px-3 py-2.5 text-muted">{d.workGroupCode} · {d.workGroupTitle}</td>
              <td className="px-3 py-2.5"><WorkflowChip state={d.status} label={d.statusLabel} /></td>
              <td className="px-3 py-2.5">{d.assigneeName ?? <span className="text-muted">Chưa giao</span>}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{d.verifiedCount} / {d.documentCount}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted">{formatDate(d.updatedAt)}</td>
              <td className="px-3 py-2.5 text-right">{d.status === "archived" ? <span className="text-muted">—</span> : <DueChip dueOn={d.dueOn} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Dưới 1280px (có menu trái): mỗi hồ sơ một thẻ, không phải cuộn ngang. */
function DossierCards({ rows }: { rows: DossierListItem[] }) {
  return (
    <ul className="grid gap-2 xl:hidden" aria-label={`Danh sách hồ sơ, ${rows.length} kết quả`}>
      {rows.map((d) => (
        <li key={d.id} className="grid gap-1.5 border border-line bg-surface p-3 text-sm">
          <Link href={routes.dossier(d.id)} data-row className="grid gap-0.5 hover:text-primary">
            <span className="font-mono text-xs text-muted">{d.code} · {d.workGroupCode} {d.workGroupTitle}</span>
            <span className="font-semibold">{d.title}</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <WorkflowChip state={d.status} label={d.statusLabel} />
            {d.status !== "archived" && <DueChip dueOn={d.dueOn} />}
          </div>
          <p className="text-xs text-muted">Chủ trì: {d.assigneeName ?? "chưa giao"} · {d.verifiedCount}/{d.documentCount} giấy tờ đã đối chiếu</p>
        </li>
      ))}
    </ul>
  );
}
