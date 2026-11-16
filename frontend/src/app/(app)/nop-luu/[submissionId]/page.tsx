import type { Metadata } from "next";
import { NoAccess } from "@/components/ui/no-access";
import { ScaffoldPage } from "@/components/ui/scaffold-page";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Đợt nộp lưu" };

export default async function SubmissionPage({ params }: PageProps<"/nop-luu/[submissionId]">) {
  const { session, allowed } = await pageSession("dossier.archive");
  if (!allowed) return <NoAccess session={session} what="xem đợt nộp lưu" />;
  const { submissionId } = await params;
  return (
    <ScaffoldPage
      title="Đợt nộp lưu"
      description="Danh sách hồ sơ trong đợt, kết quả kiểm tra từng hồ sơ, biên bản."
      breadcrumbs={[{ label: "Nộp lưu", href: routes.archive }, { label: submissionId }]}
      emptyTitle="Hồ sơ trong đợt"
      emptyText="Mỗi dòng: mã hồ sơ, số trang, vị trí bản giấy, kết quả kiểm tra (đạt / cần sửa kèm lý do)."
      task="FE-37 (API: BE-84, BE-85)"
      plan={["Tiếp nhận cả đợt hoặc trả lại kèm danh sách lỗi", "Biên bản có mã đợt, người nộp, người nhận"]}
    />
  );
}
