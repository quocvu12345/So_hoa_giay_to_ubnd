import { describe, expect, it } from "vitest";
import { foldText } from "@/features/dossier/assign-rules";
import { groupByDepartment, isValidPattern, toCount, validateDocumentType, validateField, validateGroup, validateLegalReference, validateRetention } from "./catalog-rules";

const fold = foldText;

describe("validateGroup", () => {
  it("mã nhóm 2–10 ký tự chữ số, bắt đầu bằng chữ", () => {
    for (const bad of ["", "U", "1U", "U 35", "U-35", "UUUUUUUUUUU"]) expect(validateGroup({ code: bad, title: "Tên", organizationCode: "o", departmentCode: "d" }, "create").code, bad).toBeTruthy();
    expect(validateGroup({ code: "U35", title: "Tên", organizationCode: "o", departmentCode: "d" }, "create")).toEqual({});
  });
  it("sửa không đòi mã/cơ quan/đơn vị", () => expect(validateGroup({ title: "Tên mới" }, "edit")).toEqual({}));
  it("tên bắt buộc, tối đa 300", () => {
    expect(validateGroup({ title: "  " }, "edit").title).toBeTruthy();
    expect(validateGroup({ title: "x".repeat(301) }, "edit").title).toBeTruthy();
  });
});

describe("validateDocumentType", () => {
  it("tên và số lượng tối thiểu", () => {
    expect(validateDocumentType({ name: "", minCount: "" }).name).toBeTruthy();
    expect(validateDocumentType({ name: "Tờ trình", minCount: "" })).toEqual({});
    expect(validateDocumentType({ name: "Tờ trình", minCount: "100" })).toEqual({});
    for (const bad of ["101", "-1", "a", "1.5"]) expect(validateDocumentType({ name: "Tờ trình", minCount: bad }).minCount, bad).toBeTruthy();
  });
});

describe("validateField", () => {
  it("kiểu giá trị và biểu thức", () => {
    expect(validateField({ label: "Số", valueType: "text", validationPattern: "" })).toEqual({});
    expect(validateField({ label: "Số", valueType: "hack", validationPattern: "" }).valueType).toBeTruthy();
    expect(validateField({ label: "Số", valueType: "text", validationPattern: "(" }).validationPattern).toBeTruthy();
    expect(validateField({ label: "Số", valueType: "text", validationPattern: "^\\d+$" })).toEqual({});
  });
  it("isValidPattern", () => {
    expect(isValidPattern("")).toBe(true);
    expect(isValidPattern("[a-")).toBe(false);
  });
});

describe("validateRetention", () => {
  it("thời hạn và số năm", () => {
    expect(validateRetention({ retentionLabel: "20 năm", retentionYears: "20" })).toEqual({});
    expect(validateRetention({ retentionLabel: "Vĩnh viễn", retentionYears: "" })).toEqual({});
    expect(validateRetention({ retentionLabel: "", retentionYears: "20" }).retentionLabel).toBeTruthy();
    expect(validateRetention({ retentionLabel: "x", retentionYears: "201" }).retentionYears).toBeTruthy();
    expect(validateRetention({ retentionLabel: "x", retentionYears: "-1" }).retentionYears).toBeTruthy();
  });
  it("căn cứ pháp lý từ 5 ký tự", () => {
    expect(validateLegalReference("TT 1")).toContain("từ 5");
    expect(validateLegalReference("Thông tư 01/2020/TT-BNV")).toBeNull();
  });
});

describe("toCount", () => {
  it("rỗng là null", () => {
    expect(toCount("")).toBeNull();
    expect(toCount(" 12 ")).toBe(12);
  });
});

describe("groupByDepartment", () => {
  const groups = [
    { code: "U10", title: "Quản lý đất đai", departmentCode: "ht" }, { code: "U2", title: "Ngân sách", departmentCode: "kt" }, { code: "U15", title: "Đường giao thông", departmentCode: "ht" },
  ];
  it("gom theo đơn vị, sắp mã theo số", () => {
    const result = groupByDepartment(groups, "", fold);
    expect(result.map((g) => [g.department, g.items.map((i) => i.code)])).toEqual([["kt", ["U2"]], ["ht", ["U10", "U15"]]]);
  });
  it("tìm không dấu theo mã hoặc tên", () => {
    expect(groupByDepartment(groups, "duong", fold)[0].items.map((i) => i.code)).toEqual(["U15"]);
    expect(groupByDepartment(groups, "u2", fold).flatMap((g) => g.items.map((i) => i.code))).toEqual(["U2"]);
    expect(groupByDepartment(groups, "khong co", fold)).toEqual([]);
  });
});
