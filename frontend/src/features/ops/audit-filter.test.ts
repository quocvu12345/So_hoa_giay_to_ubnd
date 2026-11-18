import { describe, expect, it } from "vitest";
import { dayEndExclusive, dayStart, normalizeErrorId, parseAuditFilter, toSearchParams } from "./audit-filter";

describe("mã lỗi", () => {
  it("chuẩn hóa chữ hoa, bỏ khoảng trắng, kiểm đúng 8 ký tự hex", () => {
    expect(normalizeErrorId(" 9fa13718 ")).toEqual({ value: "9FA13718", valid: true });
    for (const bad of ["", "9FA1371", "9FA137189", "GGGGGGGG", "9FA1 3718"]) expect(normalizeErrorId(bad).valid).toBe(false);
  });
});

describe("parseAuditFilter", () => {
  it("mặc định xem theo Mã lỗi", () => {
    expect(parseAuditFilter({})).toMatchObject({ view: "loi", errorId: "", from: "", to: "", before: "" });
  });

  it("có nhập mã lỗi thì luôn xem theo Mã lỗi dù đường dẫn ghi xem khác, và chuẩn hóa chữ hoa", () => {
    expect(parseAuditFilter({ xem: "truy-cap", "ma-loi": "9fa13718" })).toMatchObject({ view: "loi", errorId: "9FA13718" });
    expect(parseAuditFilter({ xem: "thay-doi" }).view).toBe("thay-doi");
    expect(parseAuditFilter({ xem: "khong-co" }).view).toBe("loi");
  });

  it("làm sạch giá trị: ngày sai, mã tương quan có ký tự lạ, con trỏ không phải số", () => {
    const f = parseAuditFilter({ "tu-ngay": "2026-13-45", "den-ngay": "2026-11-18", "tuong-quan": "abc-123; DROP", "doi-tuong": "file<script>", truoc: "12; x" });
    expect(f).toMatchObject({ from: "", to: "2026-11-18", correlationId: "abc-123DROP", objectType: "filescript", before: "" });
    expect(parseAuditFilter({ truoc: "123456" }).before).toBe("123456");
  });
});

describe("lọc theo ngày giờ Việt Nam", () => {
  it("đầu ngày là 00:00 +07:00; 'đến ngày X' lấy hết ngày X", () => {
    expect(dayStart("2026-11-18")).toBe("2026-11-18T00:00:00+07:00");
    expect(dayEndExclusive("2026-11-18")).toBe("2026-11-19T00:00:00+07:00");
    expect(dayEndExclusive("2026-12-31")).toBe("2027-01-01T00:00:00+07:00");
    expect(dayEndExclusive("2026-02-28")).toBe("2026-03-01T00:00:00+07:00");
  });
});

describe("toSearchParams", () => {
  it("mã lỗi đứng một mình, không kèm xem=; quay lại đúng bộ lọc", () => {
    const f = parseAuditFilter({ "ma-loi": "9fa13718", "tu-ngay": "2026-11-01" });
    expect(toSearchParams(f).toString()).toBe("ma-loi=9FA13718&tu-ngay=2026-11-01");
    const again = parseAuditFilter(Object.fromEntries(toSearchParams(f)));
    expect(again).toEqual(f);
    expect(toSearchParams(parseAuditFilter({ xem: "truy-cap", "tuong-quan": "x1" }), "99").toString()).toBe("xem=truy-cap&tuong-quan=x1&truoc=99");
    expect(toSearchParams(parseAuditFilter({})).toString()).toBe("");
  });
});
