import "server-only";

/**
 * Ghi log JSON một dòng ra stdout để Promtail/Vector gom về Loki (docs/06-log-va-giam-sat.md).
 * Không ghi nội dung giấy tờ, cookie, token hoặc số định danh cá nhân.
 */
type Level = "debug" | "info" | "warn" | "error";

const REDACT_KEYS = /authorization|cookie|token|password|secret|cccd|cmnd|so_dinh_danh|identity_number/i;
const MAX_STRING = 2000;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[…]";
  if (typeof value === "string") return value.length > MAX_STRING ? value.slice(0, MAX_STRING) + "…" : value;
  if (value instanceof Error) {
    return { name: value.name, message: sanitize(value.message, depth + 1), stack: sanitize(value.stack, depth + 1) };
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      out[key] = REDACT_KEYS.test(key) ? "[đã ẩn]" : sanitize(v, depth + 1);
    }
    return out;
  }
  return value;
}

function write(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service: "hoso-web",
    env: process.env.HOSO_ENV ?? "development",
    event,
    ...(sanitize(fields) as Record<string, unknown>),
  });
  // console.* ghi ra stdout/stderr khi chạy Node và vẫn hoạt động nếu đoạn mã bị biên dịch cho Edge.
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const log = {
  debug: (event: string, fields?: Record<string, unknown>) => {
    if (process.env.HOSO_LOG_LEVEL === "debug") write("debug", event, fields);
  },
  info: (event: string, fields?: Record<string, unknown>) => write("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write("error", event, fields),
};
