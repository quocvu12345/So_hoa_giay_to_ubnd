import { defineConfig } from "@playwright/test";

/**
 * FE-10. Hai chế độ:
 * - E2E_MODE=mock (mặc định ở CI): web chạy HOSO_MOCK=1, không cần API; chỉ chạy các spec không gắn nhãn @integration.
 * - E2E_MODE=integration: cần stack thật (scripts/dev-up.sh start): API, worker AI, web, CSDL hoso_dev.
 * Địa chỉ web đổi bằng E2E_BASE_URL.
 */
const integration = process.env.E2E_MODE === "integration";

export default defineConfig({
  testDir: "e2e",
  timeout: integration ? 180_000 : 30_000,
  expect: { timeout: integration ? 30_000 : 5_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  grep: integration ? /@integration/ : undefined,
  grepInvert: integration ? undefined : /@integration/,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "vi-VN",
    trace: "retain-on-failure",
    launchOptions: { executablePath: process.env.E2E_CHROMIUM?.replace(/^~/, process.env.HOME ?? "~") },
    screenshot: "only-on-failure",
  },
});
