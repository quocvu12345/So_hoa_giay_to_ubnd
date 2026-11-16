import type { Metadata } from "next";
import { PackageOpen } from "lucide-react";
import { NoAccess } from "@/components/ui/no-access";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Xuất dữ liệu" };

export default async function ExportsPage() {
  const { session, allowed } = await pageSession("export.create");
  if (!allowed) return <NoAccess session={session} what="xuất dữ liệu" />;
  return (
    <ScaffoldPage
      title="Xuất dữ liệu"
      description="Tạo gói bàn giao gồm tệp PDF, dữ liệu mô tả, danh mục CSV và tệp mã băm để kiểm tra độc lập."
      breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Xuất dữ liệu" }]}
      icon={PackageOpen}
      emptyTitle="Chưa có gói xuất"
      emptyText="Chọn phạm vi (hồ sơ, nhóm, năm), hệ thống đóng gói ở nền; tải trong 7 ngày. Mỗi lần xuất được ghi nhật ký."
      task="FE-38 (API: BE-86)"
      plan={["Tiến độ đóng gói cập nhật trực tiếp", "Hiện mã băm của gói để đối chiếu"]}
    />
  );
}
