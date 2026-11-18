import type { Metadata } from "next";
import Link from "next/link";
import { Check, CircleAlert, X } from "lucide-react";
import { PageBody, Section } from "@/components/ui/blocks";
import { Chip, type Tone } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { acceptsDocuments, getChecklist, getDossier } from "@/features/dossier/dossier-data";
import { PlaceDossierButton } from "@/features/storage/location-panels";
import { placementChoices } from "@/features/storage/location-rules";
import { getLocations } from "@/features/storage/storage-data";
import { pageSession } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { formatDate, formatDateTime } from "@/lib/format";
import { loadOrNotFound } from "@/lib/load-or-not-found";

export const metadata: Metadata = { title: "Tổng quan hồ sơ" };

const ACCESS_LABELS: Record<string, string> = { internal: "Nội bộ", restricted: "Hạn chế", public: "Công khai" };

type Row = { key: string; name: string; tone: Tone; note: string; icon: typeof Check };

/** Một dòng thành phần: biểu tượng, tên, ghi chú. Luôn có chữ, không chỉ dựa vào màu. */
function RowView({ row }: { row: Row }) {
  const Icon = row.icon;
  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-dashed border-line py-2 first:border-t-0">
      <Icon aria-hidden className={row.tone === "ok" ? "size-4 flex-none text-ok" : row.tone === "warn" ? "size-4 flex-none text-warn" : "size-4 flex-none text-bad"} />
      <span className="min-w-0 flex-1 text-sm">{row.name}</span>
      <Chip tone={row.tone}>{row.note}</Chip>
    </li>
  );
}

/** Tab Tổng quan: danh sách kiểm tra đủ thành phần thay cho thông báo lỗi chung khi trình (FE-28). */
export default async function DossierOverview({ params }: PageProps<"/ho-so/[id]">) {
  const { session } = await pageSession("dossier.read");
  if (serverEnv().mock) return null;
  const { id } = await params;
  const [dossier, checklist] = await loadOrNotFound(() => Promise.all([getDossier(id), getChecklist(id)]));
  // Đặt/chuyển vị trí bản giấy (BE-82): chỉ người quản lý kho; danh sách hộp/kệ chỉ tải khi có quyền.
  const canPlace = can(session, "storage.manage");
  const placements = canPlace ? placementChoices(await getLocations()).map((n) => ({ id: n.id, path: n.path })) : [];

  // Hồ sơ theo thủ tục: liệt kê từng thành phần của thủ tục. Hồ sơ thường: liệt kê từng giấy tờ đã xếp.
  const rows: Row[] = checklist.components
    ? checklist.components.map((c) => ({
        key: c.componentId,
        name: `${c.name}${c.required ? "" : " (không bắt buộc)"}`,
        tone: c.state === "ok" ? "ok" : c.state === "pending" ? "warn" : "bad",
        note: c.state === "ok" ? "Đã đối chiếu" : c.state === "pending" ? "Chưa đối chiếu xong" : "Còn thiếu",
        icon: c.state === "ok" ? Check : c.state === "pending" ? CircleAlert : X,
      }))
    : checklist.items.map((c) => ({
        key: c.documentId,
        name: c.title,
        tone: c.state === "verified" ? "ok" : "warn",
        note: c.state === "verified" ? "Đã đối chiếu" : c.state === "unclassified" ? "Chưa chọn loại giấy tờ" : c.pendingFields > 0 ? `${c.pendingFields} trường chưa xác nhận` : "Chưa đối chiếu xong",
        icon: c.state === "verified" ? Check : CircleAlert,
      }));
  const canAdd = acceptsDocuments(dossier.status);
  const { summary } = checklist;

  return (
    <PageBody className="lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Section
        title="Thành phần hồ sơ"
        description={
          checklist.procedureName
            ? `Theo thủ tục: ${checklist.procedureName}.`
            : "Các giấy tờ đã xếp vào hồ sơ và tình trạng đối chiếu. Thiếu hoặc chưa đối chiếu thì chưa trình được."
        }
      >
        {summary.ready ? (
          <p className="text-sm font-semibold text-ok" role="status">Đủ điều kiện trình: {summary.verifiedCount}/{summary.componentCount} giấy tờ đã đối chiếu.</p>
        ) : (
          <div role="status" className="grid gap-1 text-sm">
            <p className="font-semibold text-warn">Chưa đủ điều kiện trình ({summary.verifiedCount}/{summary.componentCount} giấy tờ đã đối chiếu):</p>
            <ul className="list-disc pl-5 text-warn">
              {summary.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
        {rows.length === 0 ? (
          <p className="border border-dashed border-line-strong p-4 text-sm text-muted">Hồ sơ chưa có giấy tờ nào.</p>
        ) : (
          <ul className="grid">
            {rows.map((row) => (
              <RowView key={row.key} row={row} />
            ))}
          </ul>
        )}
        {canAdd && (
          <Link href={routes.dossierDocuments(id)} className="text-sm font-semibold text-primary hover:underline">
            ＋ Thêm giấy tờ từ hộp tiếp nhận
          </Link>
        )}
      </Section>

      <div className="grid content-start gap-4">
        <Section title="Thông tin">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted">Nhóm hồ sơ</dt><dd>{dossier.workGroupCode} · {dossier.workGroupTitle}</dd>
            <dt className="text-muted">Mức tiếp cận</dt><dd>{ACCESS_LABELS[dossier.accessLevel] ?? dossier.accessLevel}</dd>
            <dt className="text-muted">Năm</dt><dd className="tabular-nums">{dossier.year}</dd>
            <dt className="text-muted">Người chủ trì</dt><dd>{dossier.assigneeName ?? "Chưa giao"}</dd>
            <dt className="text-muted">Hạn nội bộ</dt><dd className="tabular-nums">{formatDate(dossier.dueOn)}</dd>
            <dt className="text-muted">Vị trí bản giấy</dt>
            <dd className="flex flex-wrap items-center gap-2">
              {dossier.physicalLocation ? <Link href={routes.storage} className="text-primary hover:underline">{dossier.physicalLocation}</Link> : <span className="text-muted">Chưa đặt</span>}
              {canPlace && <PlaceDossierButton dossierId={dossier.id} current={dossier.physicalLocation ?? null} choices={placements} />}
            </dd>
            {dossier.procedureName && (<><dt className="text-muted">Thủ tục</dt><dd>{dossier.procedureName}</dd></>)}
            {dossier.creatorOrganizationName && (<><dt className="text-muted">Cơ quan hình thành</dt><dd>{dossier.creatorOrganizationName}</dd></>)}
            <dt className="text-muted">Tạo lúc</dt><dd className="tabular-nums">{formatDateTime(dossier.createdAt)}</dd>
            <dt className="text-muted">Cập nhật</dt><dd className="tabular-nums">{formatDateTime(dossier.updatedAt)}</dd>
          </dl>
          {dossier.notes && <p className="border-t border-line pt-2 text-sm"><span className="text-muted">Ghi chú: </span>{dossier.notes}</p>}
        </Section>
      </div>
    </PageBody>
  );
}
