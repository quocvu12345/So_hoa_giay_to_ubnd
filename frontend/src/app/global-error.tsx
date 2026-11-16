"use client";

import "./globals.css";
import { ErrorPanel } from "@/components/ui/error-panel";

/** Lỗi ở layout gốc: thay cả trang nên phải tự có thẻ html, body. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="vi">
      <body>
        <title>Lỗi · Hồ sơ số</title>
        <ErrorPanel error={error} retry={retry} />
      </body>
    </html>
  );
}
