import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { ActionBar } from "@/components/dossier/action-bar";
import { NeedsRealApi } from "@/components/ui/blocks";
import { ButtonLink } from "@/components/ui/button";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { WorkflowChip } from "@/components/ui/status-chip";
import { TabsNav, type TabItem } from "@/components/ui/tabs-nav";
import { routes } from "@/config/routes";
import { acceptsDocuments, getActions, getDossier, UUID } from "@/features/dossier/dossier-data";
import { pageSession } from "@/lib/auth/page-guard";
import { serverEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { loadOrNotFound } from "@/lib/load-or-not-found";

const WAITING: Record<string, string> = {
  draft: "Hồ sơ đang được chuyên viên chuẩn bị.",
  returned: "Hồ sơ đang chờ chuyên viên bổ sung.",
  department_review: "Hồ sơ đang chờ trưởng phòng / Ban kiểm tra.",
  leadership_review: "Hồ sơ đang chờ lãnh đạo cho ý kiến.",
  ready_archive: "Hồ sơ đang chờ văn thư tiếp nhận nộp lưu.",
  archived: "Hồ sơ đã lưu trữ và khóa sửa.",
};

/**
 * Khung trang hồ sơ: đầu trang (mã, tên, trạng thái, hạn) → tab là đường dẫn thật → nội dung tab
 * → thanh thao tác dính đáy (FE-28, FE-30). Dữ liệu từ API; thao tác lấy từ /actions.
 */
export default async function DossierLayout({ children, params }: LayoutProps<"/ho-so/[id]">) {
  const { session, allowed } = await pageSession("dossier.read");
  if (!allowed) return <NoAccess session={session} what="xem hồ sơ" />;
  if (serverEnv().mock) return <NeedsRealApi what="Trang hồ sơ" />;
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [dossier, actions] = await loadOrNotFound(() => Promise.all([getDossier(id), getActions(id)]));
  const editable = acceptsDocuments(dossier.status) && session.permissions.includes("dossier.prepare");

  const tabs: TabItem[] = [
    { href: routes.dossier(id), label: "Tổng quan" },
    { href: routes.dossierDocuments(id), label: "Giấy tờ", count: dossier.documents.length },
    ...(session.permissions.includes("dossier.assign") ? [{ href: routes.dossierAssignment(id), label: "Phân công" }] : []),
    { href: routes.dossierHistory(id), label: "Nhật ký" },
  ];

  return (
    <div className="flex min-h-[calc(100dvh-57px)] flex-col">
      <PageHeader
        title={dossier.title}
        breadcrumbs={[{ label: "Hồ sơ", href: routes.dossiers }, { label: dossier.code }]}
        meta={
          <>
            <span className="font-mono">{dossier.code}</span>
            <WorkflowChip state={dossier.status} label={dossier.statusLabel} />
            <span>{dossier.workGroupCode} · {dossier.workGroupTitle}</span>
            <span>· Chủ trì: {dossier.assigneeName ?? "chưa giao"}</span>
            {dossier.dueOn && <span>· Hạn nội bộ {formatDate(dossier.dueOn)}</span>}
          </>
        }
        actions={
          editable ? (
            <ButtonLink href={routes.dossierEdit(id)} size="sm">
              <Pencil aria-hidden className="size-4" /> Sửa thông tin
            </ButtonLink>
          ) : undefined
        }
      />
      <TabsNav tabs={tabs} label="Các phần của hồ sơ" />
      <div className="flex-1">{children}</div>
      <ActionBar dossierId={id} version={dossier.version} actions={actions} waitingFor={WAITING[dossier.status] ?? ""} />
    </div>
  );
}
