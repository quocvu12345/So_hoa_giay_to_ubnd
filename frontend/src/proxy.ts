import { NextResponse, type NextRequest } from "next/server";

/**
 * Chạy trước mọi trang (Next 16 đổi tên middleware thành proxy):
 * 1. Gắn mã tương quan x-correlation-id để nối log trình duyệt → Next → API .NET → PostgreSQL.
 * 2. Đặt CSP có nonce riêng cho từng request.
 * 3. Kiểm tra lạc quan: không có cookie phiên thì chuyển sang /dang-nhap.
 *    Đây KHÔNG phải kiểm tra quyền; quyền luôn kiểm tra ở API và ở lớp session.ts.
 */
const PUBLIC_PATHS = ["/dang-nhap", "/client-log"];
const SESSION_COOKIE = process.env.HOSO_SESSION_COOKIE ?? "__Host-hoso";
const MOCK_COOKIE = "hoso_mock_user";

function buildCsp(nonce: string, isDev: boolean) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasSession = request.cookies.has(SESSION_COOKIE) || request.cookies.has(MOCK_COOKIE);
  if (!isPublic && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/dang-nhap";
    url.search = pathname === "/" ? "" : `?tiep=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("x-correlation-id", correlationId);
    return redirect;
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-correlation-id", correlationId);
  requestHeaders.set("x-pathname", pathname + search);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-correlation-id", correlationId);
  return response;
}

export const config = {
  matcher: [
    {
      // Bỏ qua /api (API .NET qua reverse proxy), tệp tĩnh và tệp tối ưu ảnh.
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
