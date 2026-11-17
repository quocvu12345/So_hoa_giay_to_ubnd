/**
 * Tô đậm từ khóa trong đoạn trích kết quả tra cứu (FE-34). Tìm không dấu và không phân biệt hoa thường
 * ("kiem tra" tô được "Kiểm tra") nhưng giữ nguyên chữ gốc để hiển thị.
 */
export type Segment = { text: string; match: boolean };

function fold(char: string): string {
  return char.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase();
}

/** Tách từ khóa thành các từ (chữ và số), bỏ từ trùng; tối đa 8 từ như API. */
export function queryTokens(query: string): string[] {
  const tokens = [...(query.match(/[\p{L}\p{N}]+/gu) ?? [])].map((t) => [...t].map(fold).join(""));
  return [...new Set(tokens.filter(Boolean))].slice(0, 8);
}

export function highlight(text: string, query: string): Segment[] {
  const tokens = queryTokens(query);
  if (!text || tokens.length === 0) return [{ text, match: false }];

  // Chuỗi đã bỏ dấu, kèm bảng ánh xạ từng ký tự đã bỏ dấu về vị trí trong chuỗi gốc (chữ có dấu có thể thành nhiều ký tự khi tách).
  const chars = [...text];
  let folded = "";
  const origin: number[] = []; // origin[i] = chỉ số ký tự (code point) gốc của ký tự thứ i trong `folded`
  chars.forEach((char, index) => {
    for (const piece of fold(char)) {
      folded += piece;
      origin.push(index);
    }
  });

  const marked = new Array<boolean>(chars.length).fill(false);
  for (const token of tokens) {
    for (let at = folded.indexOf(token); at !== -1; at = folded.indexOf(token, at + token.length)) {
      for (let i = at; i < at + token.length; i++) marked[origin[i]] = true;
    }
  }

  const segments: Segment[] = [];
  chars.forEach((char, index) => {
    const last = segments[segments.length - 1];
    if (last && last.match === marked[index]) last.text += char;
    else segments.push({ text: char, match: marked[index] });
  });
  return segments;
}
