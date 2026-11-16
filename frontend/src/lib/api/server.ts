import "server-only";
import { cookies, headers } from "next/headers";
import { ASSIGNMENT_COOKIE, serverEnv } from "@/lib/env";
import { log } from "@/lib/log";

/** Lỗi từ API .NET theo chuẩn ProblemDetails (docs/02-kien-truc-server.md mục 6). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly errorId?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ProblemDetails = {
  type?: string;
  title?: string;
  detail?: string;
  status?: number;
  errorId?: string;
  errors?: unknown;
};

/**
 * Gọi API .NET từ máy chủ Next (Server Component, Server Action, Route Handler).
 * Chuyển tiếp cookie phiên của người dùng và phân công đang dùng; API tự kiểm tra quyền.
 * Không bao giờ gửi token về trình duyệt.
 */
export async function apiFetch<T>(path: `/api/v1/${string}`, init: RequestInit = {}): Promise<T> {
  const { apiInternalUrl, sessionCookie } = serverEnv();
  if (!apiInternalUrl) throw new Error("apiFetch được gọi khi đang chạy dữ liệu mẫu (HOSO_MOCK=1).");

  const cookieStore = await cookies();
  const headerStore = await headers();
  const correlationId = headerStore.get("x-correlation-id") ?? crypto.randomUUID();
  const session = cookieStore.get(sessionCookie)?.value;
  const assignment = cookieStore.get(ASSIGNMENT_COOKIE)?.value;

  const requestHeaders = new Headers(init.headers);
  requestHeaders.set("accept", "application/json");
  requestHeaders.set("x-correlation-id", correlationId);
  if (session) requestHeaders.set("cookie", `${sessionCookie}=${session}`);
  if (assignment) requestHeaders.set("x-assignment-id", assignment);
  // Request từ máy chủ Next không có Origin của trình duyệt; API nhận diện qua header này + mạng nội bộ.
  if (init.method && init.method !== "GET") requestHeaders.set("x-csrf", "1");

  const started = performance.now();
  const response = await fetch(`${apiInternalUrl}${path}`, { ...init, headers: requestHeaders, cache: "no-store" });
  const elapsedMs = Math.round(performance.now() - started);

  if (!response.ok) {
    let problem: ProblemDetails = {};
    try {
      problem = (await response.json()) as ProblemDetails;
    } catch {
      /* Phản hồi không phải JSON, giữ thông báo chung. */
    }
    const code = problem.type?.split("/").pop() ?? `http_${response.status}`;
    const level = response.status >= 500 ? "error" : "warn";
    log[level]("api_call_failed", { path, status: response.status, code, errorId: problem.errorId, correlationId, elapsedMs });
    throw new ApiError(response.status, code, problem.detail ?? problem.title ?? "Không gọi được máy chủ.", problem.errorId, problem.errors);
  }

  log.debug("api_call", { path, status: response.status, correlationId, elapsedMs });
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
