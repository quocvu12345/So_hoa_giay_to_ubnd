import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { Download, FolderPlus, Search } from "lucide-react";
import { DueChip } from "@/components/dossier/due-chip";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState, NeedsRealApi, PageBody } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { WorkflowChip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { listDossiers, type DossierListItem } from "@/features/dossier/dossier-data";
import { getWorkGroups } from "@/features/review/review-data";
import { pageSession } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { WORKFLOW_LABELS } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Hồ sơ" };

function param(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

/**
 * Danh sách hồ sơ trong phạm vi (FE-26). Bộ lọc là form GET: nằm trên URL, gửi đường dẫn cho người khác
 * mở đúng bộ lọc, nút Back hoạt động, chạy được cả khi JavaScript chưa tải xong. Trang sau dùng cursor của API (keyset) trên URL.
 */
export default async function DossiersPage({ searchParams }: PageProps<"/ho-so">) {
  const { session, allowed } = await pageSession("dossier.read");
  if (!allowed) return <NoAccess session={session} what="xem hồ sơ" />;
  const params = await searchParams;
  const filter = {
    q: param(params.q).trim(),
    status: param(params["trang-thai"]),
    workGroup: param(params.nhom),
    mine: param(params["cua-toi"]) === "1",
    cursor: param(params.cursor),
  };
  const canCreate = can(session, "dossier.prepare");
  const real = !serverEnv().mock;
  const [page, groups] = real ? await Promise.all([listDossiers(filter), getWorkGroups(session.activeAssignment.organizationCode)]) : [null, []];
  const filtered = Boolean(filter.q || filter.status || filter.workGroup || filter.mine);

  /** Đường dẫn giữ nguyên bộ lọc; có `cursor` thì mở trang sau của API, không có thì về trang đầu. */
  const hrefWith = (cursor?: string): Route => {
    const next = new URLSearchParams();
    if (filter.q) next.set("q", filter.q);
    if (filter.status) next.set("trang-thai", filter.status);
    if (filter.workGroup) next.set("nhom", filter.workGroup);
    if (filter.mine) next.set("cua-toi", "1");
    if (cursor) next.set("cursor", cursor);
    const query = next.toString();
    return (query ? `${routes.dossiers}?${query}` : routes.dossiers) as Route;
  };

  return (
    <>
      <PageHeader
        title="Hồ sơ"
        description="Hồ sơ thuộc phạm vi phân công của bạn. Nhấn vào mã hồ sơ để mở."
        breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Hồ sơ" }]}
        actions={
          <>
            <Button disabled title="Chờ API xuất danh sách theo bộ lọc (BE-111)">
              <Download aria-hidden className="size-4" /> Xuất danh sách
            </Button>
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
              <label className="flex h-[38px] items-center gap-2 text-[13px] font-semibold">
                <input type="checkbox" name="cua-toi" value="1" defaultChecked={filter.mine} className="size-4 accent-primary" /> Chỉ hồ sơ tôi chủ trì
              </label>
              <Button type="submit" variant="primary">Lọc</Button>
              {filtered && <Link href={routes.dossiers} className="h-10 content-center text-sm text-primary hover:underline">Xóa lọc</Link>}
            </form>

            {page.items.length === 0 ? (
              <EmptyState title={filtered ? "Không có hồ sơ khớp bộ lọc" : "Chưa có hồ sơ nào trong phạm vi của bạn"} action={!filtered && canCreate ? <ButtonLink href={routes.dossierNew} variant="primary">Tạo hồ sơ</ButtonLink> : undefined}>
                {filtered ? "Thử bỏ bớt điều kiện lọc, hoặc tìm theo mã hồ sơ đầy đủ." : "Hồ sơ được giao cho bạn hoặc thuộc đơn vị của bạn sẽ hiện ở đây."}
              </EmptyState>
            ) : (
              <>
                <DossierCards rows={page.items} />
                <DossierTable rows={page.items} />
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

function DossierTable({ rows }: { rows: DossierListItem[] }) {
  return (
    <div className="hidden overflow-x-auto border border-line bg-surface xl:block">
      <table className="w-full min-w-[860px] text-sm">
        <caption className="sr-only">Danh sách hồ sơ, {rows.length} kết quả</caption>
        <thead className="bg-soft text-left text-[13px] text-heading">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Mã · Tên hồ sơ</th>
            <th scope="col" className="px-3 py-2 font-semibold">Nhóm</th>
            <th scope="col" className="px-3 py-2 font-semibold">Trạng thái</th>
            <th scope="col" className="px-3 py-2 font-semibold">Người chủ trì</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Giấy tờ đã đối chiếu</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Hạn nội bộ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-t border-line hover:bg-soft/60">
              <td className="px-3 py-2.5">
                <Link href={routes.dossier(d.id)} className="grid gap-0.5 hover:text-primary">
                  <span className="font-mono text-xs text-muted">{d.code}</span>
                  <span className="font-semibold">{d.title}</span>
                </Link>
              </td>
              <td className="px-3 py-2.5 text-muted">{d.workGroupCode} · {d.workGroupTitle}</td>
              <td className="px-3 py-2.5"><WorkflowChip state={d.status} label={d.statusLabel} /></td>
              <td className="px-3 py-2.5">{d.assigneeName ?? <span className="text-muted">Chưa giao</span>}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{d.verifiedCount} / {d.documentCount}</td>
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
          <Link href={routes.dossier(d.id)} className="grid gap-0.5 hover:text-primary">
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
