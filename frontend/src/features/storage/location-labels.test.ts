import { describe, expect, it } from "vitest";
import { filterLocations, indentClass, KIND_LABELS, subtreeCounts } from "./location-labels";

const nodes = [
  { code: "KHO-1", name: "Kho lưu trữ", path: "Kho lưu trữ" },
  { code: "TU-A", name: "Tủ A", path: "Kho lưu trữ › Phòng 1 › Tủ A" },
  { code: "HOP-07", name: "Hộp 07", path: "Kho lưu trữ › Phòng 2 › Hộp 07" },
];

describe("lọc vị trí kho", () => {
  it("gõ không dấu, không phân biệt hoa thường, mọi từ đều phải khớp trong mã, tên hoặc đường dẫn", () => {
    expect(filterLocations(nodes, "tu a").map((n) => n.code)).toEqual(["TU-A"]);
    expect(filterLocations(nodes, "phong 2").map((n) => n.code)).toEqual(["HOP-07"]);
    expect(filterLocations(nodes, "kho luu tru").map((n) => n.code)).toEqual(["KHO-1", "TU-A", "HOP-07"]);
    expect(filterLocations(nodes, "hop-07").map((n) => n.code)).toEqual(["HOP-07"]);
    expect(filterLocations(nodes, "khong co")).toEqual([]);
    expect(filterLocations(nodes, "  ")).toBe(nodes);
  });
});

describe("thụt lề và nhãn cấp", () => {
  it("thụt lề theo cấp và chặn ở bậc 4", () => {
    expect(indentClass(0)).toBe("pl-0");
    expect(indentClass(3)).toBe("pl-12");
    expect(indentClass(9)).toBe("pl-16");
    expect(indentClass(-1)).toBe("pl-0");
  });

  it("đủ 5 cấp của cây vị trí", () => {
    expect(Object.keys(KIND_LABELS)).toEqual(["warehouse", "room", "cabinet", "shelf", "box"]);
  });
});

describe("cộng dồn số hồ sơ theo cây", () => {
  const tree = [
    { id: "kho", parentId: null, dossierCount: 0 },
    { id: "phong1", parentId: "kho", dossierCount: 0 },
    { id: "tu", parentId: "phong1", dossierCount: 0 },
    { id: "ke", parentId: "tu", dossierCount: 3 },
    { id: "hop", parentId: "ke", dossierCount: 2 },
    { id: "phong2", parentId: "kho", dossierCount: 0 },
    { id: "hop2", parentId: "phong2", dossierCount: 4 },
  ];

  it("mỗi vị trí gồm chính nó và mọi vị trí con", () => {
    const totals = subtreeCounts(tree);
    expect(totals.get("hop")).toBe(2);
    expect(totals.get("ke")).toBe(5);
    expect(totals.get("tu")).toBe(5);
    expect(totals.get("phong1")).toBe(5);
    expect(totals.get("phong2")).toBe(4);
    expect(totals.get("kho")).toBe(9);
  });

  it("không phụ thuộc thứ tự đầu vào và không lặp vô hạn khi dữ liệu có vòng", () => {
    expect(subtreeCounts([...tree].reverse()).get("kho")).toBe(9);
    const loop = [{ id: "a", parentId: "b", dossierCount: 1 }, { id: "b", parentId: "a", dossierCount: 2 }];
    expect(() => subtreeCounts(loop)).not.toThrow();
  });
});
