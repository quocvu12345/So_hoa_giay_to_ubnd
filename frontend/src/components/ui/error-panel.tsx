"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * Màn lỗi dùng chung cho error.tsx: nói rõ chuyện gì xảy ra, có MÃ LỖI để báo quản trị,
 * nút Thử lại và đường về Việc của tôi. Không hiện chi tiết kỹ thuật cho người dùng.
 * Lỗi từ API mang mã lỗi của API (`ApiError.digest`), nên quản trị tra ngay ở Nhật ký hệ thống.
 */
export function ErrorPanel({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

  const [copied, setCopied] = useState(false);
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);       // không có quyền clipboard: người dùng vẫn chọn và chép tay được (mã có select-all)
    }
  }

  useEffect(() => {
    // Lỗi từ Server Component đã được onRequestError ghi kèm digest; lỗi phía trình duyệt thì gửi về đây.
    if (!digest) window.__hosoReport?.("boundary", error);
  }, [digest, error]);

  return (
    <div role="alert" className="mx-4 my-6 grid max-w-2xl gap-3 border border-bad/40 bg-surface p-5 sm:mx-6">
      <p className="flex items-center gap-2 text-lg font-bold text-bad">
        <AlertTriangle aria-hidden className="size-5" /> Chưa tải được nội dung này
      </p>
      <p className="text-sm text-ink">
        Hệ thống đã ghi lại lỗi. Bạn có thể thử lại; nếu vẫn lỗi, gửi mã bên dưới cho quản trị (Quản trị › Nhật ký hệ thống › Mã lỗi) để tra cứu nhanh.
      </p>
      {digest && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span>Mã lỗi: <code className="bg-soft px-1.5 py-0.5 font-mono select-all">{digest}</code></span>
          <button type="button" onClick={() => void copy(digest)} className="border border-line-strong px-2 py-0.5 text-xs font-semibold hover:border-primary">
            Sao chép mã
          </button>
          <span role="status" className="text-xs text-muted">{copied ? "Đã sao chép" : ""}</span>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => retry()} className="h-10 border border-primary bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover">
          Thử lại
        </button>
        <Link href="/viec-cua-toi" className="inline-flex h-10 items-center border border-line-strong px-4 text-sm font-semibold hover:border-primary">
          Về Việc của tôi
        </Link>
      </div>
    </div>
  );
}
