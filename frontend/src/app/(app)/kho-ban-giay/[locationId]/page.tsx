import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { DueChip } from "@/components/dossier/due-chip";
import { buttonClass } from "@/components/ui/button";
import { EmptyState, NeedsRealApi, PageBody, Section } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { RowNavigation } from "@/components/ui/row-navigation";
import { Chip, WorkflowChip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { listDossiers, UUID } from "@/features/dossier/dossier-data";
import { parseDossierFilter } from "@/features/dossier/dossier-filter";
import { KIND_LABELS, subtreeCounts } from "@/features/storage/location-labels";
import { LocationActions } from "@/features/storage/location-panels";
import { labelsHref, subtreeIds } from "@/features/storage/location-rules";
import { getLocation, getLocations } from "@/features/storage/storage-data";
import { pageSession } from "@/lib/auth/page-guard";
import { serverEnv } from "@/lib/env";
import { loadOrNotFound } from "@/lib/load-or-not-found";

export const metadata: Metadata = { title: "Vị trí lưu" };

/** Mỗi lần hiện chừng này hồ sơ; phần còn lại ở danh sách hồ sơ đã lọc sẵn theo vị trí. */
const VISIBLE = 25;

/**
 * Một vị trí kho (FE-36): đường dẫn đầy đủ, mã QR, các vị trí con và các hồ sơ đang nằm ở đây (gồm cả vị trí con, BE-111).
 * Mở bằng cách quét QR ở trang Kho bản giấy hoặc bấm từ cây.
 */
export default async function StorageLocationPage({ params }: PageProps<"/kho-ban-giay/[locationId]">) {
  const { session, allowed } = await pageSession("storage.manage");
  if (!allowed) return <NoAccess session={session} what="xem vị trí lưu" />;
  if (serverEnv().mock) return <NeedsRealApi what="Vị trí lưu" />;
  const { locationId } = await params;
  if (!UUID.test(locationId)) notFound();

  const filter = parseDossierFilter({ "vi-tri": locationId, "sap-xep": "ma" });
  const [location, all, page] = await loadOrNotFound(() => Promise.all([getLocation(locationId), getLocations(), listDossiers(filter, VISIBLE)]));
  const children = all.filter((n) => n.parentId === location.id);
  const totals = subtreeCounts(all);
  const here = totals.get(location.id) ?? location.dossierCount;
  const crumbs = location.path.split(" › ");

  return (
    <>
      <PageHeader
        title={location.name}
        description={`${KIND_LABELS[location.kind] ?? location.kind} · ${location.code} · ${location.path}`}
        breadcrumbs={[{ label: "Kho bản giấy", href: routes.storage }, { label: crumbs[crumbs.length - 1] ?? location.name }]}
        actions={
          <a href={`/api/v1/storage-locations/labels?ids=${location.id}`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")} title="Mở nhãn QR (PDF A4) ở thẻ mới để in">
            <Printer aria-hidden className="size-4" /> In nhãn QR
          </a>
        }
        meta={!location.active ? <Chip tone="neutral">Đã ngừng dùng</Chip> : undefined}
      />
      <PageBody className="lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="grid min-w-0 content-start gap-4">
          <Section title="Quản lý vị trí" description="Thêm vị trí con, sửa tên, ngừng dùng khi không còn hồ sơ và vị trí con đang dùng, in nhãn QR cả nhánh.">
            <LocationActions location={location} labelsHref={labelsHref(subtreeIds(all, location.id))} />
          </Section>
          <Section title={`Hồ sơ ở đây · ${here}`} description="Gồm hồ sơ ở các vị trí con. Chỉ hiện hồ sơ trong phạm vi phân công của bạn.">
            {page.items.length === 0 ? (
              <EmptyState title="Chưa có hồ sơ nào ở vị trí này">Hồ sơ được xếp vào vị trí khi nộp lưu hoặc khi sửa thông tin hồ sơ.</EmptyState>
            ) : (
              <ul>
                <RowNavigation />
                {page.items.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line py-2.5 first:border-t-0">
                    <Link href={routes.dossier(d.id)} data-row className="grid min-w-0 flex-1 gap-0.5 hover:text-primary">
                      <span className="font-mono text-xs text-muted">{d.code}</span>
                      <span className="font-semibold">{d.title}</span>
                    </Link>
                    <WorkflowChip state={d.status} label={d.statusLabel} />
                    <span className="min-w-28 text-right text-[13px] text-muted">{d.status === "archived" ? "—" : <DueChip dueOn={d.dueOn} />}</span>
                  </li>
                ))}
              </ul>
            )}
            {page.nextCursor && (
              <p className="text-[13px] text-muted">
                Đang hiện {page.items.length} hồ sơ đầu. <Link href={`/ho-so?vi-tri=${location.id}&sap-xep=ma` as Route} className="font-semibold text-primary hover:underline">Xem tất cả hồ sơ ở đây</Link>
              </p>
            )}
          </Section>

          {children.length > 0 && (
            <Section title={`Vị trí con · ${children.length}`}>
              <ul className="grid gap-1.5 text-sm">
                {children.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-baseline gap-2">
                    <Link href={`/kho-ban-giay/${c.id}` as Route} className="font-semibold text-primary hover:underline">{c.name}</Link>
                    <span className="text-muted">{KIND_LABELS[c.kind] ?? c.kind} · {totals.get(c.id) ?? c.dossierCount} hồ sơ</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <aside aria-label="Mã QR" className="grid content-start gap-2 border border-line bg-surface p-3">
          {/* SVG do API sinh, nạp qua <img> (cùng origin, phân công theo cookie, BE-118): không chèn markup vào trang. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/v1/storage-locations/${location.id}/qr`} alt={`Mã QR của ${location.name}`} width={200} height={200} className="size-[200px] bg-white" />
          <p className="text-xs text-muted">Dán lên hộp, tủ hoặc kệ. Đầu đọc mã vạch quét ở trang Kho bản giấy sẽ mở đúng vị trí này.</p>
        </aside>
      </PageBody>
    </>
  );
}
