/**
 * Mã quyền khớp bảng hoso.permissions (xem docs/03-thiet-ke-csdl.md, nhóm B).
 * Frontend chỉ dùng quyền để ẩn/hiện; mọi kiểm tra thật nằm ở API .NET.
 */
export const PERMISSIONS = [
  "dossier.read",
  "dossier.prepare",
  "dossier.submit",
  "dossier.assign",
  "dossier.accept",
  "dossier.escalate",
  "dossier.return",
  "dossier.decide",
  "dossier.archive",
  "document.view",
  "document.download",
  "document.print",
  "document.edit",
  "intake.upload",
  "intake.manage",
  "intake.qc",
  "processing.manage",
  "catalog.manage",
  "storage.manage",
  "loan.request",
  "loan.approve",
  "export.create",
  "disposal.request",
  "disposal.approve",
  "admin.users",
  "admin.settings",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type RoleCode = "employee" | "clerk" | "manager" | "chair" | "council" | "technical_admin";

export const ROLE_NAMES: Record<RoleCode, string> = {
  employee: "Chuyên viên",
  clerk: "Văn thư / lưu trữ",
  manager: "Trưởng phòng / Trưởng Ban",
  chair: "Chủ tịch UBND",
  council: "Lãnh đạo HĐND",
  technical_admin: "Quản trị kỹ thuật",
};

/** Có ít nhất một quyền trong danh sách yêu cầu. Không yêu cầu quyền nào thì luôn đúng. */
export function hasAny(granted: readonly Permission[], required?: Permission | readonly Permission[]): boolean {
  if (!required) return true;
  const list = typeof required === "string" ? [required] : required;
  return list.length === 0 || list.some((p) => granted.includes(p));
}
