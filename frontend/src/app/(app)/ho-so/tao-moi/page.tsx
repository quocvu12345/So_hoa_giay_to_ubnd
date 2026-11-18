import type { Metadata } from "next";
import { NeedsRealApi, PageBody } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "@/config/routes";
import { creatableGroups } from "@/features/dossier/creatable-groups";
import { getDepartments } from "@/features/dossier/dossier-data";
import { DossierForm } from "@/features/dossier/dossier-form";
import { getProcedure } from "@/features/procedure/procedure-data";
import { isProcedureId, isRetired } from "@/features/procedure/procedure-filter";
import { getWorkGroups } from "@/features/review/review-data";
import { pageSession } from "@/lib/auth/page-guard";
import { serverEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Tạo hồ sơ" };

/** Tạo hồ sơ (FE-27): tên → nhóm hồ sơ (gom theo đầu mối, chỉ nhóm được phép tạo) → thủ tục (tùy chọn) → mức tiếp cận, hạn, ghi chú. Mã do hệ thống cấp. */
export default async function NewDossierPage({ searchParams }: PageProps<"/ho-so/tao-moi">) {
  const { session, allowed } = await pageSession("dossier.prepare");
  if (!allowed) return <NoAccess session={session} what="tạo hồ sơ" />;
  const organization = session.activeAssignment.organizationCode;
  const real = !serverEnv().mock;
  const [groups, departments] = real ? await Promise.all([getWorkGroups(organization), getDepartments(organization)]) : [[], []];
  // "Tạo hồ sơ theo thủ tục này" (FE-35): ?thu-tuc=<mã>. Thủ tục không có, sai mã hoặc đã bãi bỏ/thay thế thì bỏ qua và nói rõ.
  const wanted = (await searchParams)["thu-tuc"];
  const procedure = real && typeof wanted === "string" && isProcedureId(wanted) ? await getProcedure(wanted).catch(() => null) : null;
  const usable = procedure && !isRetired(procedure.lifecycleStatus) ? procedure : null;
  const names = new Map(departments.map((d) => [d.code, d.name]));
  const choices = creatableGroups(groups, session.activeAssignment).map((g) => ({ code: g.code, title: g.title, departmentCode: g.departmentCode, departmentName: names.get(g.departmentCode) ?? g.departmentCode }));

  return (
    <>
      <PageHeader
        title="Tạo hồ sơ"
        description="Một hồ sơ gắn với một công việc cụ thể. Chọn nhóm hồ sơ thuộc đơn vị của bạn; mã hồ sơ do hệ thống cấp."
        breadcrumbs={[{ label: "Hồ sơ", href: routes.dossiers }, { label: "Tạo hồ sơ" }]}
      />
      <PageBody>
        {typeof wanted === "string" && real && !usable && (
          <p role="status" className="border border-warn bg-warn-soft p-3 text-sm text-warn">
            {procedure ? "Thủ tục này đã bãi bỏ hoặc được thay thế nên không dùng để tạo hồ sơ mới." : "Không tìm thấy thủ tục đã chọn."} Bạn vẫn tạo được hồ sơ thường bên dưới.
          </p>
        )}
        {real ? <DossierForm mode="create" groups={choices} procedure={usable ? { id: usable.id, name: usable.name, code: usable.procedureCode ?? null, components: [...usable.components].sort((x, y) => x.position - y.position).map((c) => ({ id: c.id, section: c.section, name: c.name, required: c.requiredAsPublished })) } : undefined} /> : <NeedsRealApi what="Tạo hồ sơ" />}
      </PageBody>
    </>
  );
}
