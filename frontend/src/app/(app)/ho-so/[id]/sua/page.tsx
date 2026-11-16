import type { Metadata } from "next";
import { NoAccess } from "@/components/ui/no-access";
import { EmptyState, PageBody, PlannedScreen } from "@/components/ui/blocks";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Sửa thông tin hồ sơ" };

export default async function EditDossier() {
  const { session, allowed } = await pageSession("dossier.prepare");
  if (!allowed) return <NoAccess session={session} what="sửa hồ sơ" />;
  return (
    <PageBody>
      <EmptyState title="Sửa thông tin hồ sơ">Cùng biểu mẫu với Tạo hồ sơ, điền sẵn giá trị hiện tại. Đổi nhóm hồ sơ không xóa giấy tờ đã gắn.</EmptyState>
      <PlannedScreen task="FE-27 (API: BE-61)" items={["Gửi kèm phiên bản (row_version); người khác vừa sửa thì báo và cho tải lại", "Đổi nhóm: liệt kê giấy tờ cần đối chiếu lại trước khi lưu"]} />
    </PageBody>
  );
}
