import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { FolderInput, Upload } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { NeedsRealApi, PageBody } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "@/config/routes";
import { getInbox, INBOX_TABS, inboxTab } from "@/features/intake/inbox-data";
import { InboxTable } from "@/features/intake/inbox-table";
import { pageSession } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { serverEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Tiếp nhận PDF" };

/** Hộp tiếp nhận: mọi PDF đã nạp, trạng thái đọc của AI và việc tiếp theo cho từng tệp (FE-21, FE-45). */
export default async function IntakePage({ searchParams }: PageProps<"/tiep-nhan">) {
  const { session, allowed } = await pageSession("intake.upload");
  if (!allowed) return <NoAccess session={session} what="tiếp nhận PDF" />;
  const tab = inboxTab((await searchParams)["trang-thai"]);
  const canUpload = can(session, "intake.upload");
  const page = serverEnv().mock ? null : await getInbox(tab.status);

  return (
    <>
      <PageHeader
        title="Tiếp nhận PDF"
        description="Nạp bản quét, AI đọc và gợi ý; bạn đối chiếu rồi xếp vào hồ sơ. PDF mới nạp vào khay chờ, AI đọc khi rảnh. Cần ngay thì bấm Trích xuất ngay để đưa lên đầu hàng."
        breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Tiếp nhận PDF" }]}
        actions={
          <>
            <ButtonLink href={routes.intakeBatches}>
              <FolderInput aria-hidden className="size-4" /> Lô quét
            </ButtonLink>
            {canUpload && (
              <ButtonLink href={routes.intakeUpload} variant="primary">
                <Upload aria-hidden className="size-4" /> Nạp PDF
              </ButtonLink>
            )}
          </>
        }
      />
      <nav aria-label="Lọc theo trạng thái" className="flex gap-1 border-b border-line bg-surface px-4 sm:px-6">
        {INBOX_TABS.map((t) => (
          <Link
            key={t.key}
            href={`${routes.intake}?trang-thai=${t.key}` as Route}
            aria-current={tab.key === t.key ? "page" : undefined}
            className={cn("border-b-[3px] px-3 py-2.5 text-sm font-semibold", tab.key === t.key ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <PageBody>
        {page ? (
          // key theo thẻ: đổi thẻ là đổi bộ lọc, bắt đầu lại từ trang đầu và bỏ cursor cũ.
          <InboxTable key={tab.key} status={tab.status} items={page.items} nextCursor={page.nextCursor} canExtract={can(session, ["intake.upload", "dossier.prepare"])} />
        ) : (
          <NeedsRealApi what="Hộp tiếp nhận" />
        )}
      </PageBody>
    </>
  );
}
