/** Quy tắc thuần cho màn Vận hành (FE-44): nhãn tiếng Việt, ngưỡng cảnh báo, kiểm tra giá trị cài đặt. */

export const JOB_TYPE_LABELS: Record<string, string> = {
  read_classify: "Đọc và phân loại", reclassify: "Phân loại lại", reread_page: "Đọc lại một trang",
};
export const JOB_STATUS_LABELS: Record<string, string> = { queued: "Chờ đọc", running: "Đang đọc", completed: "Đã xong", failed: "Lỗi", cancelled: "Đã hủy" };
export const PRIORITY_KIND_LABELS: Record<string, string> = { priority: "Làm ngay", interactive: "Có người chờ", background: "Khay nền" };

/** Bộ lọc danh sách việc AI (khớp `status` của API) và nhãn tab. Mặc định: việc đang chờ hoặc chạy. */
export const JOB_FILTERS = [
  { value: "active", label: "Đang chờ / chạy" },
  { value: "failed", label: "Lỗi" },
  { value: "cancelled", label: "Đã hủy" },
  { value: "completed", label: "Đã xong" },
  { value: "all", label: "Tất cả" },
] as const;
export type JobFilter = (typeof JOB_FILTERS)[number]["value"];

export function parseJobFilter(value: unknown): JobFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return JOB_FILTERS.find((f) => f.value === v)?.value ?? "active";
}

/** Giá trị gửi cho API: "all" là không lọc. */
export function jobStatusParam(filter: JobFilter): string | undefined {
  return filter === "all" ? undefined : filter;
}

/** "45 giây", "12 phút", "1,5 giờ", "2,3 ngày"; thiếu thì "—". */
export function ageLabel(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 90) return `${Math.round(seconds)} giây`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} phút`;
  if (seconds < 129_600) return `${(seconds / 3600).toFixed(1).replace(".", ",")} giờ`;
  return `${(seconds / 86_400).toFixed(1).replace(".", ",")} ngày`;
}

/** Worker báo nhịp tim mỗi vài giây; >2 phút chậm, >5 phút coi như treo (StaleJobReaper thu hồi ở 5 phút). */
export function heartbeatTone(seconds: number): "ok" | "warn" | "bad" {
  if (seconds < 0) return "warn";           // API trả -1 khi chưa có nhịp tim
  if (seconds > 300) return "bad";
  if (seconds > 120) return "warn";
  return "ok";
}

export const BACKUP_KIND_LABELS: Record<string, string> = { database: "Cơ sở dữ liệu", files: "Kho tệp", config: "Cấu hình" };
export const BACKUP_STATUS_LABELS: Record<string, string> = { running: "Đang chạy", succeeded: "Thành công", failed: "Thất bại" };

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value.toFixed(value >= 100 ? 0 : 1).replace(".", ",")} ${units[i]}`;
}

/** Cài đặt mà SQL đọc trực tiếp: chỉ nhận đúng kiểu (khớp `DossierQueries.EnforceSettingKey` ở API). */
export const BOOLEAN_SETTINGS = new Set(["dossier.enforce_procedure_components"]);
export const MAX_SETTING_LENGTH = 4000;

export type ParsedSetting = { ok: true; value: unknown } | { ok: false; error: string };

/** Đọc ô nhập giá trị cài đặt (JSON). `true`, `false`, số, chuỗi có ngoặc kép, mảng, đối tượng; chuỗi thường không có ngoặc là sai để khỏi lưu nhầm. */
export function parseSettingValue(key: string, text: string): ParsedSetting {
  const raw = text.trim();
  if (raw === "") return { ok: false, error: "Nhập giá trị." };
  if (raw.length > MAX_SETTING_LENGTH) return { ok: false, error: `Giá trị tối đa ${MAX_SETTING_LENGTH} ký tự.` };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Giá trị phải là JSON hợp lệ: true, false, số, chữ đặt trong ngoặc kép (\"abc\"), danh sách hoặc đối tượng." };
  }
  if (BOOLEAN_SETTINGS.has(key) && typeof value !== "boolean") return { ok: false, error: "Cài đặt này chỉ nhận true hoặc false (không có dấu ngoặc kép)." };
  return { ok: true, value };
}

/** Giá trị hiển thị gọn (một dòng), cắt khi dài. */
export function settingPreview(value: unknown, max = 80): string {
  const text = JSON.stringify(value) ?? "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
