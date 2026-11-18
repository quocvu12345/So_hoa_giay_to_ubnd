/** Nhãn tiếng Việt cho cấp vị trí kho. Không `import "server-only"`: dùng được trong test và thành phần máy khách. */
export const KIND_LABELS: Record<string, string> = { warehouse: "Kho", room: "Phòng", cabinet: "Tủ", shelf: "Kệ", box: "Hộp" };

/** Bỏ dấu, hạ chữ thường, để gõ "tu a" ra "Tủ A". */
function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase();
}

type Searchable = { code: string; name: string; path: string };

/** Lọc cây theo từ khóa trong mã, tên hoặc đường dẫn; mọi từ gõ vào đều phải khớp. Rỗng thì giữ nguyên. */
export function filterLocations<T extends Searchable>(nodes: T[], query: string): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return nodes;
  return nodes.filter((n) => {
    const text = fold(`${n.code} ${n.name} ${n.path}`);
    return words.every((w) => text.includes(w));
  });
}

/** Thụt lề theo cấp, tối đa 4 bậc để không tràn ở màn hẹp. */
export function indentClass(depth: number): string {
  return ["pl-0", "pl-4", "pl-8", "pl-12", "pl-16"][Math.min(Math.max(depth, 0), 4)];
}

type Countable = { id: string; parentId: string | null; dossierCount: number };

/**
 * Số hồ sơ của MỖI vị trí tính cả các vị trí con. API chỉ đếm hồ sơ đặt thẳng ở từng vị trí (và hồ sơ chỉ được đặt ở hộp hoặc kệ),
 * nên "Kho" luôn là 0; trong khi danh sách hồ sơ lọc theo vị trí (BE-111) gồm cả vị trí con. Cộng dồn để con số và danh sách khớp nhau.
 */
export function subtreeCounts(nodes: Countable[]): Map<string, number> {
  const children = new Map<string, Countable[]>();
  for (const n of nodes) {
    if (n.parentId) children.set(n.parentId, [...(children.get(n.parentId) ?? []), n]);
  }
  const totals = new Map<string, number>();
  const visit = (node: Countable, seen: Set<string>): number => {
    if (seen.has(node.id)) return 0;      // dữ liệu hỏng có vòng: không lặp vô hạn
    seen.add(node.id);
    const sum = node.dossierCount + (children.get(node.id) ?? []).reduce((acc, c) => acc + visit(c, seen), 0);
    totals.set(node.id, sum);
    return sum;
  };
  for (const n of nodes) if (!totals.has(n.id)) visit(n, new Set());
  return totals;
}
