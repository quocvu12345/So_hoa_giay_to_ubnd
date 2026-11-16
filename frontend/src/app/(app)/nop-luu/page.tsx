import type { Metadata } from "next";
import { Archive } from "lucide-react";
import { NoAccess } from "@/components/ui/no-access";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Nộp lưu" };

export default async function ArchivePage() {
  const { session, allowed } = await pageSession("dossier.archive");
  if (!allowed) return <NoAccess session={session} what="tiếp nhận nộp lưu" />;
  return (
    <ScaffoldPage
      title="Nộp lưu"
      description="Hồ sơ đã qua kiểm tra chờ văn thư tiếp nhận, và các đợt nộp lưu đã tạo."
      breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Nộp lưu" }]}
      icon={Archive}
      emptyTitle="Hàng chờ nộp lưu"
      emptyText="Hồ sơ ở trạng thái Chờ nộp lưu hiện ở đây. Chọn nhiều hồ sơ để tạo một đợt, kiểm tra thành phần và vị trí bản giấy rồi tiếp nhận."
      task="FE-37 (API: BE-84, BE-85)"
      plan={["Tab: Chờ tiếp nhận · Các đợt nộp lưu", "Tạo đợt từ các hồ sơ đã chọn; một hồ sơ lỗi thì cả đợt chưa tiếp nhận", "Tải biên bản nộp lưu (PDF) sau khi tiếp nhận"]}
    />
  );
}
