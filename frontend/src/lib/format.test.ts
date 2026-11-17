import { describe, expect, it } from "vitest";
import { daysUntil, formatDate, formatDateTime } from "./format";

describe("định dạng ngày giờ", () => {
  it("ngày thuần không bị lệch múi giờ", () => {
    expect(formatDate("2026-11-20")).toBe("20/11/2026");
    expect(formatDate(null)).toBe("—");
    expect(formatDate("không phải ngày")).toBe("không phải ngày");
  });
  it("thời điểm hiển thị theo giờ Việt Nam", () => {
    expect(formatDateTime("2026-11-17T08:14:34Z")).toContain("15:14");
    expect(formatDateTime(undefined)).toBe("—");
  });
});

describe("số ngày tới hạn", () => {
  const now = new Date("2026-11-17T03:00:00Z"); // 10:00 ngày 17/11 giờ Việt Nam
  it("âm khi quá hạn, 0 là hôm nay, dương là còn bao nhiêu ngày", () => {
    expect(daysUntil("2026-11-15", now)).toBe(-2);
    expect(daysUntil("2026-11-17", now)).toBe(0);
    expect(daysUntil("2026-11-19", now)).toBe(2);
    expect(daysUntil(null, now)).toBeNull();
  });
  it("tính theo ngày Việt Nam, không theo UTC", () => {
    // 20:00 UTC ngày 17/11 đã là 03:00 ngày 18/11 ở Việt Nam
    expect(daysUntil("2026-11-18", new Date("2026-11-17T20:00:00Z"))).toBe(0);
  });
});
