import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { EmptyState, PageBody, PlannedScreen } from "@/components/ui/blocks";
import { ButtonLink } from "@/components/ui/button";
import { routes } from "@/config/routes";

export const metadata: Metadata = { title: "Giấy tờ trong hồ sơ" };

export default function DossierDocuments() {
  return (
    <PageBody>
      <EmptyState icon={FileText} title="Danh sách giấy tờ theo thứ tự trong hồ sơ" action={<ButtonLink href={routes.intake}>Thêm từ hộp tiếp nhận</ButtonLink>}>
        Mỗi dòng: thứ tự, tên, loại, chiều đến/đi/nội bộ, số trang, trạng thái đối chiếu. Kéo để sắp xếp khi hồ sơ đang chuẩn bị.
      </EmptyState>
      <PlannedScreen task="FE-29 (API: BE-62)" items={["Kéo thả sắp xếp, gỡ giấy tờ (chỉ ở bước Đang chuẩn bị / Yêu cầu bổ sung)", "Thêm từ hộp tiếp nhận hoặc giấy tờ có sẵn", "Bấm tên giấy tờ → trang Chi tiết giấy tờ"]} />
    </PageBody>
  );
}
