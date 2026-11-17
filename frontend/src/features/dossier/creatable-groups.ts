/**
 * Nhóm hồ sơ mà phân công đang dùng được tạo hồ sơ (khớp DossierCommands.CreateAsync của API):
 * chuyên viên và trưởng phòng theo đúng đơn vị của phân công, văn thư theo cả cơ quan, vai trò khác không tạo được.
 * Nhóm của đầu mối khác vẫn chọn được khi đối chiếu giấy tờ (AI có thể gợi ý) nhưng không tạo hồ sơ mới ở đó được.
 */
export type GroupLike = { code: string; title: string; organizationCode: string; departmentCode: string };
export type AssignmentLike = { role: string; organizationCode: string | null; departmentCode: string | null };

export function creatableGroups<T extends GroupLike>(groups: readonly T[], assignment: AssignmentLike): T[] {
  if (!assignment.organizationCode) return [];
  const sameOrganization = groups.filter((g) => g.organizationCode === assignment.organizationCode);
  if (assignment.role === "clerk") return sameOrganization;
  if (assignment.role === "employee" || assignment.role === "manager") return sameOrganization.filter((g) => g.departmentCode === assignment.departmentCode);
  return [];
}
