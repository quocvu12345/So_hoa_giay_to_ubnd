import type { Metadata } from "next";
import { Scissors } from "lucide-react";
import { NoAccess } from "@/components/ui/no-access";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Tách văn bản" };

export default async function SplitPage({ params }: PageProps<"/tiep-nhan/[documentId]/tach-van-ban">) {
  const { session, allowed } = await pageSession("document.edit");
  if (!allowed) return <NoAccess session={session} what="tách văn bản" />;
  const { documentId } = await params;
  return (
    <ScaffoldPage
      title="Tách thành nhiều văn bản"
      description="Một tệp quét chứa nhiều văn bản (đơn, biên bản, quyết định, phụ lục): chia theo dải trang, gán loại cho từng phần."
      breadcrumbs={[{ label: "Tiếp nhận PDF", href: routes.intake }, { label: "Đối chiếu", href: routes.intakeReview(documentId) }, { label: "Tách văn bản" }]}
      icon={Scissors}
      emptyTitle="Dải ảnh thu nhỏ các trang sẽ hiện ở đây"
      emptyText="Bấm vào khoảng giữa hai trang để đặt điểm tách. AI có thể đã gợi ý sẵn điểm tách khi phát hiện nhiều văn bản."
      task="FE-25 (API: BE-51, BE-52)"
      plan={[
        "Ảnh thu nhỏ từ /api/v1/files/{id}/pages/{n}/preview",
        "Kéo điểm tách; dải trang không được chồng hoặc hở",
        "Gán loại giấy tờ, đánh dấu phụ lục đi kèm văn bản chính",
        "Hoàn tác trước khi xác nhận; xác nhận tạo các văn bản con",
      ]}
    />
  );
}
