/**
 * Vùng nguồn của một trường trên trang (FE-22, FE-23; API BE-114). Toạ độ theo TỈ LỆ kích thước trang (0..1), gốc ở góc trên bên trái,
 * nên khung đặt bằng phần trăm khớp ở mọi mức phóng. `approximate`: engine chỉ ước theo vị trí dòng (trang lấy chữ từ lớp chữ PDF).
 * Không `import "server-only"`: dùng được ở trình duyệt và trong test.
 */
export type SourceRegion = { page: number; x: number; y: number; width: number; height: number; approximate: boolean };

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Vùng hợp lệ: trang ≥ 1, nằm trong trang, có diện tích. Dữ liệu từ API đã được lọc nhưng giao diện không tin hơn mức cần. */
export function isValidRegion(region: Partial<SourceRegion> | null | undefined): region is SourceRegion {
  if (!region) return false;
  const { page, x, y, width, height } = region;
  return Number.isInteger(page) && (page as number) >= 1 && finite(x) && finite(y) && finite(width) && finite(height) && x >= 0 && y >= 0 && width > 0 && height > 0 && x <= 1 && y <= 1 && x + width <= 1.0001 && y + height <= 1.0001;
}

/** Kiểu CSS đặt khung theo phần trăm của ảnh trang. Thêm đệm nhỏ quanh chữ để khung không cắt sát nét chữ. */
export function regionStyle(region: SourceRegion): { left: string; top: string; width: string; height: string } {
  const pad = 0.004;
  const left = Math.max(0, region.x - pad);
  const top = Math.max(0, region.y - pad);
  const right = Math.min(1, region.x + region.width + pad);
  const bottom = Math.min(1, region.y + region.height + pad);
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  return { left: pct(left), top: pct(top), width: pct(right - left), height: pct(bottom - top) };
}

/** `?vung=x,y,w,h[,u]` trên địa chỉ chi tiết giấy tờ (trang lấy từ `?trang=`); `u` = ước theo dòng. */
export function encodeRegionParam(region: SourceRegion): string {
  const n = (v: number) => String(Math.round(v * 10_000) / 10_000);
  return [n(region.x), n(region.y), n(region.width), n(region.height), ...(region.approximate ? ["u"] : [])].join(",");
}

export function parseRegionParam(text: string | undefined, page: number): SourceRegion | null {
  if (!text) return null;
  const parts = text.split(",");
  if (parts.length < 4 || parts.length > 5) return null;
  const [x, y, width, height] = parts.slice(0, 4).map(Number);
  const region = { page, x, y, width, height, approximate: parts[4] === "u" };
  return isValidRegion(region) ? region : null;
}

/**
 * Vùng nguồn của trường nằm trên bản quét nào (BE-126). Giấy tờ đã thay bản quét thì vùng của lần đọc cũ nằm trên bản cũ: số trang và toạ độ
 * không còn đúng với bản hiện hành, nên không dựng khung lên bản đang xem. `olderScanId` có giá trị khi vùng thuộc bản khác.
 */
export function regionTarget(
  field: { sourceRegion?: Partial<SourceRegion> | null; sourcePages: number[]; sourceFileId?: string | null },
  currentFileId: string | undefined,
): { region: SourceRegion | null; page: number | null; olderScanId: string | null } {
  const sourcePage = field.sourceRegion?.page ?? field.sourcePages[0] ?? null;
  if (field.sourceFileId && currentFileId && field.sourceFileId !== currentFileId) return { region: null, page: sourcePage, olderScanId: field.sourceFileId };
  const region = isValidRegion(field.sourceRegion) ? field.sourceRegion : null;
  return { region, page: region?.page ?? field.sourcePages[0] ?? null, olderScanId: null };
}
