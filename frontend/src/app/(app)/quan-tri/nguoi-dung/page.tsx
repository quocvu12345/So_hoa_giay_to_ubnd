import type { Metadata } from "next";
import { Users } from "lucide-react";
import { NoAccess } from "@/components/ui/no-access";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Người dùng & phân công" };

export default async function AdminUsersPage() {
  const { session, allowed } = await pageSession("admin.users");
  if (!allowed) return <NoAccess session={session} what="quản lý người dùng" />;
  return (
    <ScaffoldPage
      title="Người dùng & phân công"
      description="Tài khoản, phân công có thời hạn theo cơ quan và đơn vị, ủy quyền cho cấp phó."
      breadcrumbs={[{ label: "Quản trị" }, { label: "Người dùng & phân công" }]}
      icon={Users}
      emptyTitle="Danh sách người dùng"
      emptyText="Mỗi dòng: tên, tài khoản, phân công còn hiệu lực, trạng thái. Phân công sắp hết hạn có chip vàng."
      task="FE-42 (API: BE-34)"
      plan={["Tạo phân công: vai trò, cơ quan, đơn vị, thời hạn, căn cứ", "Ủy quyền có thời hạn, thu hồi được", "Khóa tài khoản không xóa lịch sử"]}
    />
  );
}
