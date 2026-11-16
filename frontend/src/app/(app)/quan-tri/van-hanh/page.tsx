import type { Metadata } from "next";
import { Settings2 } from "lucide-react";
import { NoAccess } from "@/components/ui/no-access";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Vận hành" };

export default async function AdminOperationsPage() {
  const { session, allowed } = await pageSession(["processing.manage", "admin.settings"]);
  if (!allowed) return <NoAccess session={session} what="xem vận hành" />;
  return (
    <ScaffoldPage
      title="Vận hành"
      description="Hàng đợi AI, máy đọc PDF, phiên bản mô hình, lần sao lưu gần nhất và cài đặt hệ thống."
      breadcrumbs={[{ label: "Quản trị" }, { label: "Vận hành" }]}
      icon={Settings2}
      emptyTitle="Tình trạng hệ thống"
      emptyText="Độ dài hàng đợi, job lỗi, thời gian đọc trung bình mỗi trang, dung lượng kho tệp, kết quả sao lưu."
      task="FE-44 (API: BE-88, BE-89)"
      plan={["Đọc lại job lỗi, hủy job treo", "Liên kết công cụ thử nghiệm SAM 3 (chỉ quản trị kỹ thuật)"]}
    />
  );
}
