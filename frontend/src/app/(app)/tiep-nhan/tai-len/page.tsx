import type { Metadata } from "next";
import { UploadCloud } from "lucide-react";
import { PageBody, PlannedScreen } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Nạp PDF" };

/** Bước 1 của tiếp nhận: kéo thả nhiều PDF, chọn lô quét, theo dõi tải lên và hàng đợi đọc. */
export default async function UploadPage() {
  const { session, allowed } = await pageSession("intake.upload");
  if (!allowed) return <NoAccess session={session} what="nạp PDF" />;
  return (
    <>
      <PageHeader
        title="Nạp PDF"
        description="Bước 1 / 3. Kéo thả tệp, AI sẽ tự đọc lần lượt. Bạn không cần chờ: mở Hộp tiếp nhận để làm tiếp tệp đã đọc xong."
        breadcrumbs={[{ label: "Tiếp nhận PDF", href: routes.intake }, { label: "Nạp PDF" }]}
      />
      <PageBody>
        <label htmlFor="pdf-files" className="grid cursor-pointer justify-items-center gap-2 border-2 border-dashed border-line-strong bg-surface px-6 py-14 text-center hover:border-primary hover:bg-soft">
          <UploadCloud aria-hidden className="size-10 text-primary" />
          <span className="text-lg font-bold text-heading">Kéo thả PDF vào đây hoặc bấm để chọn</span>
          <span className="text-sm text-muted">Nhiều tệp một lúc · tối đa 200 MB mỗi tệp · chỉ nhận PDF</span>
          <input id="pdf-files" type="file" accept="application/pdf" multiple className="sr-only" disabled />
        </label>
        <PlannedScreen
          task="FE-21 (API: BE-41, BE-40)"
          items={[
            "Chọn lô quét (tùy chọn) trước khi nạp; ghi nhớ lô vừa dùng",
            "Tải lên trực tiếp POST /api/v1/intake/files (3 tệp song song), thanh tiến độ từng tệp, hủy được",
            "Tệp trùng (409 duplicate_file): hiện liên kết tới giấy tờ đã có thay vì báo lỗi",
            "Tệp không phải PDF hoặc quá lớn: báo ngay tại tệp đó, các tệp khác vẫn chạy",
          ]}
        />
      </PageBody>
    </>
  );
}
