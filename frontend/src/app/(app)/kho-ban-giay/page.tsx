import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { Boxes, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, NeedsRealApi, PageBody } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { Chip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { filterLocations, indentClass, KIND_LABELS, subtreeCounts } from "@/features/storage/location-labels";
import { findLocationByQr, getLocations } from "@/features/storage/storage-data";
import { ApiError } from "@/lib/api/server";
import { pageSession } from "@/lib/auth/page-guard";
import { serverEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Kho bản giấy" };

function param(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/**
 * Kho bản giấy (FE-36): cây vị trí kho › phòng › tủ › kệ › hộp kèm số hồ sơ đang nằm ở từng vị trí. Ô tìm nhận nội dung mã QR từ đầu đọc mã vạch
 * (gõ như bàn phím rồi Enter): đúng mã thì mở thẳng vị trí đó; không phải mã thì lọc cây theo mã, tên, đường dẫn.
 */
export default async function StoragePage({ searchParams }: PageProps<"/kho-ban-giay">) {
  const { session, allowed } = await pageSession("storage.manage");
  if (!allowed) return <NoAccess session={session} what="quản lý kho bản giấy" />;
  const q = param((await searchParams).q);
  const real = !serverEnv().mock;

  let scanMiss = false;
  if (real && q) {
    try {
      const found = await findLocationByQr(q);
      redirect(`/kho-ban-giay/${found.id}`);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;      // redirect() ném NEXT_REDIRECT: không phải ApiError nên đi tiếp
      scanMiss = error.status === 404 || error.status === 400;
    }
  }
  const nodes = real ? await getLocations() : [];
  const shown = filterLocations(nodes, q);
  const totals = subtreeCounts(nodes);

  return (
    <>
      <PageHeader
        title="Kho bản giấy"
        description="Cây vị trí kho → phòng → tủ → kệ → hộp. Quét mã QR trên hộp để mở ngay."
        breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Kho bản giấy" }]}
      />
      <PageBody>
        {!real ? (
          <NeedsRealApi what="Kho bản giấy" />
        ) : (
          <>
            <form role="search" className="flex flex-wrap items-end gap-3 border border-line bg-surface p-3">
              <label className="grid min-w-[260px] flex-1 gap-1 text-[13px] font-semibold">
                Quét mã QR hoặc tìm vị trí
                <span className="flex items-center gap-2 border border-line-strong px-2 focus-within:border-primary">
                  <QrCode aria-hidden className="size-4 text-muted" />
                  <input name="q" defaultValue={q} autoFocus autoComplete="off" placeholder="Đặt con trỏ vào đây rồi quét mã, hoặc gõ mã, tên vị trí" className="h-9 flex-1 bg-transparent font-normal outline-none" />
                </span>
              </label>
              <Button type="submit" variant="primary">Tìm</Button>
              {q && <Link href={routes.storage as Route} className="h-10 content-center text-sm text-primary hover:underline">Xóa tìm</Link>}
            </form>

            {scanMiss && shown.length === 0 && (
              <p role="status" className="border border-warn bg-warn-soft p-3 text-sm">Không có vị trí nào khớp “{q}”. Nếu vừa quét mã, kiểm tra nhãn có đúng của hệ thống này không.</p>
            )}

            {nodes.length === 0 ? (
              <EmptyState icon={Boxes} title="Chưa có vị trí kho">Tạo kho và các cấp bên trong, in nhãn QR dán lên hộp.</EmptyState>
            ) : shown.length === 0 ? (
              !scanMiss && <EmptyState icon={Boxes} title={`Không có vị trí khớp “${q}”`}>Thử gõ một phần mã hoặc tên, không cần dấu.</EmptyState>
            ) : (
              <div className="overflow-x-auto border border-line bg-surface">
                <table className="w-full min-w-[640px] text-sm">
                  <caption className="sr-only">Cây vị trí kho, {shown.length} vị trí</caption>
                  <thead className="bg-soft text-left text-[13px] text-heading">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">Vị trí</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Cấp</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Mã</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Hồ sơ (gồm vị trí con)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((n) => (
                      <tr key={n.id} className="border-t border-line">
                        <th scope="row" className={`px-3 py-2.5 text-left font-normal ${q ? "" : indentClass(n.depth)}`}>
                          <Link href={`/kho-ban-giay/${n.id}` as Route} className="font-semibold hover:text-primary">{n.name}</Link>
                          {q && <span className="block text-xs text-muted">{n.path}</span>}
                          {!n.active && <Chip tone="neutral" className="ml-2">Ngừng dùng</Chip>}
                        </th>
                        <td className="px-3 py-2.5 text-muted">{KIND_LABELS[n.kind] ?? n.kind}</td>
                        <td className="px-3 py-2.5 font-mono text-xs">{n.code}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {(totals.get(n.id) ?? 0) > 0 ? (
                            <Link href={`/ho-so?vi-tri=${n.id}` as Route} className="font-semibold text-primary hover:underline" aria-label={`${totals.get(n.id)} hồ sơ ở ${n.name} và các vị trí con. Mở danh sách`}>{totals.get(n.id)}</Link>
                          ) : (
                            <span className="text-muted">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}
