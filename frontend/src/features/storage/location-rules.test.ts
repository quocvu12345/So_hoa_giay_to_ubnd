import { describe, expect, it } from "vitest";
import { canHoldDossiers, childKinds, labelsHref, placementChoices, subtreeIds, validateLocation } from "./location-rules";

describe("childKinds", () => {
  it("gốc chỉ là kho; con sâu hơn cha", () => {
    expect(childKinds(null)).toEqual(["warehouse"]);
    expect(childKinds("warehouse")).toEqual(["room", "cabinet", "shelf", "box"]);
    expect(childKinds("cabinet")).toEqual(["shelf", "box"]);
    expect(childKinds("shelf")).toEqual(["box"]);
    expect(childKinds("box")).toEqual([]);
    expect(childKinds("lạ")).toEqual([]);
  });
});

describe("validateLocation", () => {
  it("mã vị trí", () => {
    for (const bad of ["", "-a", "a b", "é", "x".repeat(41)]) expect(validateLocation({ code: bad, name: "Tên" }, "create").code, bad).toBeTruthy();
    for (const good of ["K1", "HOP-07", "a.b_c", "1A"]) expect(validateLocation({ code: good, name: "Tên" }, "create").code, good).toBeUndefined();
  });
  it("tên bắt buộc, tối đa 200; sửa không đòi mã", () => {
    expect(validateLocation({ name: " " }, "edit").name).toBeTruthy();
    expect(validateLocation({ name: "x".repeat(201) }, "edit").name).toBeTruthy();
    expect(validateLocation({ name: "Kệ A" }, "edit")).toEqual({});
  });
});

describe("đặt hồ sơ", () => {
  it("chỉ hộp và kệ", () => {
    expect(canHoldDossiers("box")).toBe(true);
    expect(canHoldDossiers("shelf")).toBe(true);
    expect(canHoldDossiers("cabinet")).toBe(false);
    expect(canHoldDossiers("warehouse")).toBe(false);
  });
  const nodes = [
    { id: "1", parentId: null, kind: "warehouse", name: "Kho", code: "K", path: "Kho", active: true },
    { id: "2", parentId: "1", kind: "shelf", name: "Kệ 2", code: "K2", path: "Kho › Kệ 2", active: true },
    { id: "3", parentId: "1", kind: "shelf", name: "Kệ 10", code: "K10", path: "Kho › Kệ 10", active: true },
    { id: "4", parentId: "2", kind: "box", name: "Hộp", code: "H", path: "Kho › Kệ 2 › Hộp", active: false },
  ];
  it("placementChoices: còn dùng, theo đường dẫn (số tự nhiên)", () => expect(placementChoices(nodes).map((n) => n.id)).toEqual(["2", "3"]));
  it("subtreeIds: gồm gốc và con, bỏ vị trí ngừng dùng mặc định", () => {
    expect(subtreeIds(nodes, "1")).toEqual(["1", "2", "3"]);
    expect(subtreeIds(nodes, "1", true)).toEqual(["1", "2", "4", "3"]);
  });
  it("subtreeIds chịu được dữ liệu vòng", () => {
    const loop = [{ id: "a", parentId: "b", kind: "room", name: "a", code: "a", path: "a", active: true }, { id: "b", parentId: "a", kind: "room", name: "b", code: "b", path: "b", active: true }];
    expect(subtreeIds(loop, "a")).toEqual(["a", "b"]);
  });
});

describe("labelsHref", () => {
  it("dựng địa chỉ; rỗng hoặc quá 240 thì null", () => {
    expect(labelsHref(["a", "b"])).toBe("/api/v1/storage-locations/labels?ids=a,b");
    expect(labelsHref([])).toBeNull();
    expect(labelsHref(Array.from({ length: 241 }, (_, i) => String(i)))).toBeNull();
  });
});
