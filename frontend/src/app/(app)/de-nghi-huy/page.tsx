import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { NoAccess } from "@/components/ui/no-access";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Đề nghị hủy" };

export default async function DisposalsPage() {
  const { session, allowed } = await pageSession(["disposal.request", "disposal.approve"]);
  if (!allowed) return <NoAccess session={session} what="đề nghị hủy tài liệu" />;
  return (
    <ScaffoldPage
      title="Đề nghị hủy"
      description="Đề nghị hủy tài liệu hết thời hạn bảo quản, phê duyệt kèm văn bản quyết định. Hệ thống không tự hủy."
      breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Đề nghị hủy" }]}
      icon={Trash2}
      emptyTitle="Chưa có đề nghị hủy"
      emptyText="Chỉ hồ sơ có thời hạn bảo quản đã được xác nhận mới đề nghị được. Hủy là bước cuối, cần xác nhận hai lần trong trang."
      task="FE-39 (API: BE-87)"
      plan={["Tab: Đề nghị · Chờ duyệt · Đã quyết định", "Đính văn bản quyết định khi duyệt"]}
    />
  );
}
