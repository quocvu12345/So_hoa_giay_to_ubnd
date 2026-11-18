import type { Metadata } from "next";
import { PageBody, Section } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { DueChip } from "@/components/dossier/due-chip";
import { AssignPanel } from "@/features/dossier/assign-panel";
import { getAssignees, getDossier } from "@/features/dossier/dossier-data";
import { pageSession } from "@/lib/auth/page-guard";
import { serverEnv } from "@/lib/env";
import { loadOrNotFound } from "@/lib/load-or-not-found";

export const metadata: Metadata = { title: "Phân công hồ sơ" };

/**
 * Tab Phân công (FE-31, chỉ trưởng phòng/Ban có `dossier.assign`). Hiện người chủ trì và hạn hiện tại, và cho đổi:
 * danh sách chuyên viên của phòng đến từ `GET /dossiers/{id}/assignees` (BE-110) kèm số hồ sơ mỗi người đang giữ.
 */
export default async function DossierAssignment({ params }: PageProps<"/ho-so/[id]/phan-cong">) {
  const { session, allowed } = await pageSession("dossier.assign");
  if (!allowed) return <NoAccess session={session} what="phân công hồ sơ" />;
  if (serverEnv().mock) return null;
  const { id } = await params;
  const [dossier, options] = await loadOrNotFound(() => Promise.all([getDossier(id), getAssignees(id)]));
  const current = options.find((o) => o.isCurrent) ?? null;

  return (
    <PageBody>
      <Section title="Người chủ trì và hạn nội bộ" description="Người chủ trì chịu trách nhiệm hồ sơ; người được giao nhận thông báo. Lịch sử phân công nằm ở tab Nhật ký.">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted">Người chủ trì</dt>
          <dd>{dossier.assigneeName ?? <span className="text-muted">Chưa giao</span>}</dd>
          <dt className="text-muted">Hạn nội bộ</dt>
          <dd><DueChip dueOn={dossier.dueOn} /></dd>
        </dl>
      </Section>
      <Section title="Giao việc" description="Chọn chuyên viên của phòng. Số bên dưới tên là số hồ sơ họ đang chủ trì (chưa lưu trữ) trên toàn phòng, để cân tải trước khi giao.">
        <AssignPanel
          dossierId={id}
          options={options}
          currentAssigneeId={current?.userId ?? null}
          currentDueOn={dossier.dueOn ?? null}
          locked={dossier.status === "archived" ? "Hồ sơ đã lưu trữ và khóa sửa: không giao lại người chủ trì." : undefined}
        />
      </Section>
    </PageBody>
  );
}
