/**
 * Bộ lọc danh sách thủ tục hành chính (FE-35): mọi giá trị nằm trên URL (`/thu-tuc?q=&linh-vuc=&cap=&hieu-luc=&trang=`).
 * Hàm thuần để kiểm thử; không phụ thuộc Next.
 */
export const PAGE_SIZE = 25;

export type ProcedureFilter = { q: string; domain: string; level: string; status: string; page: number };

/** Tình trạng hiệu lực (CSDL: active, unverified, repealed, replaced). Thủ tục đã bãi bỏ/thay thế vẫn tra được nhưng không dùng làm căn cứ mới. */
export const LIFECYCLE_LABELS: Record<string, string> = {
  active: "Đang hiệu lực",
  unverified: "Chưa kiểm chứng",
  replaced: "Đã được thay thế",
  repealed: "Đã bãi bỏ",
};

/** Thủ tục không dùng để tạo hồ sơ mới. */
export function isRetired(status: string): boolean {
  return status === "repealed" || status === "replaced";
}

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parseProcedureFilter(params: Params): ProcedureFilter {
  const page = Number.parseInt(first(params.trang), 10);
  const status = first(params["hieu-luc"]);
  return {
    q: first(params.q).slice(0, 200),
    domain: first(params["linh-vuc"]).slice(0, 200),
    level: first(params.cap).slice(0, 200),
    status: status in LIFECYCLE_LABELS ? status : "",
    page: Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1,
  };
}

/** Địa chỉ danh sách cho một bộ lọc (bỏ ô rỗng, trang 1 không ghi). */
export function procedureListHref(filter: ProcedureFilter, patch: Partial<ProcedureFilter> = {}): string {
  const f = { ...filter, ...patch };
  const query = new URLSearchParams();
  if (f.q) query.set("q", f.q);
  if (f.domain) query.set("linh-vuc", f.domain);
  if (f.level) query.set("cap", f.level);
  if (f.status) query.set("hieu-luc", f.status);
  if (f.page > 1) query.set("trang", String(f.page));
  const text = query.toString();
  return text ? `/thu-tuc?${text}` : "/thu-tuc";
}

/** Có đang lọc gì không (để hiện "Xóa bộ lọc"). Trang không tính. */
export function hasFilter(filter: ProcedureFilter): boolean {
  return Boolean(filter.q || filter.domain || filter.level || filter.status);
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

/** Mã thủ tục hợp lệ để đi vào đường dẫn: nguồn dùng dạng `hn87-394`, `dvc-<uuid>`. */
export function isProcedureId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(value);
}

/** Gom thành phần hồ sơ theo mục ("a) Hồ sơ gồm:") giữ thứ tự xuất hiện. */
export function groupBySection<T extends { section: string; position: number | string }>(components: readonly T[]): { section: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const c of [...components].sort((a, b) => Number(a.position) - Number(b.position))) {
    const list = groups.get(c.section) ?? [];
    list.push(c);
    groups.set(c.section, list);
  }
  return [...groups].map(([section, items]) => ({ section, items }));
}

/** "1 bản chính, 2 bản sao" từ số lượng; 0 thì bỏ. Không có gì thì chuỗi rỗng. */
export function quantityLabel(original: number, copy: number): string {
  return [original > 0 ? `${original} bản chính` : "", copy > 0 ? `${copy} bản sao` : ""].filter(Boolean).join(", ");
}
