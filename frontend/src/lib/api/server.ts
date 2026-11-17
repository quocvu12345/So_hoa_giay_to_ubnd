import "server-only";
import { cookies, headers } from "next/headers";
import createClient from "openapi-fetch";
import type { paths } from "@/api/schema";
import { ASSIGNMENT_COOKIE, serverEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { ApiError, problemFrom } from "./problem";
import { requestState } from "./request-state";

export { ApiError } from "./problem";

/**
 * Gửi một request tới API .NET từ máy chủ Next (Server Component, Server Action, Route Handler).
 * Chuyển tiếp cookie phiên của người dùng và phân công đang dùng; API tự kiểm tra quyền.
 * Không bao giờ gửi token về trình duyệt. Mọi phản hồi không thành công đều thành ApiError.
 */
async function send(request: Request): Promise<Response> {
  const { sessionCookie } = serverEnv();
  const cookieStore = await cookies();
  const headerStore = await headers();
  const correlationId = headerStore.get("x-correlation-id") ?? crypto.randomUUID();
  const session = cookieStore.get(sessionCookie)?.value;
  const assignment = cookieStore.get(ASSIGNMENT_COOKIE)?.value;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-correlation-id", correlationId);
  if (!requestHeaders.has("accept")) requestHeaders.set("accept", "application/json");
  if (session) requestHeaders.set("cookie", `${sessionCookie}=${session}`);
  if (assignment && !requestState().dropAssignment) requestHeaders.set("x-assignment-id", assignment);
  // Request từ máy chủ Next không có Origin của trình duyệt; API nhận diện qua header này + mạng nội bộ.
  if (request.method !== "GET" && request.method !== "HEAD") requestHeaders.set("x-csrf", "1");

  const path = new URL(request.url).pathname;
  const started = performance.now();
  const response = await fetch(new Request(request, { headers: requestHeaders, cache: "no-store" }));
  const elapsedMs = Math.round(performance.now() - started);

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      /* Phản hồi không phải JSON, giữ thông báo chung. */
    }
    const problem = problemFrom(response.status, body);
    const level = response.status >= 500 ? "error" : "warn";
    log[level]("api_call_failed", { path, status: response.status, code: problem.code, errorId: problem.errorId, correlationId, elapsedMs });
    throw new ApiError(problem);
  }

  log.debug("api_call", { path, status: response.status, correlationId, elapsedMs });
  return response;
}

function baseUrl(): string {
  const { apiInternalUrl } = serverEnv();
  if (!apiInternalUrl) throw new Error("API được gọi khi đang chạy dữ liệu mẫu (HOSO_MOCK=1).");
  return apiInternalUrl;
}

/** Gọi API với đường dẫn do tay viết. Ưu tiên dùng `serverApi()` để có kiểu theo openapi.json. */
export async function apiFetch<T>(path: `/api/v1/${string}`, init: RequestInit = {}): Promise<T> {
  const response = await send(new Request(`${baseUrl()}${path}`, init));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/**
 * Client có kiểu sinh từ openapi.json (FE-06): đổi tên trường hoặc đường dẫn ở API thì chỗ gọi lỗi biên dịch.
 * Lỗi HTTP ném ApiError nên `data` luôn có giá trị khi gọi xong; dùng `ok()` để lấy ra.
 */
export function serverApi() {
  return createClient<paths>({ baseUrl: baseUrl(), fetch: (request) => send(request) });
}

/** Lấy `data` của kết quả openapi-fetch. Lỗi HTTP đã ném sẵn; 204 không có nội dung trả về undefined. */
export function ok<T>(result: { data?: T }): T {
  return result.data as T;
}
