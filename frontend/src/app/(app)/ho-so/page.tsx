import type { Metadata } from "next";
import Link from "next/link";
import { Download, FolderPlus, Search } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState, PageBody, PlannedScreen } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { WorkflowChip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";
import { MOCK_DOSSIERS, WORKFLOW_LABELS, type WorkflowState } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Hồ sơ" };

function fold(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();
}

/**
 * Danh sách hồ sơ trong phạm vi. Bộ lọc là form GET: nằm trên URL, gửi đường dẫn cho người khác
 * mở đúng bộ lọc, nút Back hoạt động, chạy được cả khi JavaScript chưa tải xong.
 */
export default async function DossiersPage({ searchParams }: PageProps<"/ho-so">) {
  const { session, allowed } = await pageSession("dossier.read");
  if (!allowed) return <NoAccess session={session} what="xem hồ sơ" />;
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params["trang-thai"] === "string" ? (params["trang-thai"] as WorkflowState) : "";

  const rows = MOCK_DOSSIERS.filter(
    (d) => (!status || d.status === status) && (!q || fold(`${d.code} ${d.title} ${d.workGroup}`).includes(fold(q))),
  );
  const canCreate = session.permissions.includes("dossier.prepare");

  return (
    <>
      <PageHeader
        title="Hồ sơ"
        description="Hồ sơ thuộc phạm vi phân công của bạn. Nhấn vào mã hồ sơ để mở."
        breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Hồ sơ" }]}
        actions={
          <>
            <Button disabled>
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
        <form className="flex flex-wrap items-end gap-3 border border-line bg-surface p-3" role="search">
          <label className="grid min-w-[240px] flex-1 gap-1 text-[13px] font-semibold">
            Từ khóa
            <span className="flex items-center gap-2 border border-line-strong px-2 focus-within:border-primary">
              <Search aria-hidden className="size-4 text-muted" />
              <input name="q" defaultValue={q} placeholder="Mã, tên hồ sơ, nhóm…" className="h-9 flex-1 bg-transparent font-normal outline-none" />
            </span>
          </label>
          <label className="grid gap-1 text-[13px] font-semibold">
            Trạng thái
            <select name="trang-thai" defaultValue={status} className="h-[38px] border border-line-strong bg-surface px-2 font-normal">
              <option value="">Tất cả</option>
              {Object.entries(WORKFLOW_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="primary">Lọc</Button>
          {(q || status) && <Link href={routes.dossiers} className="h-10 content-center text-sm text-primary hover:underline">Xóa lọc</Link>}
        </form>

        {rows.length === 0 ? (
          <EmptyState title="Không có hồ sơ khớp bộ lọc">Thử bỏ bớt điều kiện lọc, hoặc tìm theo mã hồ sơ đầy đủ.</EmptyState>
        ) : (
          <div className="overflow-x-auto border border-line bg-surface">
            <table className="w-full min-w-[860px] text-sm">
              <caption className="sr-only">Danh sách hồ sơ, {rows.length} kết quả</caption>
              <thead className="bg-soft text-left text-[13px] text-heading">
                <tr>
                  <th className="px-3 py-2 font-semibold">Mã · Tên hồ sơ</th>
                  <th className="px-3 py-2 font-semibold">Nhóm</th>
                  <th className="px-3 py-2 font-semibold">Trạng thái</th>
                  <th className="px-3 py-2 font-semibold">Người chủ trì</th>
                  <th className="px-3 py-2 text-right font-semibold">Giấy tờ đã đối chiếu</th>
                  <th className="px-3 py-2 text-right font-semibold">Hạn nội bộ</th>
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
                    <td className="px-3 py-2.5 text-muted">{d.workGroup}</td>
                    <td className="px-3 py-2.5"><WorkflowChip state={d.status} /></td>
                    <td className="px-3 py-2.5">{d.assignee}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{d.verifiedCount} / {d.documentCount}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{d.dueOn ? d.dueOn.split("-").reverse().join("/") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PlannedScreen
          task="FE-26 (API: BE-60)"
          items={[
            "Dữ liệu từ GET /api/v1/dossiers với phân trang keyset, sắp xếp theo cột",
            "Thêm lọc: nhóm hồ sơ, đầu mối, năm, người chủ trì, quá hạn",
            "Xuất CSV đúng bộ lọc đang xem (ghi access_events)",
          ]}
        />
      </PageBody>
    </>
  );
}
