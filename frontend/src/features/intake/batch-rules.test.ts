import { describe, expect, it } from "vitest";
import { canAcceptFiles, closeWarning, pageLabel, sheetHint, toBatchRequest, validateBatchForm, validateNote, validateReplaceReason } from "./batch-rules";

const empty = { handedOverBy: "", boxLabel: "", expectedSheets: "", note: "" };

describe("validateBatchForm", () => {
  it("form rỗng hợp lệ", () => expect(validateBatchForm(empty)).toEqual({}));
  it("số tờ phải là số nguyên không âm trong giới hạn", () => {
    expect(validateBatchForm({ ...empty, expectedSheets: "12" })).toEqual({});
    expect(validateBatchForm({ ...empty, expectedSheets: "0" })).toEqual({});
    for (const bad of ["-1", "1,5", "abc", "100001", "1e3"]) expect(validateBatchForm({ ...empty, expectedSheets: bad }).expectedSheets, bad).toBeTruthy();
  });
  it("chữ quá dài bị báo đúng ô", () => {
    const errors = validateBatchForm({ handedOverBy: "a".repeat(201), boxLabel: "b".repeat(101), expectedSheets: "", note: "c".repeat(1001) });
    expect(Object.keys(errors).sort()).toEqual(["boxLabel", "handedOverBy", "note"]);
  });
});

describe("toBatchRequest", () => {
  it("bỏ khoảng trắng, rỗng thành null, số tờ thành số", () => {
    expect(toBatchRequest({ handedOverBy: "  Phòng Nội vụ ", boxLabel: "", expectedSheets: " 40 ", note: "  " })).toEqual({ handedOverBy: "Phòng Nội vụ", boxLabel: null, expectedSheetCount: 40, note: null });
    expect(toBatchRequest(empty).expectedSheetCount).toBeNull();
  });
});

describe("lý do", () => {
  it("chấp nhận bỏ qua cần từ 10 ký tự", () => {
    expect(validateNote("ngắn")).toContain("từ 10");
    expect(validateNote("          ")).toContain("đang 0");
    expect(validateNote("Bản gốc đã mờ sẵn")).toBeNull();
  });
  it("lý do thay bản quét 10–500 ký tự", () => {
    expect(validateReplaceReason("ngắn")).toBeTruthy();
    expect(validateReplaceReason("x".repeat(501))).toContain("tối đa 500");
    expect(validateReplaceReason("Quét lại trang 3 bị mờ")).toBeNull();
  });
});

describe("sheetHint", () => {
  it("không có số tờ dự kiến thì chỉ nêu số trang", () => expect(sheetHint(null, 1200)).toEqual({ tone: "neutral", text: "1.200 trang đã quét" }));
  it("ít trang hơn số tờ thì cảnh báo; bằng hoặc hơn thì không", () => {
    expect(sheetHint(100, 80).tone).toBe("warn");
    expect(sheetHint(100, 100).tone).toBe("neutral");
    expect(sheetHint(100, 190).tone).toBe("neutral");
  });
});

describe("đóng lô", () => {
  it("chỉ cảnh báo khi còn lỗi mở", () => {
    expect(closeWarning(0)).toBeNull();
    expect(closeWarning(3)).toContain("3 lỗi ảnh");
  });
  it("lô đã đóng không nhận thêm tệp", () => {
    expect(canAcceptFiles("open")).toBe(true);
    expect(canAcceptFiles("qc")).toBe(true);
    expect(canAcceptFiles("closed")).toBe(false);
  });
  it("nhãn trang", () => {
    expect(pageLabel(3)).toBe("Trang 3");
    expect(pageLabel(null)).toBe("Cả tệp");
  });
});
