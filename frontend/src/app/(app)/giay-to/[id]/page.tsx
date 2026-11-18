import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, FileSignature } from "lucide-react";
import { NeedsRealApi, PageBody, Section } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { Chip, WorkflowChip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { DocumentViewer } from "@/features/document/document-viewer";
import { DownloadButton } from "@/features/document/download-button";
import { getDocument, getFields, getRelations, getSignatures } from "@/features/document/document-data";
import { FileVersions, PrintLink } from "@/features/document/file-versions";
import { RelationsEditor } from "@/features/document/relations-editor";
import { ReplaceScanDialog } from "@/features/intake/replace-scan-dialog";
import { FIELD_ORIGIN, INTAKE_STATUS, REVIEW_STATUS, SIGNATURE_STATUS } from "@/features/document/labels";
import { getReview } from "@/features/review/review-data";
import { encodeRegionParam, isValidRegion, parseRegionParam } from "@/features/review/source-region";
import { ApiError } from "@/lib/api/server";
import { pageSession } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { formatDate, formatDateTime } from "@/lib/format";
import { loadOrNotFound } from "@/lib/load-or-not-found";

export const metadata: Metadata = { title: "Chi tiết giấy tờ" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lỗi phụ (chữ ký, liên kết, trường) không được làm hỏng cả trang chi tiết: trả null và hiện thông báo riêng ở khối đó. */
async function optional<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof ApiError) return null;
    throw error;
  }
}

/**
 * Chi tiết giấy tờ (FE-33): trình xem bản gốc (mở đúng trang theo `?trang=`, đúng phiên bản theo `?tep=`), thông tin, các phiên bản tệp,
 * trường đã đối chiếu kèm nhãn "đã sửa" so với AI (cho mọi người có quyền xem, BE-119), chữ ký số, liên kết văn bản, các hồ sơ chứa giấy tờ.
 * Tải tệp và in đều ghi nhật ký truy cập (in cần quyền `document.print`, BE-113).
 */
