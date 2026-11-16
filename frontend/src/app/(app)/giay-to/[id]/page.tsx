import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { NoAccess } from "@/components/ui/no-access";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Chi tiết giấy tờ" };

export default async function DocumentPage({ params }: PageProps<"/giay-to/[id]">) {
  const { session, allowed } = await pageSession("document.view");
  if (!allowed) return <NoAccess session={session} what="xem giấy tờ" />;
  const { id } = await params;
  return (
    <ScaffoldPage
      title="Chi tiết giấy tờ"
      description="Bản gốc, thông tin đã đối chiếu, phiên bản tệp, chữ ký số và các hồ sơ chứa giấy tờ này."
      breadcrumbs={[{ label: "Tra cứu", href: routes.search }, { label: id }]}
      icon={FileText}
      emptyTitle="Trình xem và thông tin giấy tờ"
      emptyText="Bên trái là bản gốc; bên phải là các trường đã đối chiếu, giá trị nào đã sửa so với AI có nhãn “đã sửa”."
      task="FE-33 (API: BE-47, BE-52, BE-54)"
      plan={["Mở đúng trang khi đến từ Tra cứu (?trang=)", "Tải xuống, in theo quyền; mọi lần tải được ghi nhật ký", "Liên kết: phụ lục của, thay thế cho, trả lời cho"]}
    />
  );
}
