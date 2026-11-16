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
  output: "standalone",
  poweredByHeader: false,
  typedRoutes: true,
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
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
