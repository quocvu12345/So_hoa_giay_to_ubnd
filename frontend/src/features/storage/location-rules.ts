/** Quy tắc thuần cho quản lý vị trí kho (FE-36, BE-81, BE-82): cấp con hợp lệ, kiểm tra mã/tên, nơi đặt hồ sơ, nhãn hàng loạt. */

export const KINDS = ["warehouse", "room", "cabinet", "shelf", "box"] as const;
export type Kind = (typeof KINDS)[number];
export const KIND_LABEL: Record<string, string> = { warehouse: "Kho", room: "Phòng", cabinet: "Tủ", shelf: "Kệ", box: "Hộp" };
/** Khớp `storage_location_rank` của CSDL: vị trí con phải có cấp SÂU HƠN cha (không nhất thiết liền kề). */
const RANK: Record<string, number> = { warehouse: 1, room: 2, cabinet: 3, shelf: 4, box: 5 };

/** Cấp được phép tạo bên trong một vị trí cha (null: gốc, chỉ "Kho"). */
export function childKinds(parentKind: string | null): Kind[] {
  if (parentKind === null) return ["warehouse"];
  const rank = RANK[parentKind];
  return rank ? KINDS.filter((k) => RANK[k] > rank) : [];
}

export const LOCATION_CODE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
export const MAX_NAME = 200;

export function validateLocation(v: { code?: string; name: string }, mode: "create" | "edit"): { code?: string; name?: string } {
  const e: { code?: string; name?: string } = {};
  if (mode === "create" && !LOCATION_CODE.test((v.code ?? "").trim())) e.code = "Mã vị trí gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới (tối đa 40 ký tự), bắt đầu bằng chữ hoặc số.";
  const name = v.name.trim();
  if (name.length === 0) e.name = "Nhập tên vị trí.";
  else if (name.length > MAX_NAME) e.name = `Tên tối đa ${MAX_NAME} ký tự.`;
  return e;
}

/** Hồ sơ chỉ đặt ở cấp hộp hoặc kệ. */
export function canHoldDossiers(kind: string): boolean {
  return kind === "box" || kind === "shelf";
}

export type NodeLike = { id: string; parentId?: string | null; kind: string; name: string; code: string; path: string; active: boolean };

/** Nơi chọn được khi đặt hồ sơ: hộp/kệ còn dùng, theo thứ tự đường dẫn. */
export function placementChoices<T extends NodeLike>(nodes: readonly T[]): T[] {
  return nodes.filter((n) => n.active && canHoldDossiers(n.kind)).sort((a, b) => a.path.localeCompare(b.path, "vi", { numeric: true }));
}

/** Mã của một vị trí và mọi vị trí con (kể cả đã ngừng dùng nếu `includeInactive`), để in nhãn hàng loạt. */
export function subtreeIds(nodes: readonly NodeLike[], rootId: string, includeInactive = false): string[] {
  const children = new Map<string, NodeLike[]>();
  for (const n of nodes) if (n.parentId) children.set(n.parentId, [...(children.get(n.parentId) ?? []), n]);
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) return;           // chống vòng nếu dữ liệu hỏng
    seen.add(id);
    const node = nodes.find((n) => n.id === id);
    if (node && (includeInactive || node.active)) out.push(id);
    for (const child of children.get(id) ?? []) walk(child.id);
  };
  walk(rootId);
  return out;
}

export const MAX_LABELS = 240;

/** Địa chỉ in nhãn (PDF, 24 nhãn mỗi trang); null khi không có gì hoặc quá giới hạn của API. */
export function labelsHref(ids: readonly string[]): string | null {
  if (ids.length === 0 || ids.length > MAX_LABELS) return null;
  return `/api/v1/storage-locations/labels?ids=${ids.join(",")}`;
}
