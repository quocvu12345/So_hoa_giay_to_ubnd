import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { EmptyState, PageBody, PlannedScreen } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Phân công hồ sơ" };

export default async function DossierAssignment() {
  const { session, allowed } = await pageSession("dossier.assign");
  if (!allowed) return <NoAccess session={session} what="phân công hồ sơ" />;
  return (
    <PageBody>
      <EmptyState icon={UserPlus} title="Người chủ trì, người phối hợp và hạn nội bộ">
        Chọn chuyên viên trong đơn vị, đặt hạn; người được giao nhận thông báo ngay. Lịch sử phân công nằm ở tab Nhật ký.
      </EmptyState>
      <PlannedScreen task="FE-31 (API: BE-65)" items={["Ô chọn chuyên viên có tìm kiếm, hiện số hồ sơ đang giữ của từng người", "Hạn nội bộ không trước hôm nay", "Đổi người chủ trì yêu cầu ghi lý do"]} />
    </PageBody>
  );
}
