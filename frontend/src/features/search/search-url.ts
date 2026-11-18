/**
 * Địa chỉ trang tra cứu (FE-34): từ khóa, bộ lọc và con trỏ trang đều nằm trên URL (tên tiếng Việt ngắn).
 * Không `import "server-only"`: dùng được trong test.
 */
export type SearchUrlState = {
  q: string;
  kind: "all" | "documents" | "dossiers";
  workGroup: string;
  form: string;
  /** Ngày người dùng gõ (dd/mm/yyyy), giữ nguyên chữ để điền lại vào ô. */
  fromText: string;
  toText: string;
  /** Cơ quan ban hành (BE-112): tên (không dấu cũng được) hoặc mã cơ quan. Chỉ áp cho giấy tờ. */
  issuer: string;
};

/** Tham số URL, bỏ giá trị rỗng/mặc định. `cursor` chỉ có khi truyền vào: đổi từ khóa hay bộ lọc thì về trang đầu. */
export function searchParams(state: SearchUrlState, cursor?: string): URLSearchParams {
  const p = new URLSearchParams();
  if (state.q) p.set("q", state.q);
  if (state.kind !== "all") p.set("loai", state.kind);
  if (state.workGroup) p.set("nhom", state.workGroup);
  if (state.form) p.set("hinh-thuc", state.form);
  if (state.fromText) p.set("tu-ngay", state.fromText);
  if (state.toText) p.set("den-ngay", state.toText);
  if (state.issuer) p.set("co-quan", state.issuer);
  if (cursor) p.set("con-tro", cursor);
  return p;
}

export function searchHref(base: string, state: SearchUrlState, cursor?: string): string {
  const query = searchParams(state, cursor).toString();
  return query ? `${base}?${query}` : base;
}

/** Có bộ lọc nào ngoài từ khóa không (để hiện "Xóa bộ lọc"). */
export function hasSearchFilters(state: SearchUrlState): boolean {
  return Boolean(state.workGroup || state.form || state.fromText || state.toText || state.issuer || state.kind !== "all");
}
