import type { Metadata } from "next";
import Link from "next/link";
import { NeedsRealApi, PageBody } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "@/config/routes";
import { getLoans } from "@/features/loan/loan-data";
import { LoanList, RequestLoanButton } from "@/features/loan/loan-panels";
import { filterLoans, LOAN_FILTERS, parseLoanFilter, todayVietnam } from "@/features/loan/loan-rules";
import { pageSession } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Mượn trả" };

/**
 * Mượn trả bản giấy (FE-36, BE-83): đề nghị → duyệt → giao → nhận trả (hoặc từ chối). Người mượn thấy khoản của mình; người duyệt (văn thư) thấy của cả cơ quan.
 * Một hồ sơ chỉ có một khoản mượn hiệu lực. Quá hạn trả được đánh dấu mỗi ngày. Bộ lọc trạng thái nằm trên URL (`?trang-thai=`).
 */
export default async function LoansPage({ searchParams }: PageProps<"/muon-tra">) {
  const { session, allowed } = await pageSession(["loan.request", "loan.approve"]);
  if (!allowed) return <NoAccess session={session} what="xem mượn trả" />;
  const filter = parseLoanFilter((await searchParams)["trang-thai"]);
  const real = !serverEnv().mock;
  const loans = real ? filterLoans(await getLoans(), filter) : [];
  const today = todayVietnam();

  return (
    <>
      <PageHeader title="Mượn trả" description="Mượn bản giấy của hồ sơ: đề nghị, duyệt, giao, nhận trả. Một hồ sơ chỉ cho một người mượn tại một thời điểm."
        breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Mượn trả" }]}
        actions={real && can(session, "loan.request") ? <RequestLoanButton today={today} /> : undefined} />
      <PageBody>
        {!real ? <NeedsRealApi what="Mượn trả" /> : (
          <>
            <nav aria-label="Lọc khoản mượn" className="flex flex-wrap gap-2 text-sm">
              {LOAN_FILTERS.map((f) => (
                <Link key={f.value} href={(f.value === "dang-xu-ly" ? routes.loans : `${routes.loans}?trang-thai=${f.value}`) as "/muon-tra"} aria-current={f.value === filter ? "page" : undefined}
                  className={cn("border px-3 py-1.5", f.value === filter ? "border-primary bg-primary text-white" : "border-line-strong hover:border-primary")}>{f.label}</Link>
              ))}
            </nav>
            <LoanList loans={loans} canApprove={can(session, "loan.approve")} today={today} />
          </>
        )}
      </PageBody>
    </>
  );
}
