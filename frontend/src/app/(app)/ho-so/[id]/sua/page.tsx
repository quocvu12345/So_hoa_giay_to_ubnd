import type { Metadata } from "next";
import { NoAccess } from "@/components/ui/no-access";
import { PageBody } from "@/components/ui/blocks";
import { acceptsDocuments, getDossier, UUID } from "@/features/dossier/dossier-data";
import { DossierForm } from "@/features/dossier/dossier-form";
import { pageSession } from "@/lib/auth/page-guard";
import { serverEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { loadOrNotFound } from "@/lib/load-or-not-found";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Sửa thông tin hồ sơ" };

/** Sửa thông tin hồ sơ (FE-27): cùng biểu mẫu với Tạo hồ sơ, điền sẵn giá trị hiện tại, gửi kèm phiên bản. */
export default async function EditDossier({ params }: PageProps<"/ho-so/[id]/sua">) {
  const { session, allowed } = await pageSession("dossier.prepare");
  if (!allowed) return <NoAccess session={session} what="sửa hồ sơ" />;
  if (serverEnv().mock) return null;
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const dossier = await loadOrNotFound(() => getDossier(id));

  if (!acceptsDocuments(dossier.status)) {
    return (
      <PageBody>
        <p role="status" className="border border-warn bg-warn-soft p-3 text-sm text-warn">
          Hồ sơ đang ở bước “{dossier.statusLabel}” nên không sửa được. Chỉ sửa khi hồ sơ Đang chuẩn bị hoặc Yêu cầu bổ sung.
        </p>
      </PageBody>
    );
  }

  return (
    <PageBody>
      <DossierForm
        mode="edit"
        dossierId={id}
        version={dossier.version}
        groups={[]}
        groupLabel={`${dossier.workGroupCode} · ${dossier.workGroupTitle}`}
        initial={{
          title: dossier.title,
          workGroupCode: dossier.workGroupCode,
          accessLevel: dossier.accessLevel,
          internalDueOn: dossier.dueOn ? formatDate(dossier.dueOn) : "",
          notes: dossier.notes,
          year: String(dossier.year),
          creatorOrganizationName: dossier.creatorOrganizationName ?? "",
        }}
      />
    </PageBody>
  );
}
