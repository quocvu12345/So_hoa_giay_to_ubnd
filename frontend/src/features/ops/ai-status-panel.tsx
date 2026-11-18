import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Section } from "@/components/ui/blocks";
import { Chip } from "@/components/ui/status-chip";
import { routes } from "@/config/routes";
import { formatDateTime } from "@/lib/format";
import { AiQueuePanel, type QueueByKind } from "./ai-queue-panel";
import type { AiStatus } from "./ops-data";
import { ageLabel, heartbeatTone } from "./ops-rules";

const n = (v: number | string | null | undefined) => Number(v ?? 0);

/** Tổng quan máy AI (FE-44, BE-88, BE-99, BE-100): số việc, worker đang chạy, tốc độ, mô hình thật sự dùng, việc lỗi gần đây. */
export function AiStatusPanel({ status }: { status: AiStatus }) {
  const { queue, workers, models, throughput, recentFailures } = status;
  const counts = [
    { label: "Đang chờ", value: n(queue.queued), tone: n(queue.queued) > 0 ? "info" : "neutral" },
    { label: "Đang chạy", value: n(queue.running), tone: n(queue.running) > 0 ? "info" : "neutral" },
    { label: "Xong 24 giờ", value: n(queue.completed24h), tone: "ok" },
    { label: "Lỗi 24 giờ", value: n(queue.failed24h), tone: n(queue.failed24h) > 0 ? "bad" : "neutral" },
    { label: "Đã hủy 24 giờ", value: n(queue.cancelled24h), tone: "neutral" },
  ] as const;
  const activeModels = new Set(models.filter((m) => m.active).map((m) => m.key));

  return (
    <div className="grid gap-4">
      {status.modelMismatch && (
        <div role="alert" className="flex items-start gap-2 border border-warn bg-warn-soft p-3 text-sm text-warn">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 flex-none" />
          <p><b>Mô hình đang chạy lệch bảng ghi nhận.</b> {status.modelMismatch}</p>
        </div>
      )}

      <Section title="Hàng đợi AI" description={`Việc chờ lâu nhất: ${ageLabel(status.oldestQueuedSeconds == null ? null : n(status.oldestQueuedSeconds))}.`}>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {counts.map((c) => (
            <div key={c.label} className="grid gap-1 border border-line p-3">
              <dt className="text-xs text-muted">{c.label}</dt>
              <dd><Chip tone={c.tone}>{c.value.toLocaleString("vi-VN")} việc</Chip></dd>
            </div>
          ))}
        </dl>
        <p className="text-[13px] text-muted">
          Một giờ qua: <b className="text-ink">{n(throughput.jobsLastHour)} việc</b>, <b className="text-ink">{n(throughput.pagesLastHour)} trang</b> · Đọc chữ trung bình:{" "}
          <b className="text-ink">{throughput.averageSecondsPerOcrPage == null ? "chưa đủ số đo" : `${n(throughput.averageSecondsPerOcrPage).toLocaleString("vi-VN")} giây/trang`}</b>
        </p>
      </Section>

      {status.byKind && <AiQueuePanel data={{ ...status.byKind, priority: n(status.byKind.priority), interactive: n(status.byKind.interactive), background: n(status.byKind.background), preempted24h: n(status.byKind.preempted24h), oldestBackgroundSeconds: status.byKind.oldestBackgroundSeconds == null ? null : n(status.byKind.oldestBackgroundSeconds), secondsPerPage: status.byKind.secondsPerPage == null ? null : n(status.byKind.secondsPerPage) } satisfies QueueByKind} />}

      <Section title={`Máy đang đọc (${workers.length})`} description="Mỗi worker báo nhịp tim; quá 5 phút không báo thì việc bị thu hồi và xếp lại.">
        {workers.length === 0 ? (
          <p className="text-sm text-muted">Không có worker nào đang chạy việc. Việc mới nạp sẽ chờ tới khi máy AI nhận.</p>
        ) : (
          <ul className="grid divide-y divide-line border border-line" aria-label="Worker AI">
            {workers.map((w) => (
              <li key={w.jobId} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <span className="font-semibold">{w.workerId}</span>
                <Chip>{w.stage ?? "đang chuẩn bị"}</Chip>
                <Chip tone={heartbeatTone(n(w.heartbeatAgeSeconds))}>{n(w.heartbeatAgeSeconds) < 0 ? "Chưa có nhịp tim" : `Nhịp tim ${ageLabel(n(w.heartbeatAgeSeconds))} trước`}</Chip>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Mô hình" description="Bảng ai_models ghi mô hình dự kiến; cột 'đã dùng' lấy từ các việc xong trong 24 giờ qua.">
        <ul className="grid gap-2" aria-label="Mô hình AI">
          {models.map((m) => (
            <li key={m.key} className="grid gap-0.5 border border-line p-2.5 text-sm">
              <span className="flex flex-wrap items-center gap-2"><b>{m.key}</b><Chip tone={m.active ? "ok" : "neutral"}>{m.active ? "Đang bật" : "Tắt"}</Chip><span className="text-xs text-muted">{m.purpose}</span></span>
              <span className="font-mono text-xs break-all text-muted">{m.repo}@{m.revision.slice(0, 12)}</span>
            </li>
          ))}
        </ul>
        {(status.runningModels?.length ?? 0) > 0 && (
          <div className="grid gap-1">
            <h3 className="text-sm font-bold">Đã dùng thực tế 24 giờ qua</h3>
            <ul className="grid gap-1 text-[13px]" aria-label="Mô hình đã dùng">
              {status.runningModels!.map((r) => (
                <li key={r.modelVersion} className="break-all"><span className="font-mono">{r.modelVersion}</span> · {n(r.jobs)} việc · gần nhất {formatDateTime(r.lastFinishedAt)}</li>
              ))}
            </ul>
          </div>
        )}
        {activeModels.size === 0 && <p className="text-sm text-muted">Chưa có mô hình nào được đánh dấu đang bật.</p>}
      </Section>

      <Section title="Việc lỗi gần đây">
        {recentFailures.length === 0 ? (
          <p className="text-sm text-muted">Không có việc lỗi.</p>
        ) : (
          <>
            <ul className="grid divide-y divide-line border border-line" aria-label="Việc lỗi gần đây">
              {recentFailures.slice(0, 5).map((f) => (
                <li key={f.jobId} className="grid gap-0.5 px-3 py-2 text-sm">
                  <span className="font-semibold break-all">{f.fileName}</span>
                  <span className="text-bad">{f.error ?? "Không có thông báo lỗi"}</span>
                  <span className="text-xs text-muted">{n(f.attempts)} lần thử · {formatDateTime(f.finishedAt)}</span>
                </li>
              ))}
            </ul>
            <Link href={`${routes.adminOperations}?muc=viec&trang-thai=failed` as "/quan-tri/van-hanh"} className="text-sm text-primary hover:underline">Xem tất cả việc lỗi và chạy lại →</Link>
          </>
        )}
      </Section>
    </div>
  );
}
