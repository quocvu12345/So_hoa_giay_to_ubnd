import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { EmptyState, PageBody, PlannedScreen } from "@/components/ui/blocks";
import { ButtonLink } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";
import { ExtractNowButton } from "@/features/intake/extract-now-button";

export const metadata: Metadata = { title: "Giấy tờ trong hồ sơ" };

export default async function DossierDocuments({ params }: PageProps<"/ho-so/[id]/giay-to">) {
  const { id } = await params;
  const { allowed } = await pageSession(["dossier.prepare"]);
  return (
    <PageBody>
      {allowed && (
        <div className="flex flex-wrap items-start justify-between gap-3 border border-line bg-surface p-3">
          <p className="max-w-prose text-[13px] text-muted">
            Giấy tờ chưa được AI đọc đang chờ trong khay. Cần dữ liệu ngay cho hồ sơ này thì đưa cả hồ sơ lên đầu hàng đợi; giấy tờ đã đọc xong được giữ nguyên.
          </p>
          <ExtractNowButton scope="dossier" id={id} variant="primary" size="md" />
        </div>
      )}
      <EmptyState icon={FileText} title="Danh sách giấy tờ theo thứ tự trong hồ sơ" action={<ButtonLink href={routes.intake}>Thêm từ hộp tiếp nhận</ButtonLink>}>
        Mỗi dòng: thứ tự, tên, loại, chiều đến/đi/nội bộ, số trang, trạng thái đối chiếu. Kéo để sắp xếp khi hồ sơ đang chuẩn bị.
      </EmptyState>
      <PlannedScreen task="FE-29 (API: BE-62)" items={["Kéo thả sắp xếp, gỡ giấy tờ (chỉ ở bước Đang chuẩn bị / Yêu cầu bổ sung)", "Thêm từ hộp tiếp nhận hoặc giấy tờ có sẵn", "Bấm tên giấy tờ → trang Chi tiết giấy tờ"]} />
    </PageBody>
  );
}
