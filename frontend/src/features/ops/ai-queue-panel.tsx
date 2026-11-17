import { Section } from "@/components/ui/blocks";
import { Chip } from "@/components/ui/status-chip";

/** Khớp phần `byKind` của GET /api/v1/admin/ai/status (BE-99). */
export type QueueByKind = {
  priority: number;
  interactive: number;
  background: number;
  preempted24h: number;
  oldestBackgroundSeconds: number | null;
  secondsPerPage: number | null;
};

function age(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 90) return `${seconds} giây`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} phút`;
  return `${(seconds / 3600).toFixed(1)} giờ`;
}

/** Hàng đợi AI chia theo khay: việc làm ngay, việc có người chờ và khay nền; số lần việc nền nhường chỗ. */
export function AiQueuePanel({ data }: { data: QueueByKind }) {
  const rows = [
    { label: "Làm ngay", hint: "Người dùng bấm Trích xuất ngay", n: data.priority, tone: "info" as const },
    { label: "Có người chờ", hint: "Đọc lại trang, tách văn bản", n: data.interactive, tone: "neutral" as const },
    { label: "Khay nền", hint: "PDF mới nạp, đọc khi máy rảnh", n: data.background, tone: "neutral" as const },
  ];
  return (
    <Section title="Hàng đợi AI theo khay" description="Máy AI chỉ đọc khay nền khi không còn việc làm ngay hoặc có người chờ.">
      <dl className="grid gap-3 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label} className="grid gap-1 border border-line p-3">
            <dt className="text-xs text-muted">{r.hint}</dt>
            <dd className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{r.label}</span>
              <Chip tone={r.n > 0 ? r.tone : "neutral"}>{r.n} việc</Chip>
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-[13px] text-muted">
        Việc nền chờ lâu nhất: <b className="text-ink">{age(data.oldestBackgroundSeconds)}</b> · Nhường chỗ 24 giờ qua:{" "}
        <b className="text-ink">{data.preempted24h} lần</b> · Tốc độ đọc:{" "}
        <b className="text-ink">{data.secondsPerPage == null ? "chưa đủ số đo" : `${data.secondsPerPage} giây/trang`}</b>
      </p>
    </Section>
  );
}
