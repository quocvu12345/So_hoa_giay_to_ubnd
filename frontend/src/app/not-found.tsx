import Link from "next/link";
import { FileQuestion } from "lucide-react";

/**
 * Dùng cho cả đường dẫn sai và bản ghi ngoài phạm vi: không tiết lộ hồ sơ có tồn tại hay không.
 */
export default function NotFound() {
  return (
    <div className="mx-auto my-16 grid max-w-xl justify-items-center gap-3 px-4 text-center">
      <FileQuestion aria-hidden className="size-10 text-muted" />
      <h1 className="text-xl font-bold">Không tìm thấy trang hoặc hồ sơ này</h1>
      <p className="text-muted">
        Đường dẫn có thể đã sai, hồ sơ đã chuyển mã, hoặc hồ sơ không thuộc phạm vi phân công của bạn.
      </p>
      <Link href="/viec-cua-toi" className="inline-flex h-10 items-center border border-primary bg-primary px-4 text-sm font-semibold text-white">
        Về Việc của tôi
      </Link>
    </div>
  );
}
