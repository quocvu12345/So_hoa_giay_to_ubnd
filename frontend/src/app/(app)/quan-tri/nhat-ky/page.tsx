import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { NoAccess } from "@/components/ui/no-access";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Nhật ký hệ thống" };

export default async function AdminAuditPage() {
  const { session, allowed } = await pageSession("admin.settings");
  if (!allowed) return <NoAccess session={session} what="xem nhật ký hệ thống" />;
  return (
    <ScaffoldPage
      title="Nhật ký hệ thống"
      description="Ai đã xem, tải, in, xuất, sửa gì và khi nào. Chỉ đọc, không sửa hoặc xóa được."
      breadcrumbs={[{ label: "Quản trị" }, { label: "Nhật ký hệ thống" }]}
      icon={ShieldCheck}
      emptyTitle="Nhật ký truy cập và thay đổi"
      emptyText="Lọc theo người dùng, hành động, đối tượng, khoảng thời gian, mã tương quan (correlation id)."
      task="FE-44 (API: BE-88)"
      plan={["Tìm theo mã lỗi người dùng gửi để xem toàn bộ request liên quan", "Xuất CSV cho kiểm tra định kỳ"]}
    />
  );
}
