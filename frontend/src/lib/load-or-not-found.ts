import "server-only";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api/problem";

/** Bản ghi ngoài phạm vi (404) hoặc mã sai dạng (400) đều trả "Không tìm thấy", không tiết lộ bản ghi có tồn tại. Lỗi khác ném tiếp. */
export async function loadOrNotFound<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
}
