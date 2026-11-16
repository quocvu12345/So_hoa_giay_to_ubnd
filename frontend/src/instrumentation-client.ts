/**
 * Bắt lỗi JavaScript phía trình duyệt và gửi về /client-log (máy chủ Next ghi log JSON).
 * Giới hạn 10 lỗi mỗi lần tải trang để không làm ngập log khi lỗi lặp.
 */
let sent = 0;

function report(kind: string, error: unknown, extra?: Record<string, unknown>) {
  if (sent >= 10) return;
  sent += 1;
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const body = JSON.stringify({
      kind,
      message: err.message.slice(0, 500),
      stack: err.stack?.slice(0, 4000),
      digest: (err as Error & { digest?: string }).digest,
      path: location.pathname,
      ...extra,
    });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/client-log", blob)) {
      void fetch("/client-log", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
    }
  } catch {
    /* Ghi log lỗi không được phép gây lỗi mới. */
  }
}

window.addEventListener("error", (event) => report("error", event.error ?? event.message));
window.addEventListener("unhandledrejection", (event) => report("unhandledrejection", event.reason));

window.__hosoReport = report;
