/**
 * Hàng đợi tải PDF lên (FE-21): kiểm tra tệp trước khi gửi và chọn tệp tiếp theo để chạy.
 * Là hàm thuần để kiểm thử được; việc gửi thật nằm ở uploader.tsx.
 */

/** Khớp Limits:UploadMaxBytes của API (200 MB). */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
/** Số tệp tải cùng lúc. */
export const PARALLEL_UPLOADS = 3;

export type UploadStatus = "waiting" | "uploading" | "done" | "duplicate" | "failed" | "cancelled";

export type UploadItem = {
  id: string;
  fileName: string;
  size: number;
  status: UploadStatus;
  /** 0..1 */
  progress: number;
  /** Có khi tải xong. */
  documentId?: string;
  jobId?: string;
  /** Có khi bị từ chối. */
  message?: string;
  /** Bấm "Thử lại" được: lỗi tạm thời hoặc người dùng tự hủy. Lỗi do chính tệp (sai định dạng, trùng) thì không. */
  retryable?: boolean;
  errorId?: string;
  /** Trùng tệp: giấy tờ đã có (chỉ khi người tải thấy được). */
  duplicateDocumentId?: string;
};

/** Trả thông báo lỗi tiếng Việt nếu tệp không nạp được, null nếu hợp lệ. API kiểm tra lại; đây chỉ để báo ngay tại tệp. */
export function checkFile(file: { name: string; size: number; type?: string }): string | null {
  if (!/\.pdf$/i.test(file.name)) return "Chỉ nhận tệp PDF (đuôi .pdf). Xuất lại tệp từ máy quét hoặc phần mềm tạo PDF.";
  if (file.size === 0) return "Tệp rỗng. Quét hoặc xuất lại tệp rồi nạp lại.";
  if (file.size > MAX_UPLOAD_BYTES) return `Tệp ${formatBytes(file.size)} lớn hơn giới hạn ${formatBytes(MAX_UPLOAD_BYTES)}. Nén PDF hoặc chia thành nhiều tệp nhỏ hơn.`;
  return null;
}

/** Các tệp cần bắt đầu tải ngay: giữ tối đa `parallel` tệp đang tải, lấy theo thứ tự chọn. */
export function nextToStart(items: readonly UploadItem[], parallel = PARALLEL_UPLOADS): string[] {
  const running = items.filter((i) => i.status === "uploading").length;
  return items
    .filter((i) => i.status === "waiting")
    .slice(0, Math.max(0, parallel - running))
    .map((i) => i.id);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Đọc `details` của lỗi 409 duplicate_file thành mã giấy tờ cũ (API chỉ trả khi người tải thấy được giấy tờ đó). */
export function duplicateDocumentId(details: unknown): string | undefined {
  if (typeof details !== "object" || details === null) return undefined;
  const id = (details as { documentId?: unknown }).documentId;
  return typeof id === "string" ? id : undefined;
}
