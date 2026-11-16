import type { Metadata } from "next";
import { HandHelping } from "lucide-react";
import { NoAccess } from "@/components/ui/no-access";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Mượn trả" };

export default async function LoansPage() {
  const { session, allowed } = await pageSession(["loan.request", "loan.approve"]);
  if (!allowed) return <NoAccess session={session} what="mượn trả hồ sơ" />;
  return (
    <ScaffoldPage
      title="Mượn trả"
      description="Đề nghị mượn hồ sơ giấy, duyệt, giao, nhận trả và theo dõi quá hạn."
      breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Mượn trả" }]}
      icon={HandHelping}
      emptyTitle="Chưa có đề nghị mượn"
      emptyText="Đề nghị mượn từ trang hồ sơ hoặc tại đây. Người duyệt nhận thông báo; quá hạn trả có nhắc tự động."
      task="FE-36 (API: BE-83)"
      plan={["Tab: Của tôi · Chờ duyệt · Đang mượn · Quá hạn", "Một hồ sơ chỉ có một lượt mượn đang hiệu lực"]}
    />
  );
}
