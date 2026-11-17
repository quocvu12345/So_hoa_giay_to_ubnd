import type { Metadata } from "next";
import { NeedsRealApi, PageBody } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "@/config/routes";
import { Uploader, type BatchOption } from "@/features/intake/uploader";
import { ok, serverApi } from "@/lib/api/server";
import { pageSession } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Nạp PDF" };

/** Chỉ cho chọn lô đang mở: API từ chối nạp vào lô đã đóng. */
async function openBatches(): Promise<BatchOption[]> {
  const batches = ok(await serverApi().GET("/api/v1/intake/batches"));
  return batches
    .filter((b) => b.status !== "closed")
    .map((b) => ({ id: b.id, code: b.code, label: [b.code, b.boxLabel].filter(Boolean).join(" · ") }));
}

/** Bước 1 của tiếp nhận: kéo thả nhiều PDF, chọn lô quét, theo dõi tải lên và hàng đợi đọc. */
export default async function UploadPage() {
  const { session, allowed } = await pageSession("intake.upload");
  if (!allowed) return <NoAccess session={session} what="nạp PDF" />;
  const batches = serverEnv().mock ? null : can(session, ["intake.manage", "intake.upload"]) ? await openBatches() : [];
  return (
    <>
      <PageHeader
        title="Nạp PDF"
        description="Bước 1 / 3. Kéo thả tệp, AI sẽ tự đọc lần lượt. Bạn không cần chờ: mở Hộp tiếp nhận để làm tiếp tệp đã đọc xong."
        breadcrumbs={[{ label: "Tiếp nhận PDF", href: routes.intake }, { label: "Nạp PDF" }]}
      />
      <PageBody>{batches ? <Uploader batches={batches} /> : <NeedsRealApi what="Nạp PDF" />}</PageBody>
    </>
  );
}
