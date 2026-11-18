import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NeedsRealApi, PageBody, Section } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { Chip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { getSubmission } from "@/features/archive/archive-data";
import { CHECK_RESULT, SUBMISSION_STATUS } from "@/features/archive/archive-rules";
import { SubmissionActions } from "@/features/archive/submission-actions";
import { UUID } from "@/features/dossier/dossier-data";
import { pageSession } from "@/lib/auth/page-guard";
import { serverEnv } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { loadOrNotFound } from "@/lib/load-or-not-found";

export const metadata: Metadata = { title: "Đợt nộp lưu" };

const TONE = { draft: "neutral", submitted: "info", received: "ok", returned: "bad" } as const;

/** Chi tiết một đợt nộp lưu (FE-37): danh mục hồ sơ kèm số trang và vị trí, kết quả kiểm từng hồ sơ, thao tác theo bước, biên bản khi đã tiếp nhận. */
export default async function SubmissionPage({ params }: PageProps<"/nop-luu/[submissionId]">) {
  const { session, allowed } = await pageSession("dossier.archive");
  if (!allowed) return <NoAccess session={session} what="nộp lưu hồ sơ" />;
  const { submissionId } = await params;
  if (!UUID.test(submissionId)) notFound();
  if (serverEnv().mock) return <><PageHeader title="Đợt nộp lưu" breadcrumbs={[{ label: "Nộp lưu", href: routes.archive }]} /><PageBody><NeedsRealApi what="Nộp lưu" /></PageBody></>;

  const s = await loadOrNotFound(() => getSubmission(submissionId));
  const items = s.items ?? [];
  return (
    <>
      <PageHeader title={`Đợt ${s.code}`} description={s.note || `${Number(s.dossierCount)} hồ sơ · ${Number(s.pageCount)} trang`} breadcrumbs={[{ label: "Nộp lưu", href: routes.archive }, { label: s.code }]}
        meta={<Chip tone={TONE[s.status as keyof typeof TONE] ?? "neutral"}>{SUBMISSION_STATUS[s.status] ?? s.status}</Chip>} />
      <PageBody>
        <Section title="Tiến trình">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-xs text-muted">Tạo</dt><dd>{s.createdByName} · {formatDateTime(s.createdAt)}</dd></div>
            <div><dt className="text-xs text-muted">Nộp</dt><dd>{s.submittedAt ? `${s.submittedByName} · ${formatDateTime(s.submittedAt)}` : "Chưa nộp"}</dd></div>
            <div><dt className="text-xs text-muted">Tiếp nhận</dt><dd>{s.receivedAt ? `${s.receivedByName} · ${formatDateTime(s.receivedAt)}` : "Chưa tiếp nhận"}</dd></div>
            <div><dt className="text-xs text-muted">Quy mô</dt><dd>{Number(s.dossierCount)} hồ sơ · {Number(s.pageCount)} trang</dd></div>
          </dl>
          {s.status === "returned" && s.returnNote && <p role="status" className="border border-bad bg-bad-soft p-3 text-sm text-bad"><b>Đã trả lại:</b> {s.returnNote} Các hồ sơ đã được giải phóng, gom lại sau khi sửa.</p>}
          <SubmissionActions submission={s} />
        </Section>

        <Section title={`Hồ sơ trong đợt (${items.length})`}>
          <ul className="grid divide-y divide-line border border-line" aria-label="Hồ sơ trong đợt">
            {items.map((i) => (
              <li key={i.dossierId} className="grid gap-0.5 px-3 py-2.5 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <Link href={routes.dossier(i.dossierId)} className="font-bold text-primary hover:underline">{i.code}</Link>
                  <span>{i.title}</span>
                  <Chip tone={i.checkResult === "issue" ? "bad" : i.checkResult === "ok" ? "ok" : "neutral"}>{CHECK_RESULT[i.checkResult] ?? i.checkResult}</Chip>
                </span>
                <span className="text-xs text-muted">{Number(i.pageCount)} trang · {i.location ?? "chưa có vị trí bản giấy"}</span>
                {i.note && <span className="text-[13px] text-bad">{i.note}</span>}
              </li>
            ))}
          </ul>
        </Section>
      </PageBody>
    </>
  );
}
