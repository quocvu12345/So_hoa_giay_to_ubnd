import type { Metadata } from "next";
import Link from "next/link";
import { Archive } from "lucide-react";
import { EmptyState, NeedsRealApi, PageBody, Section } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { Chip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { getReadyForArchive, getSubmissions } from "@/features/archive/archive-data";
import { filterSubmissions, parseSubmissionFilter, SUBMISSION_FILTERS, SUBMISSION_STATUS } from "@/features/archive/archive-rules";
import { CreateSubmissionPanel } from "@/features/archive/create-submission-panel";
import { pageSession } from "@/lib/auth/page-guard";
import { serverEnv } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Nộp lưu" };

const TONE = { draft: "neutral", submitted: "info", received: "ok", returned: "bad" } as const;

/**
 * Nộp lưu theo đợt (FE-37, BE-84, BE-85): gom hồ sơ đã đạt (chờ nộp lưu) thành đợt, nộp, người tiếp nhận tiếp nhận cả đợt hoặc trả lại kèm lỗi.
 * Tiếp nhận xong có biên bản PDF. Bộ lọc đợt nằm trên URL (`?trang-thai=`).
 */
export default async function ArchivePage({ searchParams }: PageProps<"/nop-luu">) {
  const { session, allowed } = await pageSession("dossier.archive");
  if (!allowed) return <NoAccess session={session} what="nộp lưu hồ sơ" />;
  const filter = parseSubmissionFilter((await searchParams)["trang-thai"]);
  const real = !serverEnv().mock;
  const [ready, submissions] = real ? await Promise.all([getReadyForArchive(), getSubmissions()]) : [[], []];
  const shown = filterSubmissions(submissions, filter);

  return (
    <>
      <PageHeader title="Nộp lưu" description="Gom hồ sơ đã đạt thành đợt, nộp, tiếp nhận cả đợt hoặc trả lại kèm lỗi, tải biên bản." breadcrumbs={[{ label: "Việc của tôi", href: routes.home }, { label: "Nộp lưu" }]} />
      <PageBody>
        {!real ? <NeedsRealApi what="Nộp lưu" /> : (
          <>
            <Section title={`Hồ sơ chờ nộp lưu (${ready.length})`} description="Chọn các hồ sơ cùng nộp một lần. Hồ sơ đã nằm trong một đợt chưa xong thì chưa gom được.">
              <CreateSubmissionPanel dossiers={ready} />
            </Section>

            <Section title="Các đợt nộp lưu">
              <nav aria-label="Lọc đợt" className="flex flex-wrap gap-2 text-sm">
                {SUBMISSION_FILTERS.map((f) => (
                  <Link key={f.value} href={(f.value === "dang-xu-ly" ? routes.archive : `${routes.archive}?trang-thai=${f.value}`) as "/nop-luu"} aria-current={f.value === filter ? "page" : undefined}
                    className={cn("border px-3 py-1.5", f.value === filter ? "border-primary bg-primary text-white" : "border-line-strong hover:border-primary")}>{f.label}</Link>
                ))}
              </nav>
              {shown.length === 0 ? <EmptyState icon={Archive} title="Không có đợt nào">Tạo đợt từ hồ sơ chờ nộp lưu ở trên.</EmptyState> : (
                <ul className="grid gap-2" aria-label="Danh sách đợt nộp lưu">
                  {shown.map((s) => (
                    <li key={s.id} className="border border-line">
                      <Link href={routes.archiveSubmission(s.id)} data-row className="grid gap-1 p-3 hover:bg-soft focus-visible:outline-2 focus-visible:-outline-offset-2">
                        <span className="flex flex-wrap items-center gap-2"><b>{s.code}</b><Chip tone={TONE[s.status as keyof typeof TONE] ?? "neutral"}>{SUBMISSION_STATUS[s.status] ?? s.status}</Chip></span>
                        <span className="text-[13px] text-muted">{Number(s.dossierCount)} hồ sơ · {Number(s.pageCount)} trang · {s.createdByName} tạo {formatDateTime(s.createdAt)}{s.receivedAt ? ` · tiếp nhận ${formatDateTime(s.receivedAt)}` : ""}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </>
        )}
      </PageBody>
    </>
  );
}
