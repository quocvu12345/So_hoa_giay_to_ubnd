import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NeedsRealApi } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { getInbox, READY_ONLY } from "@/features/intake/inbox-data";
import { getDocumentTypes, getReview, getWorkGroups } from "@/features/review/review-data";
import { ReviewScreen } from "@/features/review/review-screen";
import { ApiError } from "@/lib/api/server";
import { pageSession } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Đối chiếu" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Bước 2: bản gốc bên trái, trường bên phải. Trường cần xem lên đầu.
 * Dữ liệu từ GET /documents/{id}/review (BE-47). Giấy tờ ngoài phạm vi trả 404, hiện "không tìm thấy".
 */
export default async function ReviewPage({ params }: PageProps<"/tiep-nhan/[documentId]/doi-chieu">) {
  const { session, allowed } = await pageSession("document.edit");
  if (!allowed) return <NoAccess session={session} what="đối chiếu giấy tờ" />;
  if (serverEnv().mock) return <NeedsRealApi what="Màn đối chiếu" />;
  const { documentId } = await params;
  if (!UUID.test(documentId)) notFound();

  const review = await getReview(documentId).catch((error) => {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  });

  const groupCode = review.document.classification?.workGroupCode ?? review.suggestion?.workGroupCode ?? null;
  const [groups, types, inbox] = await Promise.all([
    getWorkGroups(session.activeAssignment.organizationCode),
    groupCode ? getDocumentTypes(groupCode) : Promise.resolve([]),
    // Chỉ để đếm "còn bao nhiêu PDF đã đọc xong"; lỗi ở đây không được làm hỏng màn đối chiếu.
    getInbox("inbox", undefined, 200, READY_ONLY).catch(() => null),
  ]);
  const othersReady = inbox ? inbox.items.filter((i) => i.documentId !== documentId).length : 0;

  return (
    <ReviewScreen
      data={review}
      groups={groups.map((g) => ({ code: g.code, title: g.title }))}
      types={types}
      canExtract={can(session, ["intake.upload", "dossier.prepare"])}
      othersReady={othersReady}
    />
  );
}
