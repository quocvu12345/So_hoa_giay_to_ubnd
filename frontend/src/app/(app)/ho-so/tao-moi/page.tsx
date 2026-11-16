import type { Metadata } from "next";
import { NoAccess } from "@/components/ui/no-access";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Tạo hồ sơ" };

export default async function NewDossierPage() {
  const { session, allowed } = await pageSession("dossier.prepare");
  if (!allowed) return <NoAccess session={session} what="tạo hồ sơ" />;
  return (
    <ScaffoldPage
      title="Tạo hồ sơ"
      description="Chọn theo thứ tự: cơ quan → phòng/Ban phụ trách → nhóm hồ sơ. Mã hồ sơ do hệ thống cấp."
      breadcrumbs={[{ label: "Hồ sơ", href: routes.dossiers }, { label: "Tạo hồ sơ" }]}
      emptyTitle="Biểu mẫu tạo hồ sơ"
      emptyText="Tiêu đề thể hiện vụ việc, kỳ họp hoặc dự án; năm; nhóm hồ sơ; thủ tục hành chính (nếu có); hạn nội bộ; mức tiếp cận; vị trí bản giấy."
      task="FE-27 (API: BE-61, BE-31, BE-33)"
      plan={[
        "Ô chọn liên kết: chỉ hiện nhóm hồ sơ thuộc đầu mối đã chọn",
        "Gợi ý thành phần hồ sơ ngay khi chọn nhóm hoặc thủ tục",
        "Kiểm tra ngay khi nhập; lỗi hiện dưới đúng ô",
        "Tạo xong mở trang hồ sơ, tab Giấy tờ",
      ]}
    />
  );
}
