import type { Instrumentation } from "next";

/**
 * Chạy một lần khi máy chủ Next khởi động: kiểm tra cấu hình để sai thì dừng sớm.
 * onRequestError: mọi lỗi máy chủ (render, Route Handler, Server Action, proxy) đi qua đây
 * và được ghi một dòng JSON có digest — cùng mã người dùng thấy trên màn hình lỗi.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { serverEnv } = await import("./lib/env");
    const { log } = await import("./lib/log");
    const env = serverEnv();
    log.info("web_started", { appEnv: env.appEnv, mock: env.mock, apiConfigured: Boolean(env.apiInternalUrl) });
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { log } = await import("./lib/log");
  const digest = typeof error === "object" && error !== null && "digest" in error ? String((error as { digest: unknown }).digest) : undefined;
  const header = (name: string) => {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  };
  log.error("request_failed", {
    digest,
    error,
    path: request.path.split("?")[0],
    method: request.method,
    correlationId: header("x-correlation-id"),
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
  });
};
