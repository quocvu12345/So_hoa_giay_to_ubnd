import type { Metadata } from "next";
import { PageBody } from "@/components/ui/blocks";
import { acceptsDocuments, getChecklist, getDossier } from "@/features/dossier/dossier-data";
import { DocumentList } from "@/features/dossier/document-list";
import { ExtractNowButton } from "@/features/intake/extract-now-button";
import { pageSession } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { loadOrNotFound } from "@/lib/load-or-not-found";

export const metadata: Metadata = { title: "Giấy tờ trong hồ sơ" };

/** Tab Giấy tờ (FE-29): thứ tự, chiều đến/đi/nội bộ, đối chiếu, gỡ, thêm từ hộp tiếp nhận; "Trích xuất ngay" cả hồ sơ (FE-45). */
export default async function DossierDocuments({ params }: PageProps<"/ho-so/[id]/giay-to">) {
  const { session } = await pageSession("dossier.read");
  if (serverEnv().mock) return null;
  const { id } = await params;
  const dossier = await loadOrNotFound(() => getDossier(id));
  const canPrepare = can(session, "dossier.prepare");
  const editable = canPrepare && acceptsDocuments(dossier.status);
  // Hồ sơ làm theo thủ tục: các thành phần để gán giấy tờ vào (FE-29). Không tải được thì chỉ mất cột này, không làm hỏng tab.
  const checklist = dossier.procedureId ? await getChecklist(id).catch(() => null) : null;
  const components = (checklist?.components ?? []).map((c) => ({ id: c.componentId, name: c.name, required: c.required }));

  return (
    <PageBody>
      {canPrepare && dossier.documents.length > 0 && (
        <div className="flex flex-wrap items-start justify-between gap-3 border border-line bg-surface p-3">
          <p className="max-w-prose text-[13px] text-muted">
            Giấy tờ chưa được AI đọc đang chờ trong khay. Cần dữ liệu ngay cho hồ sơ này thì đưa cả hồ sơ lên đầu hàng đợi; giấy tờ đã đọc xong được giữ nguyên.
          </p>
          <ExtractNowButton scope="dossier" id={id} variant="primary" size="md" />
        </div>
      )}
      <DocumentList dossierId={id} documents={dossier.documents} editable={editable} components={components} />
    </PageBody>
  );
}
