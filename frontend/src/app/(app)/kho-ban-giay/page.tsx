import type { Metadata } from "next";
import { Boxes } from "lucide-react";
import { NoAccess } from "@/components/ui/no-access";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Kho bản giấy" };

export default async function StoragePage() {
  const { session, allowed } = await pageSession("storage.manage");
  if (!allowed) return <NoAccess session={session} what="quản lý kho bản giấy" />;
  return (
    <ScaffoldPage
      title="Kho bản giấy"
      description="Cây vị trí kho → phòng → tủ → kệ → hộp. Quét mã QR trên hộp để mở ngay."
      breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Kho bản giấy" }]}
      icon={Boxes}
      emptyTitle="Chưa có vị trí kho"
      emptyText="Tạo kho và các cấp bên trong, in nhãn QR dán lên hộp. Đầu đọc mã vạch gõ như bàn phím: đặt con trỏ vào ô tìm và quét."
      task="FE-36 (API: BE-81, BE-82)"
      plan={["Cây vị trí bên trái, hồ sơ trong vị trí bên phải", "In nhãn QR hàng loạt (PDF A4)", "Chuyển vị trí hồ sơ, có lịch sử"]}
    />
  );
}
