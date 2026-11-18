/**
 * Bộ lọc và thứ tự của danh sách hồ sơ (FE-26, BE-111). Mọi thứ nằm trên URL (tên tiếng Việt ngắn) để gửi đường dẫn cho người khác mở đúng bộ lọc.
 * Không `import "server-only"`: dùng được cả trong test và trong thành phần máy khách.
 */

export const SORTS = ["cap-nhat", "ma", "ten", "han"] as const;
export type DossierSort = (typeof SORTS)[number];

/** Tên cột ở URL → tên API. */
export const SORT_TO_API: Record<DossierSort, "updated" | "code" | "title" | "due"> = { "cap-nhat": "updated", ma: "code", ten: "title", han: "due" };

export const SORT_LABELS: Record<DossierSort, string> = { "cap-nhat": "Mới cập nhật", ma: "Mã hồ sơ", ten: "Tên hồ sơ", han: "Hạn nội bộ" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DossierFilterState = {
  q: string;
  /** Một hoặc nhiều trạng thái cách nhau dấu phẩy ("draft,returned"). */
  status: string;
  /** Một hoặc nhiều mã nhóm hồ sơ cách nhau dấu phẩy ("H01,H02"). */
  workGroup: string;
  /** Mã phòng/Ban (đầu mối) hoặc rỗng. */
  department: string;
  mine: boolean;
  /** Năm hồ sơ, null = mọi năm. */
  year: number | null;
  overdue: boolean;
  /** Mã người chủ trì (UUID) hoặc rỗng. */
  assignee: string;
  /** Mã vị trí kho (UUID) hoặc rỗng; API gồm cả vị trí con. */
  location: string;
  sort: DossierSort;
  descending: boolean;
  cursor: string;
};

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** Danh sách mã cách nhau dấu phẩy: chỉ nhận chữ, số, gạch; tối đa 12 giá trị (khớp API). Sai thì bỏ cả bộ lọc thay vì gửi lên. */
function codeList(value: string): string {
  if (!/^[A-Za-z0-9_-]+(,[A-Za-z0-9_-]+)*$/.test(value)) return "";
  const parts = value.split(",");
  return parts.length <= 12 && parts.every((p) => p.length <= 40) ? value : "";
}

/** Chiều mặc định của từng cột: mới cập nhật giảm dần (mới nhất trước), các cột còn lại tăng dần. */
export function defaultDescending(sort: DossierSort): boolean {
  return sort === "cap-nhat";
}

export function parseDossierFilter(params: Params): DossierFilterState {
  const sortRaw = first(params["sap-xep"]);
  const sort = (SORTS as readonly string[]).includes(sortRaw) ? (sortRaw as DossierSort) : "cap-nhat";
  const direction = first(params.chieu);
  const yearRaw = first(params.nam);
  const year = /^\d{4}$/.test(yearRaw) && Number(yearRaw) >= 1900 && Number(yearRaw) <= 2200 ? Number(yearRaw) : null;
  return {
    q: first(params.q),
    status: codeList(first(params["trang-thai"])),
    workGroup: codeList(first(params.nhom)),
    department: codeList(first(params.phong)).split(",")[0],
    mine: first(params["cua-toi"]) === "1",
    year,
    overdue: first(params["qua-han"]) === "1",
    assignee: UUID.test(first(params.nguoi)) ? first(params.nguoi) : "",
    location: UUID.test(first(params["vi-tri"])) ? first(params["vi-tri"]) : "",
    sort,
    descending: direction === "giam" ? true : direction === "tang" ? false : defaultDescending(sort),
    cursor: first(params.cursor),
  };
}

/** Có đang lọc không (không tính cách sắp xếp và trang): để hiện "Xóa lọc" và thông báo "không có hồ sơ khớp". */
export function isFiltered(f: DossierFilterState): boolean {
  return Boolean(f.q || f.status || f.workGroup || f.department || f.mine || f.year !== null || f.overdue || f.assignee || f.location);
}

/** Tham số URL của trang. Bỏ giá trị mặc định cho đường dẫn gọn; `cursor` chỉ có khi truyền vào (đổi bộ lọc hay thứ tự thì về trang đầu). */
export function toSearchParams(f: DossierFilterState, cursor?: string): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.status) p.set("trang-thai", f.status);
  if (f.workGroup) p.set("nhom", f.workGroup);
  if (f.department) p.set("phong", f.department);
  if (f.mine) p.set("cua-toi", "1");
  if (f.year !== null) p.set("nam", String(f.year));
  if (f.overdue) p.set("qua-han", "1");
  if (f.assignee) p.set("nguoi", f.assignee);
  if (f.location) p.set("vi-tri", f.location);
  if (f.sort !== "cap-nhat") p.set("sap-xep", f.sort);
  if (f.descending !== defaultDescending(f.sort)) p.set("chieu", f.descending ? "giam" : "tang");
  if (cursor) p.set("cursor", cursor);
  return p;
}

/** Bấm tiêu đề cột: đang sắp theo cột đó thì đảo chiều, chưa thì sắp theo cột đó với chiều mặc định. Luôn về trang đầu. */
export function sortedBy(f: DossierFilterState, column: DossierSort): DossierFilterState {
  const same = f.sort === column;
  return { ...f, sort: column, descending: same ? !f.descending : defaultDescending(column), cursor: "" };
}

/** Giá trị aria-sort của tiêu đề cột. */
export function ariaSort(f: DossierFilterState, column: DossierSort): "ascending" | "descending" | "none" {
  if (f.sort !== column) return "none";
  return f.descending ? "descending" : "ascending";
}

/** Tham số gửi API danh sách (tên PascalCase của .NET). Chỉ đặt tham số có giá trị. */
export function toApiQuery(f: DossierFilterState): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {};
  if (f.q) query.Q = f.q;
  if (f.status) query.Status = f.status;
  if (f.workGroup) query.WorkGroup = f.workGroup;
  if (f.department) query.Department = f.department;
  if (f.mine) query.Mine = true;
  if (f.year !== null) query.Year = f.year;
  if (f.overdue) query.Overdue = true;
  if (f.assignee) query.Assignee = f.assignee;
  if (f.location) query.LocationId = f.location;
  query.Sort = SORT_TO_API[f.sort];
  query.Dir = f.descending ? "desc" : "asc";
  return query;
}

/** Đường dẫn tải CSV cùng bộ lọc và thứ tự (không phân trang). API trả tệp trực tiếp qua cùng origin; tối đa 10.000 hồ sơ. */
export function exportHref(f: DossierFilterState): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(toApiQuery(f))) query.set(key, String(value));
  return `/api/v1/dossiers/export.csv?${query.toString()}`;
}

/** Các năm để chọn: năm hiện tại và 7 năm trước, thêm năm đang lọc nếu nằm ngoài khoảng đó. */
export function yearOptions(now: Date, selected: number | null): number[] {
  const current = now.getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => current - i);
  if (selected !== null && !years.includes(selected)) years.push(selected);
  return years.sort((a, b) => b - a);
}
