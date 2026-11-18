/**
 * Chọn nhiều PDF ở hộp tiếp nhận (FE-21). Hàm thuần để kiểm thử; không phụ thuộc React hay Next.
 * Mọi hàm trả tập MỚI, không sửa tập đầu vào (React so sánh theo tham chiếu).
 */

export function toggleId(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Chọn hoặc bỏ chọn cả nhóm `ids` (ví dụ mọi dòng đang hiện), giữ nguyên các lựa chọn khác. */
export function setMany(selected: ReadonlySet<string>, ids: readonly string[], on: boolean): Set<string> {
  const next = new Set(selected);
  for (const id of ids) {
    if (on) next.add(id);
    else next.delete(id);
  }
  return next;
}

/** Bỏ khỏi lựa chọn những PDF không còn trong danh sách (đã xếp, đã bỏ, bộ lọc đổi). Không có gì cần bỏ thì trả đúng tập cũ để khỏi vẽ lại. */
export function pruneSelection(selected: ReadonlySet<string>, visibleIds: readonly string[]): ReadonlySet<string> {
  const visible = new Set(visibleIds);
  const kept = [...selected].filter((id) => visible.has(id));
  return kept.length === selected.size ? selected : new Set(kept);
}

/** Trạng thái ô "chọn tất cả": none | some | all, theo các dòng đang hiện. */
export function allState(selected: ReadonlySet<string>, visibleIds: readonly string[]): "none" | "some" | "all" {
  if (visibleIds.length === 0) return "none";
  const count = visibleIds.filter((id) => selected.has(id)).length;
  return count === 0 ? "none" : count === visibleIds.length ? "all" : "some";
}

/** Chỉ PDF đã đọc xong mới xếp vào hồ sơ được ngay (đối chiếu cần kết quả đọc); số còn lại bị bỏ qua khi xếp, nhưng vẫn bỏ khỏi hộp được. */
export function describeSelection(items: readonly { documentId: string; stage: string }[], selected: ReadonlySet<string>): { total: number; readyIds: string[]; skipped: number } {
  const chosen = items.filter((item) => selected.has(item.documentId));
  const readyIds = chosen.filter((item) => item.stage === "ready").map((item) => item.documentId);
  return { total: chosen.length, readyIds, skipped: chosen.length - readyIds.length };
}
