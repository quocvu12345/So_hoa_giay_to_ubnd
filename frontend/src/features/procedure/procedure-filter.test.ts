import { describe, expect, it } from "vitest";
import { groupBySection, hasFilter, isProcedureId, isRetired, pageCount, parseProcedureFilter, procedureListHref, quantityLabel } from "./procedure-filter";

describe("parseProcedureFilter", () => {
  it("rỗng thì mặc định", () => expect(parseProcedureFilter({})).toEqual({ q: "", domain: "", level: "", status: "", page: 1 }));
  it("đọc đủ tham số, cắt khoảng trắng", () => {
    expect(parseProcedureFilter({ q: "  khai sinh ", "linh-vuc": "Hộ tịch", cap: "Cấp xã", "hieu-luc": "active", trang: "3" })).toEqual({ q: "khai sinh", domain: "Hộ tịch", level: "Cấp xã", status: "active", page: 3 });
  });
  it("tình trạng lạ bị bỏ; trang sai về 1", () => {
    expect(parseProcedureFilter({ "hieu-luc": "hack" }).status).toBe("");
    for (const bad of ["0", "-2", "abc", "1.5x", "99999999"]) expect(parseProcedureFilter({ trang: bad }).page, bad).toBe(1);
  });
  it("lấy giá trị đầu khi tham số lặp", () => expect(parseProcedureFilter({ q: ["a", "b"] }).q).toBe("a"));
});

describe("procedureListHref", () => {
  const base = parseProcedureFilter({});
  it("không lọc thì chỉ /thu-tuc", () => expect(procedureListHref(base)).toBe("/thu-tuc"));
  it("mã hóa chữ tiếng Việt, bỏ trang 1", () => {
    const href = procedureListHref({ ...base, q: "khai sinh", domain: "Hộ tịch", page: 1 });
    expect(href).toBe("/thu-tuc?q=khai+sinh&linh-vuc=H%E1%BB%99+t%E1%BB%8Bch");
    expect(parseProcedureFilter(Object.fromEntries(new URLSearchParams(href.split("?")[1])))).toMatchObject({ q: "khai sinh", domain: "Hộ tịch" });
  });
  it("đổi bộ lọc thì về trang 1 nếu gọi nơi patch page", () => expect(procedureListHref({ ...base, q: "x", page: 4 }, { page: 1 })).toBe("/thu-tuc?q=x"));
  it("trang sau", () => expect(procedureListHref({ ...base, q: "x" }, { page: 2 })).toBe("/thu-tuc?q=x&trang=2"));
});

describe("tiện ích", () => {
  it("hasFilter không tính trang", () => {
    expect(hasFilter({ ...parseProcedureFilter({}), page: 5 })).toBe(false);
    expect(hasFilter(parseProcedureFilter({ cap: "Cấp xã" }))).toBe(true);
  });
  it("pageCount", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(25)).toBe(1);
    expect(pageCount(26)).toBe(2);
  });
  it("thủ tục đã bãi bỏ hoặc thay thế không tạo hồ sơ mới", () => {
    expect(isRetired("repealed")).toBe(true);
    expect(isRetired("replaced")).toBe(true);
    expect(isRetired("active")).toBe(false);
    expect(isRetired("unverified")).toBe(false);
  });
  it("mã thủ tục chỉ chữ số, chữ, . _ -", () => {
    expect(isProcedureId("hn87-394")).toBe(true);
    expect(isProcedureId("dvc-019d2bfc-d9eb-70ae-b868-7f942b5d3dd9")).toBe(true);
    for (const bad of ["", "../x", "a/b", "a b", "a?b", "-x", "x".repeat(101)]) expect(isProcedureId(bad), bad).toBe(false);
  });
  it("gom theo mục theo thứ tự vị trí", () => {
    const groups = groupBySection([
      { section: "b) Số lượng", position: 3, name: "C" }, { section: "a) Hồ sơ gồm", position: 2, name: "B" }, { section: "a) Hồ sơ gồm", position: 1, name: "A" },
    ]);
    expect(groups.map((g) => [g.section, g.items.map((i) => i.name)])).toEqual([["a) Hồ sơ gồm", ["A", "B"]], ["b) Số lượng", ["C"]]]);
  });
  it("số lượng bản", () => {
    expect(quantityLabel(1, 2)).toBe("1 bản chính, 2 bản sao");
    expect(quantityLabel(1, 0)).toBe("1 bản chính");
    expect(quantityLabel(0, 0)).toBe("");
  });
});
