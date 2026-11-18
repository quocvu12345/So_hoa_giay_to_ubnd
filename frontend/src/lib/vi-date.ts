/**
 * Ngày/tháng/năm dạng Việt Nam. Không `import "server-only"`: dùng được ở trình duyệt, Server Action và test.
 * Giao diện và API chỉ nhận `dd/mm/yyyy` (API chuẩn hóa sang yyyy-MM-dd), nên mọi ô ngày dùng chung các hàm này.
 */
const VI_DATE = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/;

/** "20/01/2026" (hoặc 20-01-2026, 20.01.2026) → "2026-01-20"; sai lịch (31/02) hoặc sai dạng → null. */
export function parseViDate(text: string): string | null {
  const m = VI_DATE.exec(text);
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "2026-01-20" → "20/01/2026". Chuỗi không phải ngày ISO thì giữ nguyên. */
export function formatViDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Ngày gõ bằng - hoặc . thì đổi thành / và thêm số 0 đầu; không đúng dạng thì chỉ cắt khoảng trắng. */
export function canonicalViDate(text: string): string {
  const m = VI_DATE.exec(text);
  return m ? `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]}` : text.trim();
}
