import type { Metadata } from "next";
import Link from "next/link";
import { NeedsRealApi, PageBody, Section } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "@/config/routes";
import { getDisposals, getEligible } from "@/features/disposal/disposal-data";
import { DisposalList, EligibleList } from "@/features/disposal/disposal-panels";
import { DISPOSAL_FILTERS, filterDisposals, parseDisposalFilter } from "@/features/disposal/disposal-rules";
import { pageSession } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Đề nghị hủy" };

/**
 * Đề nghị hủy (FE-39, BE-87): đề nghị → phê duyệt kèm văn bản quyết định (người khác) → thực hiện (xác nhận hai bước trong trang). Chỉ hồ sơ đã lưu trữ,
 * có quy tắc bảo quản đã xác nhận và đã đủ năm. Thực hiện xóa nội dung tệp, giữ thông tin và nhật ký; "đang thực hiện" không gửi lại.
 */
export default async function DisposalsPage({ searchParams }: PageProps<"/de-nghi-huy">) {
  const { session, allowed } = await pageSession(["disposal.request", "disposal.approve"]);
  if (!allowed) return <NoAccess session={session} what="xem đề nghị hủy" />;
  const filter = parseDisposalFilter((await searchParams)["trang-thai"]);
  const canRequest = can(session, "disposal.request");
  const canApprove = can(session, "disposal.approve");
  const real = !serverEnv().mock;
  const [all, eligible] = real ? await Promise.all([getDisposals(), canRequest ? getEligible() : Promise.resolve([])]) : [[], []];
  const shown = filterDisposals(all, filter);

  return (
    <>
      <PageHeader title="Đề nghị hủy" description="Hủy tài liệu hết thời hạn bảo quản: đề nghị, phê duyệt kèm văn bản quyết định, thực hiện. Đây là đường duy nhất xóa nội dung tệp." breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Đề nghị hủy" }]} />
      <PageBody>
        {!real ? <NeedsRealApi what="Đề nghị hủy" /> : (
          <>
            {canRequest && <Section title={`Hồ sơ đủ điều kiện hủy (${eligible.length})`} description="Đã lưu trữ, thời hạn bảo quản đã được xác nhận và đã đủ năm, chưa có đề nghị hủy."><EligibleList dossiers={eligible} /></Section>}
            <Section title="Các đề nghị hủy">
              <nav aria-label="Lọc đề nghị" className="flex flex-wrap gap-2 text-sm">
                {DISPOSAL_FILTERS.map((f) => (
                  <Link key={f.value} href={(f.value === "dang-cho" ? routes.disposals : `${routes.disposals}?trang-thai=${f.value}`) as "/de-nghi-huy"} aria-current={f.value === filter ? "page" : undefined}
                    className={cn("border px-3 py-1.5", f.value === filter ? "border-primary bg-primary text-white" : "border-line-strong hover:border-primary")}>{f.label}</Link>
                ))}
              </nav>
              <DisposalList items={shown} canRequest={canRequest} canApprove={canApprove} myName={session.user.displayName} />
            </Section>
          </>
        )}
      </PageBody>
    </>
  );
}
