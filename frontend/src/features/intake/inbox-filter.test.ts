import { describe, expect, it } from "vitest";
import { inboxHref, inboxQuery, isFiltered, NO_FILTERS, parseInboxFilters } from "./inbox-filter";

const BATCH = "3f2b6c1e-8a4d-4c1f-9e0a-5b7d2c9a1e44";

describe("parseInboxFilters", () => {
  it("không có tham số thì không lọc", () => {
    expect(parseInboxFilters({})).toEqual(NO_FILTERS);
    expect(isFiltered(NO_FILTERS)).toBe(false);
  });

  it("đọc tình trạng, lô và nhóm; lô viết hoa được đưa về chữ thường", () => {
    const filters = parseInboxFilters({ doc: "loi", lo: BATCH.toUpperCase(), nhom: "U15" });
    expect(filters).toEqual({ doc: "loi", batch: BATCH, group: "U15" });
    expect(isFiltered(filters)).toBe(true);
  });

  it("giá trị lạ hoặc sai dạng bị bỏ, không đi lên API", () => {
    expect(parseInboxFilters({ doc: "xoa-het", lo: "không-phải-uuid", nhom: "U15; DROP TABLE" })).toEqual(NO_FILTERS);
    expect(parseInboxFilters({ nhom: "x".repeat(21) }).group).toBeNull();
  });

  it("tham số lặp thì lấy giá trị đầu", () => {
    expect(parseInboxFilters({ doc: ["da-doc", "loi"] }).doc).toBe("da-doc");
  });
});

describe("inboxQuery", () => {
  it("không lọc thì không có tham số nào", () => {
    expect(inboxQuery(NO_FILTERS)).toEqual({});
  });

  it("đổi nút lọc sang giá trị API, nút Lỗi gồm cả lỗi và đã hủy", () => {
    expect(inboxQuery({ doc: "da-doc", batch: null, group: null })).toEqual({ read: "ready" });
    expect(inboxQuery({ doc: "loi", batch: BATCH, group: "U15" })).toEqual({ read: "failed,cancelled", batch: BATCH, group: "U15" });
  });
});

describe("inboxHref", () => {
  it("thẻ mặc định không có tham số", () => {
    expect(inboxHref("cho-xep")).toBe("/tiep-nhan");
  });

  it("giữ thẻ khác và bộ lọc, bỏ tham số mặc định", () => {
    expect(inboxHref("da-xep", { doc: "tat-ca", batch: BATCH })).toBe(`/tiep-nhan?trang-thai=da-xep&lo=${BATCH}`);
    expect(inboxHref("cho-xep", { doc: "loi", group: "U15" })).toBe("/tiep-nhan?doc=loi&nhom=U15");
  });

  it("đường dẫn dựng ra đọc lại được đúng bộ lọc ban đầu", () => {
    const original = { doc: "dang-doc" as const, batch: BATCH, group: "U02" };
    const url = new URL(inboxHref("cho-xep", original), "http://x");
    expect(parseInboxFilters(Object.fromEntries(url.searchParams))).toEqual(original);
  });
});
