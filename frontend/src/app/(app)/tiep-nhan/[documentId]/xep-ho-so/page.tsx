import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FolderPlus } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageBody, PlannedScreen, Section } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { WorkflowChip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { pageSession } from "@/lib/auth/page-guard";
import { MOCK_DOSSIERS, MOCK_INBOX } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Xếp vào hồ sơ" };

/** Bước 3: chọn hồ sơ được gợi ý hoặc tạo mới tại chỗ; lưu xong mở luôn PDF tiếp theo. */
export default async function FilePage({ params }: PageProps<"/tiep-nhan/[documentId]/xep-ho-so">) {
  const { session, allowed } = await pageSession("dossier.prepare");
  if (!allowed) return <NoAccess session={session} what="xếp giấy tờ vào hồ sơ" />;
  const { documentId } = await params;
  const item = MOCK_INBOX.find((i) => i.id === documentId);
  if (!item) notFound();
  const suggestions = MOCK_DOSSIERS.filter((d) => d.status === "draft" || d.status === "returned");

  return (
    <>
      <div className="border-b border-line bg-surface px-4 py-3 sm:px-6">
        <h1 className="text-xl font-bold">Xếp “{item.fileName}” vào hồ sơ</h1>
        <p className="text-[13px] text-muted">Gợi ý: hồ sơ cùng nhóm, đang chuẩn bị, trong phạm vi của bạn.</p>
      </div>
      <PageBody>
        <Section title="Hồ sơ gợi ý">
          <fieldset className="grid gap-2">
            <legend className="sr-only">Chọn hồ sơ</legend>
            {suggestions.map((d, i) => (
              <label key={d.id} className="flex cursor-pointer flex-wrap items-center gap-3 border border-line p-3 has-checked:border-primary has-checked:bg-accent-soft">
                <input type="radio" name="dossier" value={d.id} defaultChecked={i === 0} className="accent-primary" />
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-mono text-xs text-muted">{d.code} · {d.workGroup}</span>
                  <span className="font-semibold">{d.title}</span>
                </span>
                <WorkflowChip state={d.status} />
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              Chiều luân chuyển
              <select className="h-9 border border-line-strong bg-surface px-2" defaultValue="incoming">
                <option value="incoming">Đến</option>
                <option value="outgoing">Đi</option>
                <option value="internal">Nội bộ</option>
              </select>
            </label>
            <ButtonLink size="sm" href={routes.dossierNew}>
              <FolderPlus aria-hidden className="size-4" /> Tạo hồ sơ mới
            </ButtonLink>
          </div>
        </Section>
        <div className="flex flex-wrap justify-end gap-2">
          <ButtonLink href={routes.intakeReview(documentId)}>← Quay lại đối chiếu</ButtonLink>
          <Button disabled>Lưu</Button>
          <Button variant="primary" disabled>Lưu và mở PDF tiếp theo</Button>
        </div>
        <PlannedScreen
          task="FE-24 (API: BE-62, BE-63)"
          items={[
            "Gợi ý từ GET /api/v1/dossiers/suggestions?documentId=…; ô tìm hồ sơ khác theo mã/tên",
            "Tạo hồ sơ mới trong hộp thoại, không rời luồng tiếp nhận",
            "Gắn với thành phần hồ sơ thủ tục (nếu hồ sơ có thủ tục)",
            "“Lưu và mở PDF tiếp theo” chuyển thẳng tới PDF kế tiếp đã đọc xong",
          ]}
        />
      </PageBody>
    </>
  );
}
