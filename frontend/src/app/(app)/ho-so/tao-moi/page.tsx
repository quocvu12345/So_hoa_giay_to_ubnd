import type { Metadata } from "next";
import { NeedsRealApi, PageBody } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "@/config/routes";
import { creatableGroups } from "@/features/dossier/creatable-groups";
import { getDepartments } from "@/features/dossier/dossier-data";
import { DossierForm } from "@/features/dossier/dossier-form";
import { getWorkGroups } from "@/features/review/review-data";
import { pageSession } from "@/lib/auth/page-guard";
import { serverEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Tạo hồ sơ" };

/** Tạo hồ sơ (FE-27): tên → nhóm hồ sơ (gom theo đầu mối, chỉ nhóm được phép tạo) → mức tiếp cận, hạn, ghi chú. Mã do hệ thống cấp. */
export default async function NewDossierPage() {
  const { session, allowed } = await pageSession("dossier.prepare");
  if (!allowed) return <NoAccess session={session} what="tạo hồ sơ" />;
  const organization = session.activeAssignment.organizationCode;
  const real = !serverEnv().mock;
  const [groups, departments] = real ? await Promise.all([getWorkGroups(organization), getDepartments(organization)]) : [[], []];
  const names = new Map(departments.map((d) => [d.code, d.name]));
  const choices = creatableGroups(groups, session.activeAssignment).map((g) => ({ code: g.code, title: g.title, departmentCode: g.departmentCode, departmentName: names.get(g.departmentCode) ?? g.departmentCode }));

  return (
    <>
      <PageHeader
        title="Tạo hồ sơ"
        description="Một hồ sơ gắn với một công việc cụ thể. Chọn nhóm hồ sơ thuộc đơn vị của bạn; mã hồ sơ do hệ thống cấp."
        breadcrumbs={[{ label: "Hồ sơ", href: routes.dossiers }, { label: "Tạo hồ sơ" }]}
      />
      <PageBody>{real ? <DossierForm mode="create" groups={choices} /> : <NeedsRealApi what="Tạo hồ sơ" />}</PageBody>
    </>
  );
}
