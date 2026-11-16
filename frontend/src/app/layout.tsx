import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Hồ sơ số", template: "%s · Hồ sơ số" },
  description: "Số hóa và quản lý hồ sơ UBND, HĐND phường Từ Liêm",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
