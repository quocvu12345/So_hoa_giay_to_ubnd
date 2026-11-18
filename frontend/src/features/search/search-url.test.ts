import { describe, expect, it } from "vitest";
import { hasSearchFilters, searchHref, searchParams, type SearchUrlState } from "./search-url";

const base: SearchUrlState = { q: "kế hoạch", kind: "all", workGroup: "", form: "", fromText: "", toText: "", issuer: "" };

describe("địa chỉ tra cứu", () => {
  it("chỉ có từ khóa thì chỉ mang q", () => {
    expect(searchParams(base).toString()).toBe("q=k%E1%BA%BF+ho%E1%BA%A1ch");
    expect(searchHref("/tra-cuu", { ...base, q: "" })).toBe("/tra-cuu");
  });

  it("mang đủ bộ lọc, kể cả cơ quan ban hành, và con trỏ chỉ khi truyền vào", () => {
    const state = { ...base, kind: "documents" as const, workGroup: "U01", form: "Công văn", fromText: "01/01/2026", toText: "31/12/2026", issuer: "Sở Tài chính" };
    const p = searchParams(state, "abc");
    expect(Object.fromEntries(p)).toEqual({
      q: "kế hoạch", loai: "documents", nhom: "U01", "hinh-thuc": "Công văn", "tu-ngay": "01/01/2026", "den-ngay": "31/12/2026", "co-quan": "Sở Tài chính", "con-tro": "abc",
    });
    expect(searchParams(state).has("con-tro")).toBe(false);
  });

  it("không dùng khóa `trang` (đã dùng để mở đúng trang của giấy tờ)", () => {
    expect([...searchParams({ ...base, issuer: "x" }, "y").keys()]).not.toContain("trang");
  });

  it("hasSearchFilters không tính từ khóa", () => {
    expect(hasSearchFilters(base)).toBe(false);
    expect(hasSearchFilters({ ...base, issuer: "UBND" })).toBe(true);
    expect(hasSearchFilters({ ...base, kind: "dossiers" })).toBe(true);
  });
});
