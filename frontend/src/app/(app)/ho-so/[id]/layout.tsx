import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { ActionBar } from "@/components/dossier/action-bar";
import { ButtonLink } from "@/components/ui/button";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { WorkflowChip } from "@/components/ui/status-chip";
import { TabsNav, type TabItem } from "@/components/ui/tabs-nav";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";
import { MOCK_CHECKLIST, MOCK_DOSSIERS } from "@/lib/mock/data";
import { mockAllowedActions } from "@/lib/workflow";

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
 * → thanh thao tác dính đáy. Hồ sơ ngoài phạm vi trả 404, không tiết lộ hồ sơ có tồn tại.
 */
export default async function DossierLayout({ children, params }: LayoutProps<"/ho-so/[id]">) {
  const { session, allowed } = await pageSession("dossier.read");
  if (!allowed) return <NoAccess session={session} what="xem hồ sơ" />;
  const { id } = await params;
  const dossier = MOCK_DOSSIERS.find((d) => d.id === id);
  if (!dossier) notFound();

  const missing = MOCK_CHECKLIST.filter((c) => c.state !== "ok").length;
  const actions = mockAllowedActions(dossier.status, session.activeAssignment.role);
  const blockedReason =
    actions.some((a) => a.action === "submit") && missing > 0 ? `Chưa trình được: còn ${missing} thành phần chưa đủ hoặc chưa đối chiếu (xem Tổng quan).` : undefined;
  const editable = ["draft", "returned"].includes(dossier.status) && session.permissions.includes("dossier.prepare");

  const tabs: TabItem[] = [
    { href: routes.dossier(id), label: "Tổng quan" },
    { href: routes.dossierDocuments(id), label: "Giấy tờ", count: dossier.documentCount },
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
            <WorkflowChip state={dossier.status} />
            <span>{dossier.workGroup}</span>
            <span>· Chủ trì: {dossier.assignee}</span>
            {dossier.dueOn && <span>· Hạn nội bộ {dossier.dueOn.split("-").reverse().join("/")}</span>}
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
      <ActionBar actions={actions} blockedReason={blockedReason} waitingFor={WAITING[dossier.status]} />
    </div>
  );
}
