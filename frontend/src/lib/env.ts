import "server-only";

/**
 * Biến môi trường phía máy chủ. Không biến nào ở đây được lộ ra trình duyệt
 * (không dùng tiền tố NEXT_PUBLIC_).
 */
type AppEnv = "development" | "staging" | "production";

function readEnv(): {
  appEnv: AppEnv;
  mock: boolean;
  apiInternalUrl: string | null;
  sessionCookie: string;
} {
  const appEnv = (process.env.HOSO_ENV ?? "development") as AppEnv;
  if (!["development", "staging", "production"].includes(appEnv)) {
    throw new Error(`HOSO_ENV không hợp lệ: "${appEnv}". Dùng development, staging hoặc production.`);
  }
  const mock = process.env.HOSO_MOCK === "1";
  if (mock && appEnv === "production") {
    throw new Error("HOSO_MOCK=1 không được bật khi HOSO_ENV=production.");
  }
  const apiInternalUrl = process.env.HOSO_API_INTERNAL_URL?.replace(/\/$/, "") ?? null;
  if (!mock && !apiInternalUrl) {
    throw new Error("Thiếu HOSO_API_INTERNAL_URL (ví dụ http://localhost:5080). Hoặc đặt HOSO_MOCK=1 để chạy với dữ liệu mẫu.");
  }
  return {
    appEnv,
    mock,
    apiInternalUrl,
    sessionCookie: process.env.HOSO_SESSION_COOKIE ?? "__Host-hoso",
  };
}

let cached: ReturnType<typeof readEnv> | null = null;

/** Đọc và kiểm tra lúc chạy (không lúc build), sai cấu hình thì dừng với thông báo rõ. */
export function serverEnv() {
  cached ??= readEnv();
  return cached;
}

/** Cookie phiên giả lập, chỉ tồn tại khi HOSO_MOCK=1. */
export const MOCK_USER_COOKIE = "hoso_mock_user";
/** Phân công đang dùng; không nhạy cảm vì API luôn kiểm tra lại. */
export const ASSIGNMENT_COOKIE = "hoso_assignment";
