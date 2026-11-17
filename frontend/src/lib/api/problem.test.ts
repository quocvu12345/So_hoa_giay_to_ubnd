import { describe, expect, it } from "vitest";
import { normalizeFieldErrors } from "@/lib/action-result";
import { ApiError, friendlyMessage, problemFrom } from "./problem";

describe("ProblemDetails của API", () => {
  it("lấy mã lỗi ngắn, thông điệp, Mã lỗi, lỗi theo ô và dữ liệu kèm", () => {
    const problem = problemFrom(409, {
      type: "https://hoso.local/errors/duplicate_file",
      detail: "PDF này đã được tải lên trước đó.",
      errorId: "A1B2C3D4",
      details: { documentId: "doc-1" },
    });
    expect(problem).toMatchObject({ status: 409, code: "duplicate_file", message: "PDF này đã được tải lên trước đó.", errorId: "A1B2C3D4", details: { documentId: "doc-1" } });
    const error = new ApiError(problem);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("duplicate_file");
  });

  it("phản hồi không phải ProblemDetails vẫn có thông báo chung", () => {
    expect(problemFrom(502, undefined)).toMatchObject({ status: 502, code: "http_502", message: "Không gọi được máy chủ." });
    expect(problemFrom(400, "text")).toMatchObject({ code: "http_400" });
  });
});

describe("thông báo cho người dùng", () => {
  const base = { code: "x", message: "Lời giải thích của API", errorId: "E1" };
  it("lỗi nghiệp vụ giữ nguyên lời của API", () => {
    expect(friendlyMessage({ ...base, status: 422 })).toBe("Lời giải thích của API");
    expect(friendlyMessage({ ...base, status: 409 })).toBe("Lời giải thích của API");
  });
  it("lỗi máy chủ kèm Mã lỗi để báo quản trị, không lộ chi tiết", () => {
    expect(friendlyMessage({ ...base, status: 500 })).toMatch(/Báo quản trị kèm Mã lỗi: E1/);
  });
  it("401, 403, 404, 429 có câu riêng nói cách xử lý", () => {
    expect(friendlyMessage({ ...base, status: 401 })).toMatch(/Đăng nhập lại/);
    expect(friendlyMessage({ ...base, status: 403 })).toMatch(/không có quyền/);
    expect(friendlyMessage({ ...base, status: 404 })).toMatch(/phạm vi của bạn/);
    expect(friendlyMessage({ ...base, status: 429 })).toMatch(/Đợi một phút/);
  });
});

describe("lỗi theo từng ô", () => {
  it("đổi chữ đầu thành chữ thường để khớp tên ô", () => {
    expect(normalizeFieldErrors({ Title: ["Nhập tên hồ sơ."], "fields[0].fieldCode": ["x"] })).toEqual({ title: ["Nhập tên hồ sơ."], "fields[0].fieldCode": ["x"] });
    expect(normalizeFieldErrors(undefined)).toBeUndefined();
  });
});
