import "server-only";
import type { Permission } from "./permissions";
import { can, requireSession } from "./session";
import type { Session } from "./types";

/**
 * Dùng đầu mỗi trang: bắt buộc đăng nhập, rồi cho biết phân công đang dùng có quyền mở màn không.
 * Trang tự quyết hiển thị <NoAccess/> khi `allowed=false`.
 * Đây chỉ là lớp giao diện; API vẫn kiểm tra quyền và phạm vi cho từng bản ghi.
 */
export async function pageSession(permission?: Permission | Permission[]): Promise<{ session: Session; allowed: boolean }> {
  const session = await requireSession();
  return { session, allowed: can(session, permission) };
}
