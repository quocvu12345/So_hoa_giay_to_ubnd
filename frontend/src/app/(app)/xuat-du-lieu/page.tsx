import type { Metadata } from "next";
import { NeedsRealApi, PageBody, Section } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "@/config/routes";
import { getExports } from "@/features/export/export-data";
import { ExportForm } from "@/features/export/export-form";
import { ExportList } from "@/features/export/export-list";
import { getWorkGroups } from "@/features/review/review-data";
import { pageSession } from "@/lib/auth/page-guard";
import { serverEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Xuất dữ liệu" };

/**
 * Xuất dữ liệu (FE-38, BE-86): gói ZIP bàn giao gồm PDF, siêu dữ liệu và mã băm kiểm chứng; đóng nền, báo tiến độ trực tiếp, giữ 7 ngày.
 * Mỗi lần tải API kiểm lại quyền và phạm vi hồ sơ; mất phạm vi thì gói bị thu hồi.
 */
export default async function ExportsPage() {
  const { session, allowed } = await pageSession("export.create");
  if (!allowed) return <NoAccess session={session} what="xuất dữ liệu" />;
  const real = !serverEnv().mock;
  const [exports, groups] = real ? await Promise.all([getExports(), getWorkGroups(session.activeAssignment.organizationCode)]) : [[], []];

  return (
    <>
      <PageHeader title="Xuất dữ liệu" description="Gói bàn giao hồ sơ: PDF, siêu dữ liệu và mã băm để kiểm chứng. Gói giữ 7 ngày và chỉ người tạo tải được." breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Xuất dữ liệu" }]} />
      <PageBody>
        {!real ? <NeedsRealApi what="Xuất dữ liệu" /> : (
          <>
            <Section title="Tạo gói xuất"><ExportForm groups={groups.map((g) => ({ code: g.code, title: g.title }))} /></Section>
            <Section title="Gói xuất gần đây" description="Tối đa 20 gói gần nhất của bạn."><ExportList initial={exports} now={new Date().toISOString()} /></Section>
          </>
        )}
      </PageBody>
    </>
  );
}
