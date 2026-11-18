"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleStop, Trash2, Undo2, Upload } from "lucide-react";
import { cancelReading, discardDocument, loadMoreInbox, restoreDocument } from "@/app/actions/intake";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/blocks";
import { RowNavigation } from "@/components/ui/row-navigation";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { useServerEvent } from "@/lib/events/server-events";
import { useServerAction } from "@/lib/use-server-action";
import { AiStatusChip, toAiStage, toQueueKind } from "./ai-status";
import { ExtractNowButton } from "./extract-now-button";
import type { InboxItem, InboxStatus, InboxSummary } from "./inbox-data";
import { inboxHref, isFiltered, type InboxFilters } from "./inbox-filter";
import { AI_FILTERS, withLiveProgress, type AiFilterKey, type LiveProgress } from "./inbox-live";

type Props = {
  status: InboxStatus;
  tabKey: string;
  items: InboxItem[];
  nextCursor: string | null;
  canExtract: boolean;
  /** Bộ lọc đang áp (từ địa chỉ); máy chủ đã lọc trên toàn hộp. */
  filters: InboxFilters;
  /** Số PDF theo tình trạng đọc của cùng lô/nhóm; null ở thẻ không có nút lọc tình trạng đọc. */
  summary: InboxSummary | null;
};

/** Số hiển thị ở mỗi nút lọc, lấy từ tổng hợp của máy chủ (không phải phần đã tải). */
function summaryCount(summary: InboxSummary, key: AiFilterKey): number {
  switch (key) {
    case "dang-cho": return summary.queued;
    case "dang-doc": return summary.reading;
    case "da-doc": return summary.ready;
    case "loi": return summary.failed + summary.cancelled;
    default: return summary.total;
  }
}

const REFRESH_DELAY_MS = 400;

/**
 * Bảng hộp tiếp nhận (FE-21, FE-45). Dữ liệu trang đầu do máy chủ cấp; sau đó:
 * - SSE `job.progress` cập nhật nhãn "Đang đọc trang a/b" ngay trên dòng, không tải lại trang;
 * - SSE `job.completed|failed|cancelled` và `resync` gọi router.refresh() để lấy lại thứ tự, vị trí hàng đợi, gợi ý mới;
 * - Bộ lọc (tình trạng đọc, lô, nhóm) nằm trên địa chỉ và máy chủ lọc trên toàn hộp (BE-129), nên đổi bộ lọc là đổi trang và state tự làm mới;
 * - "Tải thêm" dùng cursor của API kèm đúng bộ lọc đó.
 */