export default async function DocumentPage({ params, searchParams }: PageProps<"/giay-to/[id]">) {
  const { session, allowed } = await pageSession("document.view");
  if (!allowed) return <NoAccess session={session} what="xem giấy tờ" />;
  if (serverEnv().mock) return <NeedsRealApi what="Chi tiết giấy tờ" />;
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const query = await searchParams;
  const initialPage = Number(query.trang) || 1;
  const requestedFile = typeof query.tep === "string" && UUID.test(query.tep) ? query.tep : null;
  const requestedRegion = typeof query.vung === "string" ? query.vung : undefined;
  const highlightLabel = typeof query.truong === "string" ? query.truong.slice(0, 120) : "";

  const doc = await loadOrNotFound(() => getDocument(id));
  const versions = doc.files ?? [];
  // Bản đang xem: ?tep= nếu thuộc giấy tờ này và còn nội dung; không thì tệp chính như trước. Id lạ trong ?tep= bị bỏ qua, không lộ gì.
  const chosen = requestedFile ? versions.find((v) => v.id === requestedFile && !v.disposed) : undefined;
  const file = chosen ? { id: chosen.id, name: chosen.name, pageCount: chosen.pageCount ?? null, sha256: chosen.sha256 } : doc.file;
  const canEdit = can(session, "document.edit");
  const canPrint = can(session, "document.print");
  // Trường đã đối chiếu: bản chỉ đọc cho mọi người có quyền xem (BE-119). Người có quyền sửa thêm giá trị AI đọc từ màn đối chiếu để so.
  const [relations, signatures, fields, review] = await Promise.all([
    optional(() => getRelations(id)),
    file ? optional(() => getSignatures(file.id)) : Promise.resolve([]),
    optional(() => getFields(id)),
    canEdit ? optional(() => getReview(id)) : Promise.resolve(null),
  ]);
  // Vùng nguồn từ ?vung= chỉ dùng khi hợp lệ và đúng trang đang mở; sai thì bỏ, không dựng khung lệch.
  const highlightRegion = parseRegionParam(requestedRegion, initialPage);
  const suggested = new Map((review?.fields ?? []).map((f) => [f.fieldCode, f.suggestedValue]));

  return (
    <>
      <PageHeader
        title={doc.title}
        breadcrumbs={[{ label: "Tra cứu", href: routes.search }, { label: doc.documentNumber ?? "Giấy tờ" }]}
        meta={
          <>
            <span>{doc.documentForm}</span>
            {doc.documentNumber && <span className="font-mono">· {doc.documentNumber}</span>}
            <span>· Ngày ban hành {formatDate(doc.issuedOn)}</span>
            <Chip tone={doc.reviewStatus === "verified" ? "ok" : "warn"}>{REVIEW_STATUS[doc.reviewStatus] ?? doc.reviewStatus}</Chip>
          </>
        }
        actions={
          file ? (
            <>
              {canPrint && <PrintLink fileId={file.id} />}
              {can(session, "document.download") && <DownloadButton fileId={file.id} fileName={file.name} />}
            </>
          ) : undefined
        }
      />
      <PageBody className="lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section aria-label="Bản gốc" className="min-w-0 border border-line bg-soft p-3">
          {file ? <DocumentViewer key={file.id} fileId={file.id} pageCount={file.pageCount ?? 1} initialPage={initialPage} highlight={highlightRegion ? { region: highlightRegion, label: highlightLabel || "trường dữ liệu" } : null} /> : <p className="text-sm text-muted">Giấy tờ này không có tệp để xem.</p>}
        </section>

        <div className="grid min-w-0 content-start gap-4">
          <Section title="Thông tin">
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted">Loại giấy tờ</dt>
              <dd>{doc.classification ? `${doc.classification.workGroupCode ?? ""} ${doc.classification.documentTypeName ?? "Chưa chọn loại"}`.trim() : <span className="text-muted">Chưa phân loại</span>}</dd>
              <dt className="text-muted">Nhóm hồ sơ</dt><dd>{doc.classification?.workGroupTitle ?? "—"}</dd>
              <dt className="text-muted">Tình trạng</dt><dd>{INTAKE_STATUS[doc.intakeStatus] ?? doc.intakeStatus}</dd>
              {file && (<><dt className="text-muted">Tệp</dt><dd className="break-all">{file.name} · {file.pageCount ?? "?"} trang</dd></>)}
              {file && (<><dt className="text-muted">SHA-256</dt><dd className="font-mono text-xs break-all">{file.sha256}</dd></>)}
              {doc.metadataReviewedAt && (<><dt className="text-muted">Đầu văn bản</dt><dd>Đã xác nhận{doc.metadataReviewedByName ? ` bởi ${doc.metadataReviewedByName}` : ""} lúc {formatDateTime(doc.metadataReviewedAt)}{doc.metadataReviewNote ? ` · ${doc.metadataReviewNote}` : ""}</dd></>)}
            </dl>
          </Section>

          <Section
            title="Phiên bản tệp"
            description="Bản gốc, bản thay thế và bản dẫn xuất của giấy tờ. Bấm Xem để mở đúng bản đó ở khung bên trái."
            actions={canEdit && doc.file ? <ReplaceScanDialog documentId={id} label={doc.title} disabledReason={review && !review.canEdit ? (review.lockedReason ?? undefined) : undefined} /> : undefined}
          >
            <FileVersions documentId={id} files={versions} viewingId={file?.id ?? null} canPrint={canPrint} />
          </Section>

          <Section title="Hồ sơ chứa giấy tờ này">
            {doc.dossiers.length === 0 ? (
              <p className="text-sm text-muted">Giấy tờ chưa nằm trong hồ sơ nào (hoặc hồ sơ nằm ngoài phạm vi của bạn).</p>
            ) : (
              <ul className="grid gap-2">
                {doc.dossiers.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <Link href={routes.dossier(d.id)} className="font-mono text-xs text-primary hover:underline">{d.code}</Link>
                    <span className="min-w-0 flex-1">{d.title}</span>
                    <WorkflowChip state={d.status} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Trường dữ liệu" description="Giá trị đã đối chiếu. Nhãn “đã sửa” nghĩa là người dùng đã đổi hoặc xóa giá trị AI đọc ban đầu.">
            {!fields ? (
              <p className="text-sm text-bad" role="alert">Chưa tải được trường dữ liệu. Tải lại trang sau ít giây.</p>
            ) : fields.fields.length === 0 ? (
              <p className="text-sm text-muted">Giấy tờ chưa có trường dữ liệu (chưa xác nhận loại giấy tờ).</p>
            ) : (
              <dl className="grid gap-2 text-sm">
                {fields.fields.map((f) => {
                  const ai = suggested.get(f.fieldCode);
                  // BE-126: vùng nguồn nằm trên bản quét cũ (giấy tờ đã thay bản quét) thì mở đúng bản đó, không dựng khung lên bản hiện hành.
                  const sourceVersion = f.sourceFileId && f.sourceFileId !== doc.file?.id ? versions.find((v) => v.id === f.sourceFileId && !v.disposed) : undefined;
                  return (
                    <div key={f.fieldCode} className="grid gap-0.5 border-t border-dashed border-line pt-2 first:border-t-0 first:pt-0">
                      <dt className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        {f.label}
                        {f.verified ? <Chip tone="ok"><CheckCircle2 aria-hidden className="size-3" /> Đã đối chiếu</Chip> : <Chip tone="warn">Chưa đối chiếu</Chip>}
                        {f.editedFromAi && <Chip tone="info">Đã sửa</Chip>}
                        {!f.editedFromAi && f.origin === "manual" && <Chip tone="neutral">{FIELD_ORIGIN.manual}</Chip>}
                        {f.sourcePage && (
                          <Link
                            href={`${routes.document(id)}?trang=${f.sourceRegion?.page ?? f.sourcePage}${isValidRegion(f.sourceRegion) ? `&vung=${encodeRegionParam(f.sourceRegion)}` : ""}${sourceVersion ? `&tep=${sourceVersion.id}` : ""}&truong=${encodeURIComponent(f.label)}` as never}
                            className="text-primary hover:underline"
                          >
                            Trang {f.sourceRegion?.page ?? f.sourcePage}{isValidRegion(f.sourceRegion) ? " · chỉ vùng" : ""}{sourceVersion ? ` (bản quét ${sourceVersion.versionNo})` : ""}
                          </Link>
                        )}
                      </dt>
                      <dd>{f.value ?? <span className="text-muted">Để trống</span>}</dd>
                      {f.verified && f.verifiedByName && <dd className="text-xs text-muted">Đối chiếu bởi {f.verifiedByName}{f.verifiedAt ? ` lúc ${formatDateTime(f.verifiedAt)}` : ""}</dd>}
                      {f.editedFromAi && ai && <dd className="text-xs text-muted">AI đọc: “{ai}”</dd>}
                    </div>
                  );
                })}
              </dl>
            )}
          </Section>

          <Section title="Chữ ký số" description="Kiểm tra kỹ thuật chữ ký trong PDF, không kết luận hiệu lực pháp lý.">
            {signatures === null ? (
              <p className="text-sm text-bad" role="alert">Chưa tải được kết quả kiểm tra chữ ký.</p>
            ) : signatures.length === 0 ? (
              <p className="text-sm text-muted">Chưa có kết quả kiểm tra chữ ký số cho tệp này.</p>
            ) : (
              <ul className="grid gap-2">
                {signatures.map((s) => {
                  const status = SIGNATURE_STATUS[s.status] ?? { label: s.status, tone: "neutral" as const };
                  return (
                    <li key={s.id} className="grid gap-0.5 text-sm">
                      <span className="flex flex-wrap items-center gap-2">
                        <FileSignature aria-hidden className="size-4 text-muted" />
                        <b>{s.signerName ?? "Không rõ người ký"}</b>
                        <Chip tone={status.tone}>{status.label}</Chip>
                      </span>
                      <span className="text-xs text-muted">{s.signedAt ? `Ký lúc ${formatDateTime(s.signedAt)}` : "Không có thời điểm ký"}{s.certificateIssuer ? ` · ${s.certificateIssuer}` : ""}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title="Liên kết văn bản">
            {relations === null ? (
              <p className="text-sm text-bad" role="alert">Chưa tải được liên kết văn bản.</p>
            ) : (
              <RelationsEditor documentId={id} relations={relations} canEdit={canEdit && !(review && !review.canEdit)} />
            )}
          </Section>
        </div>
      </PageBody>
    </>
  );
}
