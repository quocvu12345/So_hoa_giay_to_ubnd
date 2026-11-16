import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { NoAccess } from "@/components/ui/no-access";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Danh mục" };

export default async function AdminCatalogPage() {
  const { session, allowed } = await pageSession("catalog.manage");
  if (!allowed) return <NoAccess session={session} what="sửa danh mục" />;
  return (
    <ScaffoldPage
      title="Danh mục"
      description="38 nhóm hồ sơ, 427 loại giấy tờ, 2.624 trường dữ liệu; đánh dấu đã xác nhận và thời hạn bảo quản."
      breadcrumbs={[{ label: "Quản trị" }, { label: "Danh mục" }]}
      icon={ScrollText}
      emptyTitle="Cây danh mục"
      emptyText="Cơ quan → đầu mối → nhóm hồ sơ → loại giấy tờ → trường. Loại đã có giấy tờ chỉ ngừng dùng, không xóa."
      task="FE-43 (API: BE-32, BE-35)"
      plan={["Sửa trường: nhãn, kiểu, bắt buộc khi đối chiếu, trường quan trọng", "Thời hạn bảo quản chỉ ghi khi có căn cứ được xác nhận"]}
    />
  );
}
