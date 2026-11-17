import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NeedsRealApi } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { getSuggestions } from "@/features/dossier/dossier-data";
import { creatableGroups } from "@/features/dossier/creatable-groups";
import { FileScreen } from "@/features/dossier/file-screen";
import { getReview, getWorkGroups } from "@/features/review/review-data";
import { ApiError } from "@/lib/api/server";
import { pageSession } from "@/lib/auth/page-guard";
import { serverEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Xếp vào hồ sơ" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Bước 3: chọn hồ sơ được gợi ý hoặc tạo mới tại chỗ; lưu xong mở luôn PDF tiếp theo. */
export default async function FilePage({ params }: PageProps<"/tiep-nhan/[documentId]/xep-ho-so">) {
  const { session, allowed } = await pageSession("dossier.prepare");
  if (!allowed) return <NoAccess session={session} what="xếp giấy tờ vào hồ sơ" />;
  if (serverEnv().mock) return <NeedsRealApi what="Màn xếp hồ sơ" />;
  const { documentId } = await params;
  if (!UUID.test(documentId)) notFound();

  const review = await getReview(documentId).catch((error) => {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  });
  const [suggestions, groups] = await Promise.all([getSuggestions(documentId), getWorkGroups(session.activeAssignment.organizationCode)]);
  const doc = review.document;

  const creatable = creatableGroups(groups, session.activeAssignment);
  const suggestedGroup = doc.classification?.workGroupCode ?? review.suggestion?.workGroupCode ?? null;

  return (
    <FileScreen
      document={{
        id: doc.id,
        title: doc.title,
        fileName: doc.file?.name ?? doc.title,
        reviewStatus: doc.reviewStatus,
        groupCode: creatable.some((g) => g.code === suggestedGroup) ? suggestedGroup : creatable.length === 1 ? creatable[0].code : null,
        existing: doc.dossiers.map((d) => ({ id: d.id, code: d.code, title: d.title })),
      }}
      suggestions={suggestions}
      groups={creatable.map((g) => ({ code: g.code, title: g.title }))}
    />
  );
}
