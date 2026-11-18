/**
 * Quy tắc thuần cho tách một PDF nhiều văn bản (FE-25, BE-51). Giao diện chỉ giữ "điểm tách sau trang k"; dải trang luôn dẫn xuất từ đó
 * nên KHÔNG BAO GIỜ chồng hoặc hở (luật của API: bắt đầu từ trang 1, liền nhau, kết thúc ở trang cuối, ít nhất hai phần).
 */

export type Segment = { from: number; to: number };

/** Điểm tách hợp lệ: số nguyên từ 1 đến (số trang − 1), không trùng, tăng dần. Giá trị sai bị bỏ. */
export function normalizeCuts(cuts: readonly number[], pageCount: number): number[] {
  return [...new Set(cuts.filter((k) => Number.isInteger(k) && k >= 1 && k < pageCount))].sort((a, b) => a - b);
}

export function toggleCut(cuts: readonly number[], afterPage: number, pageCount: number): number[] {
  const has = cuts.includes(afterPage);
  return normalizeCuts(has ? cuts.filter((k) => k !== afterPage) : [...cuts, afterPage], pageCount);
}

/** Các phần từ điểm tách: n điểm → n + 1 phần phủ kín 1..pageCount. */
export function cutsToSegments(cuts: readonly number[], pageCount: number): Segment[] {
  if (pageCount < 1) return [];
  const points = normalizeCuts(cuts, pageCount);
  const segments: Segment[] = [];
  let from = 1;
  for (const k of points) {
    segments.push({ from, to: k });
    from = k + 1;
  }
  segments.push({ from, to: pageCount });
  return segments;
}

/** Điểm tách từ các đề xuất đã có (AI hoặc lần soạn trước). Dải sai luật thì bỏ cả đề xuất: bắt đầu lại từ không điểm tách. */
export function segmentsToCuts(segments: readonly { pageFrom: number | string; pageTo: number | string }[], pageCount: number): number[] {
  const ordered = [...segments].map((s) => ({ from: Number(s.pageFrom), to: Number(s.pageTo) })).sort((a, b) => a.from - b.from);
  if (ordered.length < 2) return [];
  let expected = 1;
  for (const s of ordered) {
    if (s.from !== expected || s.to < s.from) return [];
    expected = s.to + 1;
  }
  if (expected - 1 !== pageCount) return [];
  return normalizeCuts(ordered.slice(0, -1).map((s) => s.to), pageCount);
}

/** Lỗi chặn gửi: cần có ít nhất một điểm tách (ít nhất hai phần). */
export function validateSplit(cuts: readonly number[], pageCount: number): string | null {
  if (pageCount < 2) return "Tệp chỉ có một trang nên không có gì để tách.";
  if (normalizeCuts(cuts, pageCount).length === 0) return "Đặt ít nhất một điểm tách giữa hai trang để chia tệp thành từ hai phần.";
  return null;
}

export function segmentLabel(s: Segment): string {
  return s.from === s.to ? `Trang ${s.from}` : `Trang ${s.from}–${s.to}`;
}

export function pagesIn(s: Segment): number {
  return s.to - s.from + 1;
}

export const MAX_TITLE = 300;

/** Tên gợi ý cho phần thứ i (từ 0): "<tên gốc> (phần 2/3)"; cắt cho vừa giới hạn. */
export function defaultTitle(base: string, index: number, total: number): string {
  const suffix = ` (phần ${index + 1}/${total})`;
  const room = MAX_TITLE - suffix.length;
  return `${base.trim().slice(0, Math.max(0, room))}${suffix}`;
}

/** Tên do người dùng nhập; rỗng thì để API đặt tên mặc định. Trả lỗi nếu quá dài. */
export function validateTitle(title: string): string | null {
  return title.trim().length > MAX_TITLE ? `Tên tối đa ${MAX_TITLE} ký tự.` : null;
}

/** Chiều rộng ảnh thu nhỏ (API cho phép `w`; nhỏ thì nhẹ, đủ nhận biết trang). */
export const THUMB_WIDTH = 160;

export function thumbUrl(fileId: string, page: number): string {
  return `/api/v1/files/${encodeURIComponent(fileId)}/pages/${page}/preview?w=${THUMB_WIDTH}`;
}
