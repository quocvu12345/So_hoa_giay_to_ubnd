"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { browserHeaders } from "@/lib/api/client";
import { createSseParser } from "./sse-parser";

/**
 * FE-08. Một luồng SSE duy nhất tới GET /api/v1/events cho cả ứng dụng (đặt trong khung trang, không mở lại khi chuyển trang).
 * API chỉ gửi sự kiện của chính người dùng hoặc trong phạm vi phân công; ở đây chỉ phát lại cho các màn đang nghe.
 * Đọc bằng fetch + bộ đọc SSE riêng (sse-parser.ts) vì EventSource không gửi được header X-Assignment-Id.
 * Tự nối lại (1→30 giây), gửi Last-Event-ID để API phát bù, và phát `resync` sau khi nối lại để màn tải lại dữ liệu đã lỡ.
 */

export type ServerEventMap = {
  "job.progress": { jobId: string; documentId: string | null; stage?: string | null; processed?: number; pageCount?: number | null; status?: string };
  "job.completed": { jobId: string; documentId: string | null; status: string };
  "job.failed": { jobId: string; documentId: string | null; status: string };
  "job.cancelled": { jobId: string; documentId: string | null; status: string };
  "notification.created": { id: string; kind: string };
  "dossier.changed": { dossierId: string; status: string | null };
  "export.progress": { exportId: string; status: string; processed: number; total: number };
  "export.ready": { exportId: string; status: string; processed: number; total: number };
  "export.failed": { exportId: string; status: string; processed: number; total: number };
  "export.expired": { exportId: string; status: string; processed: number; total: number };
  /** API báo đã mất kết nối CSDL rồi nối lại, hoặc trình duyệt vừa nối lại sau khi mất mạng: tải lại dữ liệu đã lỡ. */
  resync: { reason?: string };
};
export type ServerEventType = keyof ServerEventMap;

export const SERVER_EVENT_TYPES: ServerEventType[] = [
  "job.progress", "job.completed", "job.failed", "job.cancelled", "notification.created", "dossier.changed",
  "export.progress", "export.ready", "export.failed", "export.expired", "resync",
];

export type ConnectionStatus = "disabled" | "connecting" | "open" | "offline";

type Listener = (payload: unknown) => void;
type EventsContext = { status: ConnectionStatus; subscribe: (type: ServerEventType, listener: Listener) => () => void };

const Context = createContext<EventsContext | null>(null);

/** Nối lại sau 1, 2, 4… tối đa 30 giây khi trình duyệt đã bỏ cuộc (ví dụ API trả 401 hoặc đang khởi động lại). */
export function reconnectDelayMs(attempt: number): number {
  return Math.min(30_000, 1000 * 2 ** Math.max(0, attempt));
}

/** Quá chừng này không nhận được byte nào (API gửi nhịp tim mỗi 25 giây) thì coi như kết nối treo và nối lại. */
const STALL_MS = 70_000;

export function ServerEventsProvider({ enabled, assignmentId, children }: { enabled: boolean; assignmentId: string | null; children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>(enabled ? "connecting" : "disabled");
  const listeners = useRef(new Map<ServerEventType, Set<Listener>>());

  const subscribe = useCallback<EventsContext["subscribe"]>((type, listener) => {
    const set = listeners.current.get(type) ?? new Set<Listener>();
    set.add(listener);
    listeners.current.set(type, set);
    return () => {
      set.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let wasOffline = false;
    let lastEventId: string | null = null;
    let current: AbortController | null = null;
    let wake: (() => void) | null = null;

    const emit = (type: ServerEventType, payload: unknown) => {
      for (const listener of listeners.current.get(type) ?? []) listener(payload);
    };
    const known = new Set<string>(SERVER_EVENT_TYPES);

    /** Chờ giữa hai lần nối; có mạng trở lại hoặc quay lại tab thì đánh thức để nối ngay. */
    const pause = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms);
        wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });

    async function run() {
      let attempt = 0;
      let serverRetry = 0;
      while (!disposed) {
        const controller = new AbortController();
        current = controller;
        let lastByteAt = Date.now();
        const watchdog = setInterval(() => {
          if (Date.now() - lastByteAt > STALL_MS) controller.abort();
        }, 15_000);
        try {
          // Dùng fetch thay EventSource để gắn được header X-Assignment-Id (EventSource không cho đặt header).
          const response = await fetch("/api/v1/events", {
            headers: { Accept: "text/event-stream", ...browserHeaders(assignmentId), ...(lastEventId ? { "Last-Event-ID": lastEventId } : {}) },
            signal: controller.signal,
            cache: "no-store",
            credentials: "same-origin",
          });
          if (!response.ok || !response.body) throw new Error(`events_http_${response.status}`);
          attempt = 0;
          setStatus("open");
          if (wasOffline) {
            wasOffline = false;
            emit("resync", { reason: "reconnected" });
          }
          const parser = createSseParser(
            (message) => {
              if (!known.has(message.event)) return;
              try {
                emit(message.event as ServerEventType, JSON.parse(message.data));
              } catch {
                /* Sự kiện hỏng không được làm sập luồng. */
              }
            },
            (ms) => {
              serverRetry = ms;
            },
          );
          const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            lastByteAt = Date.now();
            parser.push(value);
            lastEventId = parser.lastEventId() ?? lastEventId;
          }
        } catch {
          /* Mất mạng, API khởi động lại, 401, hoặc bị hủy khi đóng trang: xử lý chung bên dưới. */
        } finally {
          clearInterval(watchdog);
        }
        if (disposed) return;
        wasOffline = true;
        setStatus("offline");
        await pause(Math.max(serverRetry, reconnectDelayMs(attempt++)));
      }
    }

    const retryNow = () => wake?.();
    const onVisible = () => document.visibilityState === "visible" && retryNow();
    void run();
    window.addEventListener("online", retryNow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      current?.abort();
      wake?.();
      window.removeEventListener("online", retryNow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, assignmentId]);

  const value = useMemo(() => ({ status, subscribe }), [status, subscribe]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Trạng thái kết nối để hiện chỉ báo. */
export function useConnectionStatus(): ConnectionStatus {
  return useContext(Context)?.status ?? "disabled";
}

/** Nghe một loại sự kiện trong khi component còn trên màn hình. `handler` có thể đổi mỗi lần render, không làm đăng ký lại. */
export function useServerEvent<T extends ServerEventType>(type: T, handler: (payload: ServerEventMap[T]) => void): void {
  const context = useContext(Context);
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  const subscribe = context?.subscribe;
  useEffect(() => {
    if (!subscribe) return;
    return subscribe(type, (payload) => latest.current(payload as ServerEventMap[T]));
  }, [subscribe, type]);
}
