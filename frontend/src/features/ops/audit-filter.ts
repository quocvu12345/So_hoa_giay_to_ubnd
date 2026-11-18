/**
 * Bộ lọc màn Nhật ký hệ thống (LOG-08, FE-44, BE-88, BE-117). Nằm trên URL (form GET) để gửi đường dẫn cho người khác mở đúng kết quả.
 * Không `import "server-only"`: dùng được trong test.
 */
export const VIEWS = ["loi", "truy-cap", "thay-doi"] as const;
export type AuditView = (typeof VIEWS)[number];

export const VIEW_LABELS: Record<AuditView, string> = { loi: "Mã lỗi", "truy-cap": "Truy cập", "thay-doi": "Thay đổi dữ liệu" };

export type AuditFilter = {
  view: AuditView;
  /** Mã lỗi người dùng gửi, đã chuẩn hóa chữ hoa; rỗng nếu không nhập. */
  errorId: string;
  correlationId: string;
  objectType: string;
  /** Ngày dạng yyyy-mm-dd (giờ Việt Nam), rỗng nếu không lọc. */
  from: string;
  to: string;
  /** Con trỏ trang: id dòng cuối của trang trước (API trả id giảm dần). */
  before: string;
};

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Mã lỗi gồm đúng 8 ký tự 0-9 A-F. Người dùng gõ chữ thường hay có khoảng trắng thừa vẫn nhận. */
export function normalizeErrorId(input: string): { value: string; valid: boolean } {
  const value = input.trim().toUpperCase();
  return { value, valid: /^[0-9A-F]{8}$/.test(value) };
}

export function parseAuditFilter(params: Params): AuditFilter {
  const viewRaw = first(params.xem);
  const errorId = first(params["ma-loi"]);
  // Có nhập mã lỗi thì luôn xem theo Mã lỗi, kể cả khi đường dẫn ghi xem khác.
  const view: AuditView = errorId ? "loi" : (VIEWS as readonly string[]).includes(viewRaw) ? (viewRaw as AuditView) : "loi";
  const date = (v: string) => (DATE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? v : "");
  const before = first(params.truoc);
  return {
    view,
    errorId: errorId ? normalizeErrorId(errorId).value : "",
    correlationId: first(params["tuong-quan"]).replace(/[^A-Za-z0-9-]/g, "").slice(0, 64),
    objectType: first(params["doi-tuong"]).replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 60),
    from: date(first(params["tu-ngay"])),
    to: date(first(params["den-ngay"])),
    before: /^\d{1,18}$/.test(before) ? before : "",
  };
}

/** Đầu ngày giờ Việt Nam (UTC+7) dạng ISO có múi giờ, để lọc theo ngày làm việc của cơ quan. */
export function dayStart(date: string): string {
  return `${date}T00:00:00+07:00`;
}

/** Đầu ngày HÔM SAU: API lọc `< to`, nên chọn "đến ngày X" thì lấy hết ngày X. */
export function dayEndExclusive(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return dayStart(next.toISOString().slice(0, 10));
}

export function toSearchParams(f: AuditFilter, before?: string): URLSearchParams {
  const p = new URLSearchParams();
  if (f.errorId) p.set("ma-loi", f.errorId);
  else if (f.view !== "loi") p.set("xem", f.view);
  if (f.correlationId) p.set("tuong-quan", f.correlationId);
  if (f.objectType) p.set("doi-tuong", f.objectType);
  if (f.from) p.set("tu-ngay", f.from);
  if (f.to) p.set("den-ngay", f.to);
  if (before) p.set("truoc", before);
  return p;
}
