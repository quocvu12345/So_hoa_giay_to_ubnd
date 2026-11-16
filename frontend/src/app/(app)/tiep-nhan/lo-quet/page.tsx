import type { Metadata } from "next";
import { FolderInput, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoAccess } from "@/components/ui/no-access";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Lô quét" };

export default async function BatchesPage() {
  const { session, allowed } = await pageSession(["intake.manage", "intake.upload"]);
  if (!allowed) return <NoAccess session={session} what="xem lô quét" />;
  return (
    <ScaffoldPage
      title="Lô quét"
      description="Mỗi lô là một lần bàn giao hồ sơ giấy để quét: đơn vị giao, hộp, số tờ dự kiến và số trang đã quét."
      breadcrumbs={[{ label: "Tiếp nhận PDF", href: routes.intake }, { label: "Lô quét" }]}
      actions={<Button variant="primary" disabled><Plus aria-hidden className="size-4" /> Tạo lô quét</Button>}
      icon={FolderInput}
      emptyTitle="Chưa có lô quét"
      emptyText="Tạo lô trước khi quét để truy được từng trang về đúng lần bàn giao và biên bản giao nhận."
      task="FE-41 (API: BE-40, BE-53)"
      plan={["Danh sách lô: mã, đơn vị giao, trạng thái, tờ dự kiến / trang đã quét, lỗi ảnh mở", "Tạo lô: đơn vị, hộp, số tờ, biên bản giao nhận", "Đóng lô: cảnh báo khi còn lỗi ảnh chưa xử lý"]}
    />
  );
}
