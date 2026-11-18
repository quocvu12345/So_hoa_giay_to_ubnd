import type { Metadata } from "next";
import Link from "next/link";
import { NeedsRealApi, PageBody, Section } from "@/components/ui/blocks";
import { ButtonLink } from "@/components/ui/button";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { Chip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { UUID } from "@/features/dossier/dossier-data";
import { getBatch, getQuality } from "@/features/intake/batch-data";
import { BATCH_STATUS, canAcceptFiles, JOB_STATUS, sheetHint } from "@/features/intake/batch-rules";
import { CloseBatchButton } from "@/features/intake/close-batch-button";
import { QualityPanel } from "@/features/intake/quality-panel";
import { pageSession } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { loadOrNotFound } from "@/lib/load-or-not-found";
import { notFound } from "next/navigation";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Chi tiết lô quét" };

/**
 * Chi tiết lô quét (FE-41): thông tin lô, tệp trong lô và tình trạng đọc, lỗi ảnh theo trang, trang AI nghi ngờ.
 * Đóng lô còn lỗi mở thì cảnh báo nhưng vẫn cho đóng khi ghi lý do chấp nhận bỏ qua (BE-125).
 */
export default async function BatchPage({ params }: PageProps<"/tiep-nhan/lo-quet/[batchId]">) {
  const { session, allowed } = await pageSession(["intake.manage", "intake.upload"]);
  if (!allowed) return <NoAccess session={session} what="xem lô quét" />;
  const { batchId } = await params;
  if (!UUID.test(batchId)) notFound();
  if (serverEnv().mock) return <><PageHeader title="Chi tiết lô quét" breadcrumbs={[{ label: "Tiếp nhận PDF", href: routes.intake }, { label: "Lô quét", href: routes.intakeBatches }]} /><PageBody><NeedsRealApi what="Lô quét" /></PageBody></>;

  const detail = await loadOrNotFound(() => getBatch(batchId));
  const { batch, files } = detail;
  const quality = await getQuality(batchId);
  const closed = batch.status === "closed";
  const hint = sheetHint(batch.expectedSheetCount ?? null, Number(batch.scannedPageCount));
  const openIssues = quality.issues.filter((i) => i.status === "open").length;
  const canManage = can(session, "intake.manage");

  return (
    <>
      <PageHeader
        title={`Lô ${batch.code}`}
        description={[batch.handedOverBy, batch.boxLabel].filter(Boolean).join(" · ") || "Chưa ghi đơn vị giao"}
        breadcrumbs={[{ label: "Tiếp nhận PDF", href: routes.intake }, { label: "Lô quét", href: routes.intakeBatches }, { label: batch.code }]}
        meta={<Chip tone={closed ? "neutral" : "info"}>{BATCH_STATUS[batch.status] ?? batch.status}</Chip>}
        actions={
          <>
            {canAcceptFiles(batch.status) && can(session, "intake.upload") && <ButtonLink href={`${routes.intakeUpload}?lo=${batch.id}` as "/tiep-nhan/tai-len"}>Nạp PDF vào lô</ButtonLink>}
            {canManage && !closed && <CloseBatchButton batchId={batch.id} openIssues={openIssues} />}
          </>
        }
      />
      <PageBody>
        <Section title="Thông tin lô">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-xs text-muted">Mở lúc</dt><dd>{formatDateTime(batch.openedAt)}</dd></div>
            <div><dt className="text-xs text-muted">Đóng lúc</dt><dd>{closed ? formatDateTime(batch.closedAt) : "Chưa đóng"}</dd></div>
            <div><dt className="text-xs text-muted">Số tờ dự kiến</dt><dd>{batch.expectedSheetCount ?? "Không ghi"}</dd></div>
            <div><dt className="text-xs text-muted">Số tệp</dt><dd>{batch.fileCount}</dd></div>
          </dl>
          <p className={cn("text-sm", hint.tone === "warn" ? "text-warn" : "text-muted")}>{closed ? "Đã chốt: " : "Hiện có: "}{hint.text}{closed ? "" : ". Số trang được chốt khi đóng lô."}</p>
          {closed && <p role="status" className="text-sm text-muted">Lô đã đóng: không nạp thêm tệp, không ghi thêm lỗi. Cần quét lại thì dùng &ldquo;Thay bản quét&rdquo; ở từng giấy tờ.</p>}
        </Section>

        <Section title={`Tệp trong lô (${files.length})`}>
          {files.length === 0 ? (
            <p className="text-sm text-muted">Chưa có tệp nào. Chọn lô này khi nạp PDF để tệp hiện ở đây.</p>
          ) : (
            <ul className="grid divide-y divide-line border border-line" aria-label="Tệp trong lô">
              {files.map((f) => (
                <li key={f.fileId} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                  <Link href={routes.document(f.documentId)} className="font-semibold text-primary hover:underline">{f.fileName}</Link>
                  <span className="text-muted">{f.pageCount ? `${f.pageCount} trang` : "Chưa đếm được trang"}</span>
                  {f.jobStatus && <Chip tone={f.jobStatus === "failed" ? "bad" : f.jobStatus === "completed" ? "ok" : "neutral"}>{JOB_STATUS[f.jobStatus] ?? f.jobStatus}</Chip>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <QualityPanel batchId={batch.id} files={files} issues={quality.issues} suspectPages={quality.suspectPages} canQc={can(session, "intake.qc")} canReplace={can(session, "document.edit")} closed={closed} />
      </PageBody>
    </>
  );
}
