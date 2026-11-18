/**
 * Lỗi từ API .NET theo chuẩn ProblemDetails (docs/02-kien-truc-server.md mục 6).
 * Dùng chung cho máy chủ Next (lib/api/server.ts) và trình duyệt (tải lên bằng XHR), nên không import "server-only".
 */

/** Lỗi theo từng ô: khóa là đường dẫn trường của API, ví dụ "title", "fields[0].fieldCode". */
export type FieldErrors = Record<string, string[]>;

export type Problem = {
  status: number;
  /** Mã lỗi ngắn từ phần cuối của `type`, ví dụ duplicate_file, workflow_conflict, concurrency_conflict. */
  code: string;
  message: string;
  errorId?: string;
  /** Có khi 400 validation_failed. */
  errors?: FieldErrors;
  /** Dữ liệu kèm theo của lỗi nghiệp vụ, ví dụ giấy tờ cũ khi trùng tệp. */
  details?: unknown;
};

type ProblemBody = {
  type?: string;
  title?: string;
  detail?: string;
  errorId?: string;
  errors?: FieldErrors;
  details?: unknown;
};

export function problemFrom(status: number, body: unknown): Problem {
  const problem = (typeof body === "object" && body !== null ? body : {}) as ProblemBody;
  return {
    status,
    code: problem.type?.split("/").pop() || `http_${status}`,
    message: problem.detail ?? problem.title ?? "Không gọi được máy chủ.",
    errorId: problem.errorId,
    errors: problem.errors,
    details: problem.details,
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errorId?: string;
  readonly errors?: FieldErrors;
  readonly details?: unknown;
  /**
   * Mã lỗi hiện cho người dùng trên màn lỗi. Next giữ nguyên `digest` đã đặt sẵn trên lỗi (thay vì băm lại), nên lỗi từ API mang đúng mã lỗi của API:
   * người dùng đọc mã này, quản trị nhập vào Quản trị › Nhật ký hệ thống để tra ra request và người gặp lỗi (LOG-08, BE-117).
   */
  readonly digest?: string;

  constructor(problem: Problem) {
    super(problem.message);
    if (problem.errorId) this.digest = problem.errorId;
    this.name = "ApiError";
    this.status = problem.status;
    this.code = problem.code;
    this.errorId = problem.errorId;
    this.errors = problem.errors;
    this.details = problem.details;
  }
}

/** Câu báo lỗi cho người dùng khi API không có lời giải thích riêng (5xx, mạng, quá tải). */
export function friendlyMessage(problem: Pick<Problem, "status" | "code" | "message" | "errorId">): string {
  switch (problem.status) {
    case 401:
      return "Phiên đăng nhập đã hết. Đăng nhập lại rồi thử tiếp.";
    case 403:
      if (problem.code === "csrf_failed") return "Yêu cầu bị chặn vì thiếu mã bảo vệ. Tải lại trang rồi thử lại.";
      // Lời của API đã nói rõ cách xử lý (đăng nhập lại có xác thực hai lớp, chọn lại phân công).
      if (problem.code === "mfa_required" || problem.code === "assignment_not_allowed") return problem.message;
      return "Phân công đang dùng không có quyền thực hiện việc này.";
    case 404:
      return "Không tìm thấy mục này trong phạm vi của bạn.";
    case 413:
      return problem.message;
    case 429:
      return "Thao tác quá nhanh. Đợi một phút rồi thử lại.";
    default:
      if (problem.status >= 500) return `Chưa thực hiện được do lỗi máy chủ. Báo quản trị kèm Mã lỗi: ${problem.errorId ?? problem.code}.`;
      return problem.message;
  }
}
