import type { Metadata } from "next";
import { PageBody, Section } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { DueChip } from "@/components/dossier/due-chip";
import { getDossier } from "@/features/dossier/dossier-data";
import { pageSession } from "@/lib/auth/page-guard";
import { serverEnv } from "@/lib/env";
import { loadOrNotFound } from "@/lib/load-or-not-found";

export const metadata: Metadata = { title: "Phân công hồ sơ" };

/**
 * Tab Phân công (FE-31, chỉ trưởng phòng/Ban có `dossier.assign`). Hiện người chủ trì và hạn hiện tại.
 * Đổi người chủ trì cần danh sách chuyên viên trong đơn vị kèm số hồ sơ đang giữ: API chưa có (BE-110;
 * `admin/users` cần quyền quản trị mà trưởng phòng không có), nên chưa làm ô chọn người.
 */
export default async function DossierAssignment({ params }: PageProps<"/ho-so/[id]/phan-cong">) {
  const { session, allowed } = await pageSession("dossier.assign");
  if (!allowed) return <NoAccess session={session} what="phân công hồ sơ" />;
  if (serverEnv().mock) return null;
  const { id } = await params;
  const dossier = await loadOrNotFound(() => getDossier(id));

  return (
    <PageBody>
      <Section title="Người chủ trì và hạn nội bộ" description="Người chủ trì chịu trách nhiệm hồ sơ; người được giao nhận thông báo. Lịch sử phân công nằm ở tab Nhật ký.">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted">Người chủ trì</dt>
          <dd>{dossier.assigneeName ?? <span className="text-muted">Chưa giao</span>}</dd>
          <dt className="text-muted">Hạn nội bộ</dt>
          <dd><DueChip dueOn={dossier.dueOn} /></dd>
        </dl>
        <p role="status" className="border border-dashed border-line-strong p-3 text-sm text-muted">
          Chưa đổi được người chủ trì tại đây: cần API liệt kê chuyên viên trong đơn vị kèm số hồ sơ mỗi người đang giữ (task BE-110). Khi có, màn này có ô chọn người có tìm kiếm, đặt hạn không trước hôm nay và bắt buộc ghi lý do khi đổi người.
        </p>
      </Section>
    </PageBody>
  );
}
