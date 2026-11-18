import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Upload } from "lucide-react";
import { RefreshOnEvents } from "@/components/layout/refresh-on-events";
import { DueChip } from "@/components/dossier/due-chip";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, NeedsRealApi, PageBody, Section } from "@/components/ui/blocks";
import { PageHeader } from "@/components/ui/page-header";
import { RowNavigation } from "@/components/ui/row-navigation";
import { WorkflowChip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { LeadershipOverview } from "@/features/workspace/leadership-overview";
import { getLeadership, getQueues, getSummary } from "@/features/workspace/workspace-data";
import { orderQueue, sectionsFor, type QueueKind } from "@/features/workspace/workspace-queue";
import { pageSession } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/session";
import { scopeLabel } from "@/lib/auth/types";
import { serverEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Việc của tôi" };

/** Mỗi hàng chỉ hiện chừng này dòng; phần còn lại ở "Xem tất cả" (API trả cả nghìn hồ sơ cho văn thư). */
const VISIBLE = 10;

/**
 * Việc của tôi (FE-20): màn mở đầu của mọi vai trò. Hàng việc lấy từ API theo phân công đang dùng, giao diện chỉ xếp thứ tự:
 * quá hạn lên đầu (chip đỏ), bị trả lại, sắp đến hạn (≤ 2 ngày, chip vàng). Tự làm mới khi có hồ sơ đổi hoặc thông báo mới qua SSE.
 */
export default async function MyWorkPage() {
  const { session } = await pageSession();
  const role = session.activeAssignment.role;
  const canUpload = can(session, "intake.upload");
  const real = !serverEnv().mock;
  const isLeader = role === "chair" || role === "council";
  const [summary, queues, leadership] = real ? await Promise.all([getSummary(), getQueues(), isLeader ? getLeadership() : null]) : [null, null, null];
  const sections = sectionsFor(role);

  return (
    <>
      <PageHeader
        title="Việc của tôi"
        description="Những việc đang chờ bạn, xếp theo mức cần làm trước. Nhấn vào một dòng để mở ngay."
        meta={<span>Phân công: {scopeLabel(session.activeAssignment)}</span>}
        actions={
          canUpload ? (
            <ButtonLink href={routes.intakeUpload} variant="primary">
              <Upload aria-hidden className="size-4" /> Nạp PDF
            </ButtonLink>
          ) : undefined
        }
      />
      <RefreshOnEvents events={["dossier.changed", "notification.created", "job.completed", "resync"]} />
      <RowNavigation />
      <PageBody>
        {!real || !summary || !queues ? (
          <NeedsRealApi what="Việc của tôi" />
        ) : (
          <>
            {canUpload && summary.inbox > 0 && (
              <Link href={routes.intake} className="flex items-center justify-between gap-3 border border-primary/40 bg-accent-soft px-4 py-3 hover:border-primary">
                <span>
                  <strong>{summary.inbox} PDF</strong> đang ở hộp tiếp nhận của bạn: đối chiếu và xếp vào hồ sơ khi AI đọc xong.
                </span>
                <ArrowRight aria-hidden className="size-5 text-primary" />
              </Link>
            )}

            {leadership && <LeadershipOverview summary={leadership} />}

            {role === "technical_admin" && (
              <Section title="Vận hành" description="Quản trị kỹ thuật không xem nội dung hồ sơ.">
                <ul className="grid gap-1 text-sm">
                  <li><Link className="text-primary hover:underline" href={routes.adminOperations}>Hàng đợi AI và lỗi đọc PDF</Link></li>
                  <li><Link className="text-primary hover:underline" href={routes.adminOperations}>Lần sao lưu gần nhất</Link></li>
                  <li><Link className="text-primary hover:underline" href={routes.adminUsers}>Phân công sắp hết hạn</Link></li>
                </ul>
              </Section>
            )}

            {sections.map((section) => {
              const rows = orderQueue(queues[section.kind] ?? []);
              const total = summary.counts[section.kind as QueueKind] ?? rows.length;
              return (
                <Section
                  key={section.kind}
                  title={`${section.title} · ${total}`}
                  description={section.hint}
                  actions={<Link href={section.allHref as Route} className="text-sm font-semibold text-primary hover:underline">Xem tất cả</Link>}
                >
                  {rows.length === 0 ? (
                    <EmptyState title="Không có việc nào">Khi có hồ sơ cần bạn xử lý, hồ sơ sẽ hiện ở đây.</EmptyState>
                  ) : (
                    <ul>
                      {rows.slice(0, VISIBLE).map((d) => (
                        <li key={d.dossierId} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line py-2.5 first:border-t-0">
                          <Link href={routes.dossier(d.dossierId)} data-row className="grid min-w-0 flex-1 gap-0.5 hover:text-primary">
                            <span className="font-mono text-xs text-muted">{d.code}</span>
                            <span className="font-semibold">{d.title}</span>
                          </Link>
                          <WorkflowChip state={d.status} label={d.statusLabel} />
                          <span className="min-w-28 text-right text-[13px] text-muted"><DueChip dueOn={d.dueOn} /></span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {rows.length > VISIBLE && <p className="text-[13px] text-muted">Đang hiện {VISIBLE} hồ sơ ưu tiên nhất trong {rows.length}. <Link href={section.allHref as Route} className="font-semibold text-primary hover:underline">Xem tất cả</Link></p>}
                </Section>
              );
            })}
          </>
        )}
      </PageBody>
    </>
  );
}
