import type { Metadata } from "next";
import { Users } from "lucide-react";
import { NoAccess } from "@/components/ui/no-access";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Chi tiết người dùng" };

export default async function AdminUserPage({ params }: PageProps<"/quan-tri/nguoi-dung/[id]">) {
  const { session, allowed } = await pageSession("admin.users");
  if (!allowed) return <NoAccess session={session} what="quản lý người dùng" />;
  const { id } = await params;
  return (
    <ScaffoldPage
      title="Chi tiết người dùng"
      description="Phân công, ủy quyền và lịch sử thay đổi của một tài khoản."
      breadcrumbs={[{ label: "Quản trị" }, { label: "Người dùng & phân công", href: routes.adminUsers }, { label: id }]}
      icon={Users}
      emptyTitle="Phân công của người dùng"
      emptyText="Bảng phân công còn hiệu lực và đã kết thúc, kèm căn cứ."
      task="FE-42 (API: BE-34)"
      plan={["Thêm, kết thúc phân công", "Lịch sử thay đổi lấy từ nhật ký hệ thống"]}
    />
  );
}
