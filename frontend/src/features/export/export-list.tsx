"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Chip, type Tone } from "@/components/ui/status-chip";
import { formatDateTime } from "@/lib/format";
import { useServerEvent } from "@/lib/events/server-events";
import type { ExportPackage } from "./export-data";
import { applyProgress, canDownload, EXPORT_FORMATS, EXPORT_STATUS, expiryNote, formatBytes, isRunning, progressFraction, type ProgressEvent } from "./export-rules";

const TONE: Record<string, Tone> = { queued: "info", running: "info", ready: "ok", failed: "bad", expired: "neutral", revoked: "bad" };

/**
 * Các gói xuất gần đây của tôi (FE-38). Gói đang đóng cập nhật tiến độ trực tiếp qua SSE (`export.progress`); khi xong hoặc lỗi thì làm mới trang
 * để lấy mã băm, dung lượng, hạn tải. Tải bằng liên kết thường tới API (phân công theo cookie): API kiểm lại quyền và phạm vi mỗi lần tải.
 */
export function ExportList({ initial, now }: { initial: ExportPackage[]; now: string }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {      // dữ liệu máy chủ mới (sau router.refresh) thay hẳn trạng thái cục bộ
    setPrevInitial(initial);
    setRows(initial);
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  const apply = (payload: { exportId: string; status: string; processed: number; total: number }, settle: boolean) => {
    setRows((current) => applyProgress(current, payload satisfies ProgressEvent));
    if (settle) {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
    }
  };
  useServerEvent("export.progress", (p) => apply(p, false));
  useServerEvent("export.ready", (p) => apply(p, true));
  useServerEvent("export.failed", (p) => apply(p, true));
  useServerEvent("export.expired", (p) => apply(p, true));

  if (rows.length === 0) return <p className="border border-dashed border-line-strong p-4 text-sm text-muted">Chưa có gói xuất nào. Tạo gói ở trên.</p>;
  const clock = new Date(now);

  return (
    <ul className="grid gap-2" aria-label="Gói xuất gần đây">
      {rows.map((p) => {
        const processed = Number(p.processedItems);
        const total = Number(p.totalItems);
        const fraction = progressFraction(processed, total);
        const note = p.status === "ready" ? expiryNote(p.expiresAt, clock) : "";
        return (
          <li key={p.id} className="grid gap-1.5 border border-line bg-surface p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <b>{total.toLocaleString("vi-VN")} hồ sơ</b>
              <Chip tone={TONE[p.status] ?? "neutral"}>{EXPORT_STATUS[p.status] ?? p.status}</Chip>
              <span className="text-xs text-muted">{EXPORT_FORMATS.find((f) => f.value === p.format)?.label ?? p.format} · tạo {formatDateTime(p.createdAt)}</span>
              {canDownload(p.status, p.expiresAt, clock) && (
                <a href={`/api/v1/exports/${p.id}/file`} className={buttonClass("primary", "sm", "ml-auto")} aria-label={`Tải gói xuất tạo ${formatDateTime(p.createdAt)}`}><Download aria-hidden className="size-4" /> Tải gói ({formatBytes(p.byteSize == null ? null : Number(p.byteSize))})</a>
              )}
            </div>
            {isRunning(p.status) && (
              <div className="grid gap-1">
                <progress value={fraction} max={1} className="h-2 w-full" aria-label={`Tiến độ đóng gói ${Math.round(fraction * 100)}%`} />
                <span className="text-xs text-muted">{processed.toLocaleString("vi-VN")}/{total.toLocaleString("vi-VN")} hồ sơ</span>
              </div>
            )}
            {p.error && <p role="alert" className="text-bad">{p.error}</p>}
            {p.status === "ready" && (
              <p className="text-xs text-muted">{note}{p.manifestSha256 ? <> · SHA-256 của danh mục <span className="font-mono break-all">{p.manifestSha256}</span></> : null}</p>
            )}
            {p.status === "expired" && <p className="text-xs text-muted">Gói giữ 7 ngày nên đã bị xóa khỏi kho. Tạo gói mới nếu cần.</p>}
            {p.status === "revoked" && <p className="text-xs text-muted">Gói bị thu hồi vì quyền truy cập thay đổi. Tạo gói mới với các hồ sơ bạn còn quyền.</p>}
          </li>
        );
      })}
    </ul>
  );
}