export function InboxTable({ status, tabKey, items: initial, nextCursor: initialCursor, canExtract, filters, summary }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [loaded, setLoaded] = useState({ source: initial, more: [] as InboxItem[], cursor: initialCursor });
  // Dữ liệu máy chủ đổi (sau router.refresh) thì bỏ phần "tải thêm" cũ: nó có thể trùng hoặc lệch thứ tự.
  if (loaded.source !== initial) setLoaded({ source: initial, more: [], cursor: initialCursor });

  const [live, setLive] = useState<Record<string, LiveProgress>>({});
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const scheduleRefresh = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), REFRESH_DELAY_MS);
  }, [router]);
  useEffect(() => () => clearTimeout(refreshTimer.current), []);

  useServerEvent("job.progress", (event) => {
    if (!event.documentId || event.processed == null) return;
    const documentId = event.documentId;
    setLive((current) => ({ ...current, [documentId]: { processed: event.processed ?? 0, pageCount: event.pageCount ?? null } }));
  });
  const onJobEnd = (event: { documentId: string | null }) => {
    const documentId = event.documentId;
    if (documentId) {
      setLive((current) => {
        const rest = { ...current };
        delete rest[documentId];
        return rest;
      });
    }
    scheduleRefresh();
  };
  useServerEvent("job.completed", onJobEnd);
  useServerEvent("job.failed", onJobEnd);
  useServerEvent("job.cancelled", onJobEnd);
  useServerEvent("resync", () => scheduleRefresh());

  const more = useServerAction(loadMoreInbox);
  const discard = useServerAction(discardDocument);
  const restore = useServerAction(restoreDocument);
  const cancel = useServerAction(cancelReading);

  const rows = useMemo(
    () => [...loaded.source, ...loaded.more].map((item) => withLiveProgress(item, live[item.documentId])),
    [loaded, live],
  );
  const filtered = isFiltered(filters);
  const total = loaded.source.length + loaded.more.length;

  async function onLoadMore() {
    if (!loaded.cursor) return;
    const outcome = await more.run(status, loaded.cursor, filters);
    if (outcome.ok) setLoaded((current) => ({ ...current, more: [...current.more, ...outcome.data.items], cursor: outcome.data.nextCursor }));
  }

  async function onDiscard(item: InboxItem) {
    const outcome = await discard.run(item.documentId);
    if (!outcome.ok) return;
    toast.success(`Đã bỏ “${item.fileName}”. Hoàn tác được trong 30 ngày ở thẻ Đã bỏ.`, {
      label: "Hoàn tác",
      onClick: () => {
        void restore.run(item.documentId).then((r) => {
          if (r.ok) {
            toast.success(`Đã khôi phục “${item.fileName}” vào hộp tiếp nhận.`);
            router.refresh();
          }
        });
      },
    });
    router.refresh();
  }

  async function onCancel(item: InboxItem) {
    if (!item.jobId) return;
    const outcome = await cancel.run(item.jobId);
    if (!outcome.ok) return;
    toast.success(`Đã hủy đọc “${item.fileName}”. Bấm Đọc lại khi cần.`);
    scheduleRefresh();
  }

  async function onRestore(item: InboxItem) {
    const outcome = await restore.run(item.documentId);
    if (!outcome.ok) return;
    toast.success(`Đã khôi phục “${item.fileName}” vào hộp tiếp nhận.`);
    router.refresh();
  }

  // Không lọc mà hộp rỗng: lời mời nạp PDF. Đang lọc mà không có dòng nào: vẫn giữ các nút lọc để đổi hoặc bỏ lọc, nên không thoát sớm.
  if (total === 0 && !filtered) {
    return status === "inbox" ? (
      <EmptyState
        icon={Upload}
        title="Chưa có PDF nào chờ xếp hồ sơ"
        action={
          <ButtonLink href={routes.intakeUpload} variant="primary">
            Nạp PDF
          </ButtonLink>
        }
      >
        Kéo thả một hoặc nhiều PDF vào màn Nạp PDF. Tệp trùng với tệp đã có sẽ được báo ngay, không đọc lại.
      </EmptyState>
    ) : (
      <EmptyState icon={Upload} title={status === "filed" ? "Chưa có PDF nào đã xếp vào hồ sơ" : "Không có PDF nào đã bỏ"}>
        {status === "filed" ? "PDF đã đối chiếu và xếp vào hồ sơ sẽ hiện ở đây." : "PDF bạn bỏ khỏi hộp tiếp nhận được giữ 30 ngày để hoàn tác."}
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-3">
      <RowNavigation />
      {status === "inbox" && summary && (
        <nav aria-label="Lọc theo tình trạng đọc" className="flex flex-wrap items-center gap-1.5">
          {AI_FILTERS.map((f) => (
            <Link
              key={f.key}
              href={inboxHref(tabKey, { ...filters, doc: f.key }) as Route}
              aria-current={filters.doc === f.key ? "true" : undefined}
              className={cn(
                "inline-flex h-8 items-center border px-3 text-[13px] font-semibold",
                filters.doc === f.key ? "border-primary bg-primary text-white" : "border-line-strong bg-surface text-ink hover:border-primary",
              )}
            >
              {f.label} <span className={cn("ml-1 tabular-nums", filters.doc !== f.key && "text-muted")}>({summaryCount(summary, f.key)})</span>
            </Link>
          ))}
        </nav>
      )}

      {/* Dưới 1280px (kể cả 1024px có menu trái): mỗi PDF một thẻ, không phải cuộn ngang để thấy nút. */}
      <ul className="grid gap-2 xl:hidden" aria-label="Danh sách PDF trong hộp tiếp nhận">
        {rows.length === 0 && (
          <li className="border border-line bg-surface px-3 py-6 text-center text-sm text-muted">
            {filtered ? "Không có PDF nào khớp bộ lọc." : `Không có PDF nào ở tình trạng này trong ${total} PDF đã tải.`}
          </li>
        )}
        {rows.map((item) => {
          const stage = toAiStage(item.stage);
          return (
            <li key={item.documentId} className="grid gap-2 border border-line bg-surface p-3 text-sm">
              <div className="grid gap-0.5">
                <span className="font-semibold break-all">{item.fileName}</span>
                <span className="text-xs text-muted">
                  {item.pageCount ?? "?"} trang · nạp lúc <time dateTime={item.uploadedAt}>{formatTime(item.uploadedAt)}</time>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <AiStatusChip
                  item={{
                    stage,
                    queueKind: toQueueKind(item.queueKind),
                    queuePosition: item.queuePosition,
                    etaSeconds: item.etaSeconds,
                    progress: item.progress,
                    attentionCount: item.attentionCount,
                  }}
                />
                {item.suggestion && <span className="text-muted">{item.suggestion}</span>}
              </div>
              {stage === "failed" && item.error && <span className="text-xs text-bad">{item.error}</span>}
              <RowActions
                item={item}
                status={status}
                canExtract={canExtract}
                onDiscard={onDiscard}
                onRestore={onRestore}
                onCancel={onCancel}
                busy={discard.pending || restore.pending || cancel.pending}
                align="start"
              />
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto border border-line bg-surface xl:block">
        <table className="w-full min-w-[820px] text-sm">
          <caption className="sr-only">Danh sách PDF trong hộp tiếp nhận</caption>
          <thead className="bg-soft text-left text-[13px] text-heading">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">
                Tệp
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Trang
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Tình trạng đọc
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Gợi ý của AI
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                Việc tiếp theo
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted">
                  {filtered ? "Không có PDF nào khớp bộ lọc." : `Không có PDF nào ở tình trạng này trong ${total} PDF đã tải.`}
                </td>
              </tr>
            )}
            {rows.map((item) => {
              const stage = toAiStage(item.stage);
              const queueKind = toQueueKind(item.queueKind);
              return (
                <tr key={item.documentId} className="border-t border-line align-top">
                  <td className="px-3 py-2.5">
                    <span className="font-semibold break-all">{item.fileName}</span>
                    <span className="block text-xs text-muted">
                      Nạp lúc <time dateTime={item.uploadedAt}>{formatTime(item.uploadedAt)}</time>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{item.pageCount ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <AiStatusChip
                      item={{
                        stage,
                        queueKind,
                        queuePosition: item.queuePosition,
                        etaSeconds: item.etaSeconds,
                        progress: item.progress,
                        attentionCount: item.attentionCount,
                      }}
                    />
                    {stage === "failed" && item.error && <span className="mt-1 block max-w-64 text-xs text-bad">{item.error}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-muted">{item.suggestion ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <RowActions
                      item={item}
                      status={status}
                      canExtract={canExtract}
                      onDiscard={onDiscard}
                      onRestore={onRestore}
                      onCancel={onCancel}
                      busy={discard.pending || restore.pending || cancel.pending}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
        <span aria-live="polite">
          Đã tải {total} PDF{loaded.cursor ? ", còn nữa" : ""}.
        </span>
        {loaded.cursor && (
          <Button size="sm" onClick={onLoadMore} disabled={more.pending} aria-busy={more.pending}>
            {more.pending ? "Đang tải…" : "Tải thêm"}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Thao tác của một PDF theo trạng thái; dùng chung cho bảng (màn rộng) và thẻ (màn hẹp). */
function RowActions({
  item,
  status,
  canExtract,
  onDiscard,
  onRestore,
  onCancel,
  busy,
  align = "end",
}: {
  item: InboxItem;
  status: InboxStatus;
  canExtract: boolean;
  onDiscard: (item: InboxItem) => void;
  onRestore: (item: InboxItem) => void;
  onCancel: (item: InboxItem) => void;
  busy: boolean;
  align?: "start" | "end";
}) {
  const stage = toAiStage(item.stage);
  const queueKind = toQueueKind(item.queueKind);
  return (
    <span className={cn("inline-flex flex-wrap items-start gap-2", align === "end" ? "justify-end" : "justify-start")}>
      {status === "inbox" && (
        <>
          {stage === "ready" && (
            <>
              {canExtract && <ExtractNowButton scope="document" id={item.documentId} force />}
              <ButtonLink size="sm" variant="primary" href={routes.intakeReview(item.documentId)} row>
                Đối chiếu
              </ButtonLink>
            </>
          )}
          {(stage === "failed" || stage === "cancelled") && (
            <>
              {canExtract && <ExtractNowButton scope="document" id={item.documentId} variant="primary" label="Đọc lại" />}
              <ButtonLink size="sm" href={routes.intakeReview(item.documentId)} row>
                Xem
              </ButtonLink>
            </>
          )}
          {stage === "queued" && queueKind !== "priority" && canExtract && <ExtractNowButton scope="document" id={item.documentId} variant="primary" />}
          {stage === "queued" && queueKind === "priority" && <span className="py-1.5 text-xs text-muted">Đã đưa lên đầu hàng</span>}
          {stage === "reading" && <span className="py-1.5 text-xs text-muted">Chờ AI đọc xong</span>}
          {(stage === "queued" || stage === "reading") && item.jobId && (
            <Button size="sm" variant="ghost" onClick={() => onCancel(item)} disabled={busy} aria-label={`Hủy đọc ${item.fileName}`}>
              <CircleStop aria-hidden className="size-4" /> Hủy đọc
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onDiscard(item)} disabled={busy} aria-label={`Bỏ ${item.fileName}`}>
            <Trash2 aria-hidden className="size-4" /> Bỏ
          </Button>
        </>
      )}
      {status === "filed" && (
        <Link href={routes.intakeReview(item.documentId)} className="py-1.5 text-[13px] font-semibold text-primary hover:underline">
          Xem giấy tờ
        </Link>
      )}
      {status === "discarded" && (
        <Button size="sm" onClick={() => onRestore(item)} disabled={busy}>
          <Undo2 aria-hidden className="size-4" /> Hoàn tác
        </Button>
      )}
    </span>
  );
}

const timeFormat = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : timeFormat.format(date);
}
