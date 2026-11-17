import type { FieldErrors } from "@/lib/api/problem";

/**
 * Kết quả mọi Server Action ghi dữ liệu (FE-07). Lỗi nghiệp vụ là giá trị trả về, không phải ngoại lệ,
 * để form hiện đúng chỗ (dưới ô, cạnh nút) thay vì văng ra trang lỗi.
 */
export type ActionFailure = {
  ok: false;
  message: string;
  /** 401: phiên hết; giao diện chuyển sang đăng nhập và giữ nháp. 409: dữ liệu vừa đổi, nên tải lại. */
  status?: number;
  code?: string;
  /** Mã lỗi để người dùng báo cho quản trị (có khi API lỗi 5xx hoặc ghi nhận lỗi). */
  errorId?: string;
  /** Lỗi theo từng ô, khóa theo tên trường của API (đã đổi chữ đầu thành chữ thường). */
  fieldErrors?: FieldErrors;
  /** Dữ liệu kèm của lỗi nghiệp vụ, ví dụ danh sách trường chưa đối chiếu. */
  details?: unknown;
};

export type ActionResult<T = void> = { ok: true; data: T } | ActionFailure;

/** Khóa lỗi của .NET có thể là "Title" hoặc "title"; thống nhất chữ thường đầu để khớp tên ô. */
export function normalizeFieldErrors(errors: FieldErrors | undefined): FieldErrors | undefined {
  if (!errors) return undefined;
  const out: FieldErrors = {};
  for (const [key, messages] of Object.entries(errors)) out[key.charAt(0).toLowerCase() + key.slice(1)] = messages;
  return out;
}
