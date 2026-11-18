import { describe, expect, it } from "vitest";
import { allState, describeSelection, pruneSelection, setMany, toggleId } from "./inbox-selection";

describe("chọn nhiều PDF", () => {
  it("toggleId thêm rồi bỏ, không sửa tập đầu vào", () => {
    const empty = new Set<string>();
    const one = toggleId(empty, "a");
    expect([...one]).toEqual(["a"]);
    expect(empty.size).toBe(0);
    expect([...toggleId(one, "a")]).toEqual([]);
  });

  it("setMany chọn hoặc bỏ cả nhóm và giữ lựa chọn ngoài nhóm", () => {
    const base = new Set(["x"]);
    expect([...setMany(base, ["a", "b"], true)].sort()).toEqual(["a", "b", "x"]);
    expect([...setMany(new Set(["a", "b", "x"]), ["a", "b"], false)]).toEqual(["x"]);
  });

  it("pruneSelection bỏ PDF không còn hiện; không đổi gì thì trả đúng tập cũ", () => {
    const selected = new Set(["a", "b", "c"]);
    expect([...pruneSelection(selected, ["a", "c", "d"])].sort()).toEqual(["a", "c"]);
    expect(pruneSelection(selected, ["a", "b", "c", "d"])).toBe(selected);
    expect(pruneSelection(new Set(), [])).toBeInstanceOf(Set);
  });

  it("allState theo các dòng đang hiện", () => {
    expect(allState(new Set(), [])).toBe("none");
    expect(allState(new Set(["z"]), ["a", "b"])).toBe("none");
    expect(allState(new Set(["a"]), ["a", "b"])).toBe("some");
    expect(allState(new Set(["a", "b", "z"]), ["a", "b"])).toBe("all");
  });

  it("describeSelection tách PDF đã đọc xong (xếp được) khỏi PDF chưa đọc xong", () => {
    const items = [
      { documentId: "a", stage: "ready" },
      { documentId: "b", stage: "reading" },
      { documentId: "c", stage: "failed" },
      { documentId: "d", stage: "ready" },
    ];
    expect(describeSelection(items, new Set(["a", "b", "z"]))).toEqual({ total: 2, readyIds: ["a"], skipped: 1 });
    expect(describeSelection(items, new Set())).toEqual({ total: 0, readyIds: [], skipped: 0 });
  });
});
