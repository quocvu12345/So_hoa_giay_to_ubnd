import { describe, expect, it } from "vitest";
import { cutsToSegments, defaultTitle, MAX_TITLE, normalizeCuts, pagesIn, segmentLabel, segmentsToCuts, thumbUrl, toggleCut, validateSplit, validateTitle } from "./split-rules";

describe("điểm tách", () => {
  it("normalizeCuts bỏ giá trị sai, trùng; sắp tăng dần", () => {
    expect(normalizeCuts([5, 2, 2, 0, 12, 1.5, 11, -1], 12)).toEqual([2, 5, 11]);
    expect(normalizeCuts([1], 1)).toEqual([]);
  });
  it("toggleCut bật rồi tắt", () => {
    const on = toggleCut([], 3, 10);
    expect(on).toEqual([3]);
    expect(toggleCut(on, 3, 10)).toEqual([]);
    expect(toggleCut([3], 1, 10)).toEqual([1, 3]);
    expect(toggleCut([], 10, 10)).toEqual([]);        // không có "sau trang cuối"
  });
});

describe("cutsToSegments", () => {
  it("n điểm → n+1 phần phủ kín, không chồng không hở", () => {
    expect(cutsToSegments([2, 5], 12)).toEqual([{ from: 1, to: 2 }, { from: 3, to: 5 }, { from: 6, to: 12 }]);
    expect(cutsToSegments([], 4)).toEqual([{ from: 1, to: 4 }]);
  });
  it("với mọi tập điểm tách, tổng số trang các phần = số trang và liền nhau", () => {
    for (const cuts of [[1], [1, 2, 3], [4, 9], [11]]) {
      const segments = cutsToSegments(cuts, 12);
      expect(segments.reduce((n, s) => n + pagesIn(s), 0)).toBe(12);
      segments.slice(1).forEach((s, i) => expect(s.from).toBe(segments[i].to + 1));
      expect(segments[0].from).toBe(1);
      expect(segments.at(-1)!.to).toBe(12);
    }
  });
  it("số trang 0 thì không có phần", () => expect(cutsToSegments([], 0)).toEqual([]));
});

describe("segmentsToCuts", () => {
  it("đọc lại đề xuất hợp lệ (kể cả số dạng chuỗi từ API)", () => {
    expect(segmentsToCuts([{ pageFrom: 1, pageTo: 2 }, { pageFrom: "3", pageTo: "6" }], 6)).toEqual([2]);
    expect(segmentsToCuts([{ pageFrom: 3, pageTo: 6 }, { pageFrom: 1, pageTo: 2 }], 6)).toEqual([2]);       // sắp lại theo trang
  });
  it("đề xuất sai luật thì bỏ hết", () => {
    expect(segmentsToCuts([{ pageFrom: 1, pageTo: 2 }, { pageFrom: 4, pageTo: 6 }], 6)).toEqual([]);        // hở
    expect(segmentsToCuts([{ pageFrom: 1, pageTo: 3 }, { pageFrom: 3, pageTo: 6 }], 6)).toEqual([]);        // chồng
    expect(segmentsToCuts([{ pageFrom: 1, pageTo: 2 }, { pageFrom: 3, pageTo: 5 }], 6)).toEqual([]);        // thiếu cuối
    expect(segmentsToCuts([{ pageFrom: 1, pageTo: 6 }], 6)).toEqual([]);                                     // một phần
  });
});

describe("validateSplit", () => {
  it("cần ít nhất một điểm tách; tệp một trang không tách được", () => {
    expect(validateSplit([], 12)).toContain("ít nhất một điểm tách");
    expect(validateSplit([3], 12)).toBeNull();
    expect(validateSplit([], 1)).toContain("một trang");
    expect(validateSplit([99], 12)).toContain("ít nhất một điểm tách");
  });
});

describe("nhãn và tên", () => {
  it("segmentLabel", () => {
    expect(segmentLabel({ from: 3, to: 3 })).toBe("Trang 3");
    expect(segmentLabel({ from: 1, to: 2 })).toBe("Trang 1–2");
  });
  it("defaultTitle không vượt giới hạn", () => {
    expect(defaultTitle("Biên bản", 1, 3)).toBe("Biên bản (phần 2/3)");
    expect(defaultTitle("x".repeat(500), 0, 2).length).toBeLessThanOrEqual(MAX_TITLE);
  });
  it("validateTitle", () => {
    expect(validateTitle("")).toBeNull();
    expect(validateTitle("x".repeat(301))).toContain("300");
  });
  it("thumbUrl", () => expect(thumbUrl("abc", 4)).toBe("/api/v1/files/abc/pages/4/preview?w=160"));
});
