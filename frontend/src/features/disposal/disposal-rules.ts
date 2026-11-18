/** Quy tắc thuần cho đề nghị hủy tài liệu hết thời hạn bảo quản (FE-39, BE-87): nhãn, trạng thái, ai được làm gì, kiểm tra lý do. */

export const MIN_REASON = 10;
export const MAX_REASON = 1000;

export const DISPOSAL_STATUS: Record<string, string> = {
  requested: "Chờ phê duyệt", approved: "Đã phê duyệt, chờ thực hiện", executing: "Đang thực hiện", executed: "Đã hủy", rejected: "Bị từ chối",
};
export const DISPOSAL_FILTERS: readonly { value: "dang-cho" | "da-duyet" | "da-huy" | "tu-choi" | "tat-ca"; label: string; statuses: readonly string[] }[] = [
  { value: "dang-cho", label: "Chờ phê duyệt", statuses: ["requested"] },
  { value: "da-duyet", label: "Chờ thực hiện", statuses: ["approved", "executing"] },
  { value: "da-huy", label: "Đã hủy", statuses: ["executed"] },
  { value: "tu-choi", label: "Bị từ chối", statuses: ["rejected"] },
  { value: "tat-ca", label: "Tất cả", statuses: [] },
];
export type DisposalFilter = (typeof DISPOSAL_FILTERS)[number]["value"];

export function parseDisposalFilter(value: unknown): DisposalFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return DISPOSAL_FILTERS.find((f) => f.value === v)?.value ?? "dang-cho";
}

export function filterDisposals<T extends { status: string }>(rows: readonly T[], filter: DisposalFilter): T[] {
  const statuses = DISPOSAL_FILTERS.find((f) => f.value === filter)?.statuses ?? [];
  return statuses.length === 0 ? [...rows] : rows.filter((r) => statuses.includes(r.status));
}

/** Lý do (đề nghị, từ chối) từ 10 đến 1000 ký tự. */
export function validateReason(text: string, max = MAX_REASON): string | null {
  const length = text.trim().length;
  if (length < MIN_REASON) return `Ghi lý do từ ${MIN_REASON} ký tự (đang ${length}).`;
  if (length > max) return `Tối đa ${max} ký tự.`;
  return null;
}

export type DisposalPerms = { canRequest: boolean; canApprove: boolean };

/**
 * Thao tác khả dụng của MỘT đề nghị đối với người xem. Người phê duyệt phải khác người đề nghị (API kiểm; ở đây chỉ ẩn nút để khỏi bấm vô ích).
 * Thực hiện hủy thuộc người có quyền đề nghị (văn thư), sau khi đã phê duyệt kèm văn bản quyết định.
 */
export function disposalActions(status: string, perms: DisposalPerms, isRequester: boolean): { approve: boolean; reject: boolean; execute: boolean; ownNote: boolean } {
  const decide = status === "requested" && perms.canApprove;
  return {
    approve: decide && !isRequester,
    reject: decide,
    execute: status === "approved" && perms.canRequest,
    ownNote: decide && isRequester,
  };
}

export const EXECUTE_WARNING = "Hủy xóa vĩnh viễn nội dung các tệp, ảnh trang và chữ đã đọc của giấy tờ chỉ thuộc hồ sơ này. Dòng thông tin (metadata), nhật ký và văn bản quyết định được giữ lại. Không hoàn tác được.";

/** Số liệu kết quả thực hiện để báo cho người dùng. */
export function describeResult(r: { filesDisposed: number | string; blobsDeleted: number | string; documentsKept: number | string }): string {
  return `Đã hủy nội dung ${Number(r.filesDisposed)} tệp (xóa ${Number(r.blobsDeleted)} bản trên kho), giữ lại thông tin của ${Number(r.documentsKept)} giấy tờ.`;
}
