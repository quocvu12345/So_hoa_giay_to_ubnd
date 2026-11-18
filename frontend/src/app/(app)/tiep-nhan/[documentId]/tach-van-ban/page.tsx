import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NeedsRealApi, PageBody } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "@/config/routes";
import { getDocument } from "@/features/document/document-data";
import { UUID } from "@/features/dossier/dossier-data";
import { getSegments } from "@/features/split/split-data";
import { SplitEditor } from "@/features/split/split-editor";
import { segmentsToCuts } from "@/features/split/split-rules";
import { ApiError } from "@/lib/api/server";
import { pageSession } from "@/lib/auth/page-guard";
import { serverEnv } from "@/lib/env";
import { loadOrNotFound } from "@/lib/load-or-not-found";

export const metadata: Metadata = { title: "Tách văn bản" };

/**
 * Tách thành nhiều văn bản (FE-25, BE-51): một tệp quét chứa nhiều văn bản độc lập (đơn, biên bản, quyết định) chia theo dải trang.
 * Điểm tách có thể đã được AI gợi ý; người dùng chỉnh rồi xác nhận. Chỉ người nạp tệp, khi văn bản còn ở hộp tiếp nhận.
 */
export default async function SplitPage({ params }: PageProps<"/tiep-nhan/[documentId]/tach-van-ban">) {
  const { session, allowed } = await pageSession("document.edit");
  if (!allowed) return <NoAccess session={session} what="tách văn bản" />;
  const { documentId } = await params;
  if (!UUID.test(documentId)) notFound();
  const crumbs = [{ label: "Tiếp nhận PDF", href: routes.intake }, { label: "Đối chiếu", href: routes.intakeReview(documentId) }, { label: "Tách văn bản" }];
  if (serverEnv().mock) return <><PageHeader title="Tách thành nhiều văn bản" breadcrumbs={crumbs} /><PageBody><NeedsRealApi what="Tách văn bản" /></PageBody></>;

  // Văn bản đã tách không còn "thấy được" nên đọc chi tiết sẽ 404; đọc đề xuất trước để nói đúng 409 "đã tách" thay vì "Không tìm thấy".
  let segments;
  try {
    segments = await getSegments(documentId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      return <><PageHeader title="Tách thành nhiều văn bản" breadcrumbs={crumbs} /><PageBody><p role="status" className="border border-warn bg-warn-soft p-4 text-sm text-warn">Văn bản này đã được tách hoặc đã xếp vào hồ sơ nên không tách được nữa.</p></PageBody></>;
    }
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
  const doc = await loadOrNotFound(() => getDocument(documentId));
  const pageCount = Number(segments.pageCount);
  const inbox = doc.intakeStatus === "inbox";

  return (
    <>
      <PageHeader title="Tách thành nhiều văn bản" description={`${doc.title} · ${pageCount} trang. Đặt điểm tách giữa các trang để chia thành các văn bản riêng.`} breadcrumbs={crumbs} />
      <PageBody>
        {!inbox ? (
          <p role="status" className="border border-warn bg-warn-soft p-4 text-sm text-warn">Văn bản này đã được tách hoặc đã xếp vào hồ sơ nên không tách được nữa.</p>
        ) : pageCount < 2 ? (
          <p role="status" className="border border-dashed border-line-strong p-4 text-sm text-muted">Tệp chỉ có {pageCount === 1 ? "một trang" : "chưa đếm được số trang"} nên không có gì để tách.</p>
        ) : (
          <SplitEditor documentId={documentId} fileId={segments.fileId} pageCount={pageCount} initialCuts={segmentsToCuts(segments.segments.filter((s) => s.status === "proposed"), pageCount)} baseTitle={doc.title} />
        )}
      </PageBody>
    </>
  );
}
