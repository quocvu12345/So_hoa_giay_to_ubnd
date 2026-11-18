import type { Metadata } from "next";
import Link from "next/link";
import { FolderInput } from "lucide-react";
import { EmptyState, NeedsRealApi, PageBody } from "@/components/ui/blocks";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { Chip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { getBatches } from "@/features/intake/batch-data";
import { BATCH_STATUS, sheetHint } from "@/features/intake/batch-rules";
import { CreateBatchButton } from "@/features/intake/create-batch-button";
import { pageSession } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Lô quét" };

const FILTERS = [
  { value: "mo", label: "Đang mở" },
  { value: "dong", label: "Đã đóng" },
  { value: "tat-ca", label: "Tất cả" },
] as const;

/**
 * Lô quét (FE-41): mỗi lô là một lần bàn giao hồ sơ giấy để quét. Hiện đơn vị giao, hộp, số tờ dự kiến so với trang đã quét và số lỗi ảnh còn mở.
 * Bộ lọc nằm trên URL (`?trang-thai=`). Mặc định chỉ lô còn mở.
 */
export default async function BatchesPage({ searchParams }: PageProps<"/tiep-nhan/lo-quet">) {
  const { session, allowed } = await pageSession(["intake.manage", "intake.upload"]);
  if (!allowed) return <NoAccess session={session} what="xem lô quét" />;
  const raw = (await searchParams)["trang-thai"];
  const filter = FILTERS.find((f) => f.value === raw)?.value ?? "mo";
  const real = !serverEnv().mock;
  const all = real ? await getBatches() : [];
  const batches = all.filter((b) => (filter === "tat-ca" ? true : filter === "dong" ? b.status === "closed" : b.status !== "closed"));

  return (
    <>
      <PageHeader
        title="Lô quét"
        description="Mỗi lô là một lần bàn giao hồ sơ giấy để quét: đơn vị giao, hộp, số tờ dự kiến và số trang đã quét."
        breadcrumbs={[{ label: "Tiếp nhận PDF", href: routes.intake }, { label: "Lô quét" }]}
        actions={real && can(session, "intake.manage") ? <CreateBatchButton /> : undefined}
      />
      <PageBody>
        {!real ? (
          <NeedsRealApi what="Lô quét" />
        ) : (
          <>
            <nav aria-label="Lọc lô quét" className="flex flex-wrap gap-2 text-sm">
              {FILTERS.map((f) => (
                <Link key={f.value} href={(f.value === "mo" ? routes.intakeBatches : `${routes.intakeBatches}?trang-thai=${f.value}`) as "/tiep-nhan/lo-quet"} aria-current={filter === f.value ? "page" : undefined}
                  className={cn("border px-3 py-1.5", filter === f.value ? "border-primary bg-primary text-white" : "border-line-strong hover:border-primary")}>
                  {f.label}
                </Link>
              ))}
            </nav>
            {batches.length === 0 ? (
              <EmptyState icon={FolderInput} title={filter === "dong" ? "Chưa có lô nào đã đóng" : "Chưa có lô quét"}>
                Tạo lô trước khi quét để truy được từng trang về đúng lần bàn giao và biên bản giao nhận.
              </EmptyState>
            ) : (
              <ul className="grid gap-3" aria-label="Danh sách lô quét">
                {batches.map((b) => {
                  const hint = sheetHint(b.expectedSheetCount ?? null, Number(b.scannedPageCount));
                  return (
                    <li key={b.id} className="border border-line bg-surface">
                      <Link href={routes.intakeBatch(b.id)} data-row className="grid gap-1.5 p-4 hover:bg-soft focus-visible:outline-2 focus-visible:-outline-offset-2">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-bold">{b.code}</span>
                          <Chip tone={b.status === "closed" ? "neutral" : "info"}>{BATCH_STATUS[b.status] ?? b.status}</Chip>
                          {Number(b.openIssues) > 0 && <Chip tone="warn">{b.openIssues} lỗi ảnh mở</Chip>}
                        </span>
                        <span className="text-sm text-muted">
                          {[b.handedOverBy, b.boxLabel].filter(Boolean).join(" · ") || "Chưa ghi đơn vị giao"} · {b.fileCount} tệp · mở {formatDate(b.openedAt)}
                          {b.closedAt ? ` · đóng ${formatDate(b.closedAt)}` : ""}
                        </span>
                        <span className={cn("text-[13px]", hint.tone === "warn" ? "text-warn" : "text-muted")}>{hint.text}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}
