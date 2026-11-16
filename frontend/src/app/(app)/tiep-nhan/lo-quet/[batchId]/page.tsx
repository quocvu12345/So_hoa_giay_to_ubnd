import type { Metadata } from "next";
import { NoAccess } from "@/components/ui/no-access";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Chi tiết lô quét" };

export default async function BatchPage({ params }: PageProps<"/tiep-nhan/lo-quet/[batchId]">) {
  const { session, allowed } = await pageSession(["intake.manage", "intake.upload"]);
  if (!allowed) return <NoAccess session={session} what="xem lô quét" />;
  const { batchId } = await params;
  return (
    <ScaffoldPage
      title={`Lô quét ${batchId}`}
      description="Tệp đã quét trong lô, lỗi ảnh theo từng trang và tình trạng đối chiếu."
      breadcrumbs={[{ label: "Tiếp nhận PDF", href: routes.intake }, { label: "Lô quét", href: routes.intakeBatches }, { label: batchId }]}
      emptyTitle="Chưa có tệp trong lô"
      emptyText="Tệp nạp khi chọn lô này sẽ hiện ở đây cùng các lỗi ảnh (trang trắng, mờ, lệch) cần quét lại."
      task="FE-41 (API: BE-40, BE-53)"
      plan={["Thông tin lô và biên bản giao nhận", "Bảng lỗi ảnh theo trang: đánh dấu đã quét lại hoặc bỏ qua có lý do", "Đếm tờ dự kiến so với trang đã quét"]}
    />
  );
}
