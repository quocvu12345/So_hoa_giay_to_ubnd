import "server-only";
import { type ActionResult, normalizeFieldErrors } from "@/lib/action-result";
import { ApiError, friendlyMessage } from "@/lib/api/problem";
import { getSession } from "@/lib/auth/session";
import type { Session } from "@/lib/auth/types";
import { log } from "@/lib/log";

/**
 * Khung cho Server Action ghi dữ liệu (FE-07):
 * - dòng đầu kiểm tra phiên (không có phiên thì trả 401 để giao diện chuyển sang đăng nhập và giữ nháp);
 * - lỗi ApiError thành kết quả `{ ok: false, ... }` kèm lỗi theo từng ô;
 * - lỗi khác (lỗi lập trình, mạng tới API) vẫn ném ra để GlitchTip và nhật ký thấy.
 * Quyền thật do API kiểm tra; ở đây không kiểm quyền thay API.
 */
export async function runAction<T>(name: string, handler: (session: Session) => Promise<T>): Promise<ActionResult<T>> {
  const session = await getSession();
  if (!session) return { ok: false, status: 401, code: "unauthenticated", message: friendlyMessage({ status: 401, code: "unauthenticated", message: "" }) };
  try {
    return { ok: true, data: await handler(session) };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    log.info("action_rejected", { action: name, status: error.status, code: error.code, errorId: error.errorId });
    return {
      ok: false,
      status: error.status,
      code: error.code,
      errorId: error.errorId,
      message: friendlyMessage({ status: error.status, code: error.code, message: error.message, errorId: error.errorId }),
      fieldErrors: normalizeFieldErrors(error.errors),
      details: error.details,
    };
  }
}
