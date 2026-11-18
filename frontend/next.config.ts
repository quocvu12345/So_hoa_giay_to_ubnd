import type { NextConfig } from "next";

/**
 * Ứng dụng nội bộ: trang nào cũng cần đăng nhập và lọc theo phạm vi phân công.
 * Không bật cacheComponents để tránh vô tình cache dữ liệu của người dùng này cho người khác.
 * Header CSP có nonce đặt trong src/proxy.ts; các header tĩnh còn lại đặt ở đây.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Thư mục build riêng cho máy chủ giả lập của E2E (NEXT_DIST_DIR=.next-mock): Next không cho hai `next dev` cùng thư mục .next chạy một lúc.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  poweredByHeader: false,
  typedRoutes: true,
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  /**
   * Khi dev, Next nén gzip mọi phản hồi, kể cả luồng SSE `/api/v1/events` đi qua phép chuyển tiếp bên dưới: bộ nén giữ byte lại nên sự kiện
   * (chuông thông báo, tiến độ job) tới trễ hoặc không tới. Khi triển khai Caddy đứng trước và định tuyến /api/* thẳng tới API nên không bị;
   * giữ nén của Next cho trang ở đó.
   */
  compress: process.env.NODE_ENV === "production",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  /**
   * Khi dev: trình duyệt gọi /api/* cùng origin, Next chuyển tiếp sang API .NET để cookie phiên
   * dùng chung một origin. Khi triển khai, Caddy định tuyến /api/* thẳng tới API, không qua Next.
   */
  async rewrites() {
    const api = process.env.HOSO_API_INTERNAL_URL;
    if (process.env.HOSO_MOCK === "1" || !api) return [];
    return [{ source: "/api/:path*", destination: `${api.replace(/\/$/, "")}/api/:path*` }];
  },
};

export default nextConfig;
