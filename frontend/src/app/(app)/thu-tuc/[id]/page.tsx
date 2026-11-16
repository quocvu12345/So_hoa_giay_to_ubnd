import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Chi tiết thủ tục" };

export default async function ProcedurePage({ params }: PageProps<"/thu-tuc/[id]">) {
  await pageSession();
  const { id } = await params;
  return (
    <ScaffoldPage
      title="Chi tiết thủ tục"
      description="Thành phần hồ sơ theo công bố, số bản chính/bản sao, mẫu biểu tải về, căn cứ và lịch sử thay thế."
      breadcrumbs={[{ label: "Thủ tục hành chính", href: routes.procedures }, { label: id }]}
      icon={BookOpen}
      emptyTitle="Thành phần hồ sơ và mẫu biểu"
      emptyText="Mỗi thành phần: tên, bản chính/bản sao, bắt buộc theo công bố, mẫu tải về."
      task="FE-35 (API: BE-33)"
      plan={["Tải mẫu biểu (docx/pdf)", "Nút “Tạo hồ sơ theo thủ tục này” cho người có quyền"]}
    />
  );
}
