/**
 * Khay chờ AI (BE-97…99, docs/tasks/ai.md): nhãn hiển thị và tóm tắt kết quả "Trích xuất ngay".
 * Chỉ là hàm thuần để dùng cả ở máy chủ lẫn trình duyệt; số liệu do API tính (vị trí, thời gian chờ ước tính).
 */

/** priority: làm ngay (mức 1) · interactive: có người chờ (mức 3) · background: khay nền (PDF mới tải lên, mức 7). */
export type QueueKind = "priority" | "interactive" | "background";

export type ExtractOutcome = "raised" | "running" | "alreadyDone" | "created" | "skipped";

export type ExtractItem = {
  documentId: string;
  fileId: string | null;
  jobId: string | null;
  outcome: ExtractOutcome;
  queueKind: QueueKind | null;
  queuePosition: number | null;
  etaSeconds: number | null;
  message: string | null;
};

export type ExtractResult = {
  items: ExtractItem[];
  raised: number;
  running: number;
  alreadyDone: number;
  created: number;
  skipped: number;
};

/** "khoảng 20 giây" · "khoảng 3 phút" · "khoảng 1 giờ 5 phút". Không có số đo thì trả null để không hiện con số đoán. */
export function etaText(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 45) return `khoảng ${Math.max(5, Math.round(seconds / 5) * 5)} giây`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `khoảng ${Math.max(1, minutes)} phút`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `khoảng ${hours} giờ` : `khoảng ${hours} giờ ${rest} phút`;
}

/** Chữ hiện ở cột tình trạng cho việc đang chờ: tách rõ "khay chờ" và "ưu tiên". */
export function waitingLabel(kind: QueueKind | null | undefined, position: number | null | undefined, etaSeconds: number | null | undefined): string {
  const head = kind === "priority" ? "Ưu tiên" : kind === "interactive" ? "Đang chờ" : "Chờ trong khay";
  const parts = [head];
  if (position != null) parts.push(`thứ ${position}`);
  const eta = etaText(etaSeconds);
  if (eta) parts.push(eta);
  return parts.join(" · ");
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}`;
}

/** Kết quả bấm "Trích xuất ngay", ví dụ "Đã đưa 3 giấy tờ lên đầu hàng · 1 giấy tờ đã đọc xong". */
export function summarizeExtract(result: ExtractResult): string {
  const parts: string[] = [];
  const onTop = result.raised + result.created;
  if (onTop > 0) parts.push(`Đã đưa ${plural(onTop, "giấy tờ")} lên đầu hàng`);
  if (result.running > 0) parts.push(`${plural(result.running, "giấy tờ")} đang được đọc`);
  if (result.alreadyDone > 0) parts.push(`${plural(result.alreadyDone, "giấy tờ")} đã đọc xong`);
  if (result.skipped > 0) parts.push(`${plural(result.skipped, "giấy tờ")} không đọc được (chưa có tệp quét hoặc ngoài phạm vi)`);
  if (parts.length === 0) return "Không có giấy tờ nào cần trích xuất.";
  const first = result.items.find((i) => i.outcome === "raised" || i.outcome === "created");
  const eta = result.items.length === 1 ? etaText(first?.etaSeconds) : null;
  return parts.join(" · ") + (eta ? ` · xong ${eta}` : "");
}
