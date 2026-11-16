import type { NextRequest } from "next/server";
import { log } from "@/lib/log";

/**
 * Nhận lỗi từ trình duyệt (instrumentation-client.ts, error.tsx).
 * Giới hạn kích thước và tần suất để không bị dùng làm kênh ghi log tùy ý.
 */
const MAX_BYTES = 8 * 1024;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const counters = new Map<string, { start: number; count: number }>();

function allowed(key: string) {
  const now = Date.now();
  const entry = counters.get(key);
  if (!entry || now - entry.start > WINDOW_MS) {
    counters.set(key, { start: now, count: 1 });
    if (counters.size > 5000) counters.clear();
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return new Response(null, { status: 403 });

  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowed(key)) return new Response(null, { status: 429 });

  const text = await request.text();
  if (text.length > MAX_BYTES) return new Response(null, { status: 413 });

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return new Response(null, { status: 400 });
  }

  log.error("client_error", {
    kind: String(payload.kind ?? "error").slice(0, 40),
    message: payload.message,
    stack: payload.stack,
    digest: payload.digest,
    path: String(payload.path ?? "").slice(0, 300),
    correlationId: request.headers.get("x-correlation-id"),
    userAgent: request.headers.get("user-agent")?.slice(0, 200),
  });
  return new Response(null, { status: 204 });
}
