import type { Metadata } from "next";
import { Boxes } from "lucide-react";
import { NoAccess } from "@/components/ui/no-access";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Vị trí lưu" };

export default async function StorageLocationPage({ params }: PageProps<"/kho-ban-giay/[locationId]">) {
  const { session, allowed } = await pageSession("storage.manage");
  if (!allowed) return <NoAccess session={session} what="xem vị trí lưu" />;
  const { locationId } = await params;
  return (
    <ScaffoldPage
      title="Vị trí lưu"
      description="Hồ sơ đang nằm ở vị trí này và lịch sử di chuyển."
      breadcrumbs={[{ label: "Kho bản giấy", href: routes.storage }, { label: locationId }]}
      icon={Boxes}
      emptyTitle="Hồ sơ trong vị trí"
      emptyText="Danh sách hồ sơ, tình trạng mượn, nút chuyển vị trí."
      task="FE-36 (API: BE-81, BE-82)"
      plan={["Đường dẫn đầy đủ: Kho › Tủ › Kệ › Hộp", "In lại nhãn QR"]}
    />
  );
}
