import { describe, expect, it } from "vitest";
import { ariaSort, exportHref, isFiltered, parseDossierFilter, sortedBy, toApiQuery, toSearchParams, yearOptions } from "./dossier-filter";

const ID = "11111111-2222-3333-4444-555555555555";

describe("parseDossierFilter", () => {
  it("không có tham số thì mặc định: mới cập nhật, giảm dần, chưa lọc", () => {
    const f = parseDossierFilter({});
    expect(f).toMatchObject({ q: "", year: null, overdue: false, assignee: "", location: "", sort: "cap-nhat", descending: true });
    expect(isFiltered(f)).toBe(false);
  });

  it("đọc đủ bộ lọc từ URL và chiều mặc định theo từng cột", () => {
    const f = parseDossierFilter({ q: " đất ", nam: "2025", "qua-han": "1", nguoi: ID, "vi-tri": ID, "sap-xep": "han", "cua-toi": "1" });
    expect(f).toMatchObject({ q: "đất", year: 2025, overdue: true, assignee: ID, location: ID, sort: "han", descending: false, mine: true });
    expect(isFiltered(f)).toBe(true);
    expect(parseDossierFilter({ "sap-xep": "ma", chieu: "giam" }).descending).toBe(true);
    expect(parseDossierFilter({ chieu: "tang" }).descending).toBe(false);
  });

  it("nhận nhiều trạng thái và nhóm cách nhau dấu phẩy, và đơn vị; bỏ giá trị lạ", () => {
    const f = parseDossierFilter({ "trang-thai": "draft,returned", nhom: "H01,H02", phong: "ht" });
    expect(f).toMatchObject({ status: "draft,returned", workGroup: "H01,H02", department: "ht" });
    expect(toApiQuery(f)).toMatchObject({ Status: "draft,returned", WorkGroup: "H01,H02", Department: "ht" });
    expect(isFiltered(parseDossierFilter({ phong: "ht" }))).toBe(true);
    expect(parseDossierFilter({ "trang-thai": "draft,,returned" }).status).toBe("");
    expect(parseDossierFilter({ nhom: "H01; DROP" }).workGroup).toBe("");
    expect(parseDossierFilter({ nhom: Array.from({ length: 13 }, (_, i) => `H${i}`).join(",") }).workGroup).toBe("");
    expect(parseDossierFilter({ phong: "a,b" }).department).toBe("a");
    const url = Object.fromEntries(toSearchParams(f));
    expect(parseDossierFilter(url)).toEqual(f);
  });

  it("bỏ giá trị sai thay vì gửi lên API: năm lạ, mã không phải UUID, cột lạ", () => {
    const f = parseDossierFilter({ nam: "20x6", nguoi: "khong-phai-uuid", "vi-tri": "1; DROP", "sap-xep": "bat-ky", "qua-han": "co" });
    expect(f).toMatchObject({ year: null, assignee: "", location: "", sort: "cap-nhat", overdue: false });
    expect(parseDossierFilter({ nam: "1800" }).year).toBeNull();
    expect(parseDossierFilter({ nam: "2300" }).year).toBeNull();
    expect(parseDossierFilter({ q: ["a", "b"] }).q).toBe("a");
  });
});

describe("toSearchParams", () => {
  it("bỏ giá trị mặc định và quay lại đúng bộ lọc đã đọc", () => {
    expect(toSearchParams(parseDossierFilter({})).toString()).toBe("");
    const url = { q: "đất", nam: "2025", "qua-han": "1", "sap-xep": "ma", chieu: "giam" };
    const again = parseDossierFilter(Object.fromEntries(toSearchParams(parseDossierFilter(url))));
    expect(again).toEqual(parseDossierFilter(url));
    expect(toSearchParams(parseDossierFilter({ "sap-xep": "ma" })).get("chieu")).toBeNull();
    expect(toSearchParams(parseDossierFilter({}), "abc").get("cursor")).toBe("abc");
  });
});

describe("sắp xếp theo cột", () => {
  it("bấm cột đang sắp thì đảo chiều, cột khác thì dùng chiều mặc định, và luôn về trang đầu", () => {
    const base = { ...parseDossierFilter({ cursor: "trang-2" }) };
    const byCode = sortedBy(base, "ma");
    expect(byCode).toMatchObject({ sort: "ma", descending: false, cursor: "" });
    expect(sortedBy(byCode, "ma").descending).toBe(true);
    expect(sortedBy(sortedBy(byCode, "ma"), "ma").descending).toBe(false);
    expect(sortedBy(byCode, "cap-nhat").descending).toBe(true);
  });

  it("aria-sort đúng cho cột đang sắp và các cột còn lại", () => {
    const f = parseDossierFilter({ "sap-xep": "han", chieu: "giam" });
    expect(ariaSort(f, "han")).toBe("descending");
    expect(ariaSort(f, "ma")).toBe("none");
    expect(ariaSort(parseDossierFilter({ "sap-xep": "ten" }), "ten")).toBe("ascending");
  });
});

describe("tham số gửi API và đường dẫn xuất CSV", () => {
  it("dùng tên PascalCase của .NET, chỉ đặt tham số có giá trị, luôn kèm thứ tự", () => {
    const f = parseDossierFilter({ nam: "2026", "qua-han": "1", nguoi: ID, "sap-xep": "han" });
    expect(toApiQuery(f)).toEqual({ Year: 2026, Overdue: true, Assignee: ID, Sort: "due", Dir: "asc" });
    expect(toApiQuery(parseDossierFilter({}))).toEqual({ Sort: "updated", Dir: "desc" });
  });

  it("CSV cùng bộ lọc, không có con trỏ trang, thoát đúng ký tự", () => {
    const href = exportHref(parseDossierFilter({ q: "đất & nước", nam: "2025", cursor: "x" }));
    expect(href.startsWith("/api/v1/dossiers/export.csv?")).toBe(true);
    const query = new URLSearchParams(href.split("?")[1]);
    expect(query.get("Q")).toBe("đất & nước");
    expect(query.get("Year")).toBe("2025");
    expect(query.has("Cursor")).toBe(false);
  });
});

describe("yearOptions", () => {
  it("năm hiện tại và 7 năm trước; giữ năm đang lọc nếu ngoài khoảng", () => {
    const now = new Date("2026-11-18T00:00:00Z");
    expect(yearOptions(now, null)).toEqual([2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019]);
    expect(yearOptions(now, 2010)).toContain(2010);
    expect(yearOptions(now, 2025)).toHaveLength(8);
  });
});
