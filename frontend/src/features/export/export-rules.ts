/** Quy tắc thuần cho xuất gói bàn giao (FE-38, BE-86): nhãn, kiểm tra điều kiện lọc, tiến độ, hạn tải. */

export const MAX_DOSSIERS = 2000;

export const EXPORT_STATUS: Record<string, string> = {
  queued: "Đang chờ", running: "Đang đóng gói", ready: "Sẵn sàng tải", failed: "Bị lỗi", expired: "Đã hết hạn", revoked: "Đã thu hồi",
};
export const EXPORT_FORMATS = [
  { value: "zip_pdf_json", label: "ZIP: PDF + siêu dữ liệu JSON", hint: "Mỗi hồ sơ một thư mục PDF, kèm metadata.json cho máy đọc." },
  { value: "zip_pdf_csv", label: "ZIP: PDF + danh mục CSV", hint: "Danh mục hồ sơ dạng bảng mở được bằng Excel." },
] as const;
/** Trạng thái hồ sơ cho phép lọc khi xuất (khớp `workflow_states`). */
export const DOSSIER_STATUS_CHOICES = [
  { value: "archived", label: "Đã lưu trữ" }, { value: "ready_archive", label: "Chờ tiếp nhận nộp lưu" }, { value: "draft", label: "Đang chuẩn bị" },
  { value: "returned", label: "Yêu cầu bổ sung" }, { value: "department_review", label: "Chờ trưởng phòng / Ban" }, { value: "leadership_review", label: "Chờ lãnh đạo" },
] as const;

export type ExportForm = { status: string; workGroupCode: string; archivedFrom: string; archivedTo: string; format: string };
export type ExportErrors = Partial<Record<keyof ExportForm | "scope", string>>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Phải có ít nhất một điều kiện lọc (API từ chối xuất "mọi thứ"); ngày đúng dạng và từ ≤ đến. */
export function validateExportForm(form: ExportForm): ExportErrors {
  const errors: ExportErrors = {};
  if (!form.status && !form.workGroupCode && !form.archivedFrom && !form.archivedTo) errors.scope = "Chọn ít nhất một điều kiện: trạng thái, nhóm hồ sơ hoặc khoảng thời gian lưu trữ.";
  if (form.archivedFrom && !ISO_DATE.test(form.archivedFrom)) errors.archivedFrom = "Ngày bắt đầu không hợp lệ.";
  if (form.archivedTo && !ISO_DATE.test(form.archivedTo)) errors.archivedTo = "Ngày kết thúc không hợp lệ.";
  if (!errors.archivedFrom && !errors.archivedTo && form.archivedFrom && form.archivedTo && form.archivedTo < form.archivedFrom) errors.archivedTo = "Ngày kết thúc phải từ ngày bắt đầu trở đi.";
  if (!EXPORT_FORMATS.some((f) => f.value === form.format)) errors.format = "Chọn định dạng gói.";
  return errors;
}

export function toExportRequest(form: ExportForm) {
  return { dossierIds: null, status: form.status || null, workGroupCode: form.workGroupCode || null, archivedFrom: form.archivedFrom || null, archivedTo: form.archivedTo || null, format: form.format };
}

/** Còn đang chạy (chờ hoặc đóng gói): cần theo dõi tiến độ. */
export function isRunning(status: string): boolean {
  return status === "queued" || status === "running";
}

/** Tiến độ 0..1; chưa biết tổng thì 0. */
export function progressFraction(processed: number, total: number): number {
  if (!Number.isFinite(processed) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(1, Math.max(0, processed / total));
}

/** "Còn 6 ngày", "Hết hạn hôm nay", "Đã hết hạn"; gói chưa có hạn thì rỗng. */
export function expiryNote(expiresAt: string | null | undefined, now: Date = new Date()): string {
  if (!expiresAt) return "";
  const end = Date.parse(expiresAt);
  if (Number.isNaN(end)) return "";
  const ms = end - now.getTime();
  if (ms <= 0) return "Đã hết hạn";
  const days = Math.ceil(ms / 86_400_000);
  return days <= 1 ? "Hết hạn trong hôm nay hoặc ngày mai" : `Còn ${days} ngày để tải`;
}

/** Gói tải được khi sẵn sàng và chưa quá hạn (API vẫn kiểm lại mỗi lần tải: quyền và phạm vi hồ sơ). */
export function canDownload(status: string, expiresAt: string | null | undefined, now: Date = new Date()): boolean {
  if (status !== "ready") return false;
  return !expiresAt || Date.parse(expiresAt) > now.getTime();
}

export type ProgressEvent = { exportId: string; status: string; processed: number; total: number };

/** Gộp sự kiện SSE vào danh sách: chỉ đổi gói đã có, không bao giờ lùi tiến độ của gói đang chạy. */
export function applyProgress<T extends { id: string; status: string; processedItems: number | string; totalItems: number | string }>(rows: readonly T[], event: ProgressEvent): T[] {
  return rows.map((r) => {
    if (r.id !== event.exportId) return r;
    const processed = Math.max(Number(r.processedItems), event.processed);
    return { ...r, status: event.status, processedItems: processed, totalItems: event.total > 0 ? event.total : r.totalItems };
  });
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value.toFixed(value >= 100 ? 0 : 1).replace(".", ",")} ${units[i]}`;
}
