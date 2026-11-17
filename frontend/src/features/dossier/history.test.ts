import { describe, expect, it } from "vitest";
import type { HistoryItem } from "./dossier-data";
import { actionKinds } from "./history";

const item = (id: number, action: string, actionLabel: string): HistoryItem => ({ id, action, actionLabel, fromState: null, toState: "draft", note: "", actorName: "A", actorRole: "employee", at: "2026-11-17T08:00:00Z" });

describe("gom sự kiện nhật ký theo loại", () => {
  it("đếm theo loại và xếp loại nhiều sự kiện lên trước", () => {
    const kinds = actionKinds([item(1, "submit", "Trình"), item(2, "return", "Trả lại"), item(3, "return", "Trả lại"), item(4, "submit", "Trình"), item(5, "return", "Trả lại")]);
    expect(kinds).toEqual([
      { action: "return", label: "Trả lại", count: 3 },
      { action: "submit", label: "Trình", count: 2 },
    ]);
  });
  it("danh sách rỗng thì không có loại nào", () => {
    expect(actionKinds([])).toEqual([]);
  });
});
