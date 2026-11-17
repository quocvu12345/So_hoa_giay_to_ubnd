"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useServerEvent, type ServerEventType } from "@/lib/events/server-events";

const DELAY_MS = 600;

/**
 * Làm mới dữ liệu của trang (router.refresh) khi có sự kiện liên quan qua SSE, dồn nhiều sự kiện liên tiếp thành một lần.
 * Đặt trong trang cần "tự cập nhật" mà không phải tải lại (Việc của tôi, v.v.). Không hiển thị gì.
 */
export function RefreshOnEvents({ events }: { events: ServerEventType[] }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), DELAY_MS);
  }, [router]);
  useEffect(() => () => clearTimeout(timer.current), []);

  useServerEvent("dossier.changed", () => events.includes("dossier.changed") && schedule());
  useServerEvent("notification.created", () => events.includes("notification.created") && schedule());
  useServerEvent("job.completed", () => events.includes("job.completed") && schedule());
  useServerEvent("resync", () => events.includes("resync") && schedule());
  return null;
}
