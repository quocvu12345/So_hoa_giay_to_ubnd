import createClient from "openapi-fetch";
import type { components, paths } from "@/api/schema";
import { problemFrom, type Problem } from "./problem";

/**
 * Client chạy trong trình duyệt (FE-06). Chỉ dùng cho tải tệp lên và theo dõi tiến độ;
 * mọi thao tác ghi khác đi qua Server Action (docs/tasks/frontend.md, mục Quy ước chung).
 * Gọi cùng origin: dev qua rewrite của Next, production qua Caddy. Cookie phiên tự gửi, header X-CSRF chặn gọi chéo trang.
 */
export function createBrowserApi(assignmentId: string | null) {
  return createClient<paths>({ baseUrl: "", headers: browserHeaders(assignmentId), credentials: "same-origin" });
}

/** Header cho mọi lệnh gọi API trực tiếp từ trình duyệt: chống gọi chéo trang và chọn đúng phân công. */
export function browserHeaders(assignmentId: string | null): Record<string, string> {
  return { "X-CSRF": "1", ...(assignmentId ? { "X-Assignment-Id": assignmentId } : {}) };
}

export type UploadResult = components["schemas"]["UploadResult"];

export type UploadOutcome =
  | { kind: "done"; result: UploadResult }
  | { kind: "failed"; problem: Problem }
  | { kind: "cancelled" };

/**
 * Tải một PDF lên POST /api/v1/intake/files bằng XHR (fetch chưa có tiến độ tải lên).
 * Không bao giờ ném lỗi: kết quả là done, failed (kèm Problem của API) hoặc cancelled.
 */
export function uploadPdf(file: File, options: { assignmentId: string | null; batchId?: string | null; onProgress?: (fraction: number) => void; signal?: AbortSignal }): Promise<UploadOutcome> {
  return new Promise((resolve) => {
    if (options.signal?.aborted) return resolve({ kind: "cancelled" });
    const form = new FormData();
    form.append("file", file, file.name);
    if (options.batchId) form.append("batchId", options.batchId);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/v1/intake/files");
    for (const [name, value] of Object.entries(browserHeaders(options.assignmentId))) xhr.setRequestHeader(name, value);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.responseType = "text";
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) options.onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      let body: unknown;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = undefined;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve({ kind: "done", result: body as UploadResult });
      else resolve({ kind: "failed", problem: problemFrom(xhr.status, body) });
    };
    xhr.onerror = () =>
      resolve({ kind: "failed", problem: { status: 0, code: "network", message: "Mất kết nối khi tải lên. Kiểm tra mạng rồi bấm Thử lại." } });
    xhr.ontimeout = xhr.onerror;
    xhr.onabort = () => resolve({ kind: "cancelled" });
    options.signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}
