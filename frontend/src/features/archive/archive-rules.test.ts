import { describe, expect, it } from "vitest";
import { allowedActions, filterSubmissions, parseSubmissionFilter, readProblems, toggleSelection, validateReturn } from "./archive-rules";

describe("bộ lọc đợt", () => {
  const rows = [{ id: 1, status: "draft" }, { id: 2, status: "submitted" }, { id: 3, status: "received" }, { id: 4, status: "returned" }];
  it("mặc định là đang xử lý (soạn + đã nộp)", () => {
    expect(parseSubmissionFilter(undefined)).toBe("dang-xu-ly");
    expect(parseSubmissionFilter("hack")).toBe("dang-xu-ly");
    expect(filterSubmissions(rows, "dang-xu-ly").map((r) => r.id)).toEqual([1, 2]);
  });
  it("từng nhóm và tất cả", () => {
    expect(filterSubmissions(rows, "da-tiep-nhan").map((r) => r.id)).toEqual([3]);
    expect(filterSubmissions(rows, "da-tra-lai").map((r) => r.id)).toEqual([4]);
    expect(filterSubmissions(rows, "tat-ca")).toHaveLength(4);
  });
});

describe("readProblems", () => {
  it("đọc đúng dạng của API", () => {
    expect(readProblems([{ dossierId: "a", code: "HS-1", problem: "Hồ sơ chưa ở bước chờ nộp lưu." }])).toEqual([{ dossierId: "a", code: "HS-1", problem: "Hồ sơ chưa ở bước chờ nộp lưu." }]);
  });
  it("dạng lạ thì rỗng, không ném lỗi", () => {
    for (const bad of [undefined, null, "x", 3, {}, [null], [{ problem: "thiếu mã" }], [{ dossierId: "a" }]]) expect(readProblems(bad), String(bad)).toEqual([]);
  });
});

describe("validateReturn", () => {
  it("lý do chung từ 10 ký tự", () => {
    expect(validateReturn("ngắn", []).note).toContain("10");
    expect(validateReturn("Thiếu biên bản bàn giao", [])).toEqual({});
  });
  it("mỗi lỗi từng hồ sơ cần mô tả", () => {
    expect(validateReturn("Thiếu biên bản bàn giao", [{ dossierId: "a", note: "ab" }]).issues).toBeTruthy();
    expect(validateReturn("Thiếu biên bản bàn giao", [{ dossierId: "a", note: "Thiếu trang 3" }])).toEqual({});
  });
});

describe("toggleSelection", () => {
  it("chọn và bỏ chọn", () => {
    const one = toggleSelection(new Set(), "a");
    expect([...one.next]).toEqual(["a"]);
    expect(toggleSelection(one.next, "a").next.size).toBe(0);
  });
  it("chặn khi đủ giới hạn, không đổi tập", () => {
    const full = new Set(["a", "b"]);
    const result = toggleSelection(full, "c", 2);
    expect(result.blocked).toBe(true);
    expect([...result.next]).toEqual(["a", "b"]);
    expect(toggleSelection(full, "a", 2).blocked).toBe(false);          // bỏ chọn luôn được
  });
});

describe("allowedActions", () => {
  it("đang soạn: nộp hoặc xóa", () => expect(allowedActions("draft")).toMatchObject({ submit: true, remove: true, receive: false, giveBack: false, minutes: false }));
  it("đã nộp: tiếp nhận hoặc trả lại", () => expect(allowedActions("submitted")).toMatchObject({ submit: false, remove: false, receive: true, giveBack: true, minutes: false }));
  it("đã tiếp nhận: có biên bản", () => expect(allowedActions("received")).toMatchObject({ receive: false, minutes: true }));
  it("đã trả lại: không còn thao tác", () => expect(allowedActions("returned")).toEqual({ submit: false, remove: false, receive: false, giveBack: false, minutes: false }));
});
