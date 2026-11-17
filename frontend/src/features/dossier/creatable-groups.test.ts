import { describe, expect, it } from "vitest";
import { creatableGroups } from "./creatable-groups";

const groups = [
  { code: "U01", title: "Công văn", organizationCode: "tl-ubnd", departmentCode: "vp" },
  { code: "U15", title: "Đất đai", organizationCode: "tl-ubnd", departmentCode: "ht" },
  { code: "U16", title: "Môi trường", organizationCode: "tl-ubnd", departmentCode: "ht" },
  { code: "H01", title: "Kỳ họp", organizationCode: "tl-hdnd", departmentCode: "tt" },
];

describe("nhóm hồ sơ được phép tạo", () => {
  it("chuyên viên và trưởng phòng chỉ trong đơn vị của mình", () => {
    expect(creatableGroups(groups, { role: "employee", organizationCode: "tl-ubnd", departmentCode: "ht" }).map((g) => g.code)).toEqual(["U15", "U16"]);
    expect(creatableGroups(groups, { role: "manager", organizationCode: "tl-ubnd", departmentCode: "vp" }).map((g) => g.code)).toEqual(["U01"]);
  });
  it("văn thư trong cả cơ quan, không sang cơ quan khác", () => {
    expect(creatableGroups(groups, { role: "clerk", organizationCode: "tl-ubnd", departmentCode: null }).map((g) => g.code)).toEqual(["U01", "U15", "U16"]);
    expect(creatableGroups(groups, { role: "clerk", organizationCode: "tl-hdnd", departmentCode: null }).map((g) => g.code)).toEqual(["H01"]);
  });
  it("lãnh đạo, quản trị kỹ thuật hoặc phân công không có cơ quan thì không tạo được", () => {
    expect(creatableGroups(groups, { role: "chair", organizationCode: "tl-ubnd", departmentCode: null })).toEqual([]);
    expect(creatableGroups(groups, { role: "technical_admin", organizationCode: null, departmentCode: null })).toEqual([]);
  });
});
