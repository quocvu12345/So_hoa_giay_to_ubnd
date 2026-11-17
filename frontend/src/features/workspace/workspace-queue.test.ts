import { describe, expect, it } from "vitest";
import { orderQueue, priority, sectionsFor, type QueueRow } from "./workspace-queue";

const now = new Date("2026-11-17T03:00:00Z");
const row = (id: string, status: string, dueOn: string | null, updatedAt = "2026-11-10T00:00:00Z"): QueueRow & { id: string } => ({ id, dossierId: id, status, dueOn, updatedAt });

describe("hàng việc theo vai trò", () => {
  it("mỗi vai trò mở ra đúng hàng mặc định", () => {
    expect(sectionsFor("employee").map((s) => s.kind)).toEqual(["assigned"]);
    expect(sectionsFor("manager").map((s) => s.kind)).toEqual(["to_review", "assigned"]);
    expect(sectionsFor("clerk").map((s) => s.kind)).toEqual(["to_archive", "assigned"]);
    expect(sectionsFor("chair").map((s) => s.kind)).toEqual(["to_decide"]);
    expect(sectionsFor("council").map((s) => s.kind)).toEqual(["to_decide"]);
    expect(sectionsFor("technical_admin")).toEqual([]);
  });
});

describe("thứ tự ưu tiên", () => {
  it("mức: quá hạn, bị trả lại, sắp đến hạn, còn lại", () => {
    expect(priority({ status: "draft", dueOn: "2026-11-15" }, now)).toBe(0);
    expect(priority({ status: "returned", dueOn: null }, now)).toBe(1);
    expect(priority({ status: "draft", dueOn: "2026-11-19" }, now)).toBe(2);
    expect(priority({ status: "draft", dueOn: "2026-11-30" }, now)).toBe(3);
    expect(priority({ status: "draft", dueOn: null }, now)).toBe(3);
  });
  it("quá hạn lên đầu dù đang chuẩn bị; bị trả lại trước việc thường", () => {
    const ordered = orderQueue([row("a", "draft", null), row("b", "returned", null), row("c", "draft", "2026-11-10"), row("d", "draft", "2026-11-18")], now);
    expect(ordered.map((r) => r.id)).toEqual(["c", "b", "d", "a"]);
  });
  it("cùng mức: hạn gần trước, không hạn ở cuối, mới cập nhật trước", () => {
    const ordered = orderQueue([row("x", "draft", "2026-12-20"), row("y", "draft", "2026-12-01"), row("z", "draft", null, "2026-11-16T00:00:00Z"), row("w", "draft", null, "2026-11-12T00:00:00Z")], now);
    expect(ordered.map((r) => r.id)).toEqual(["y", "x", "z", "w"]);
  });
  it("không đổi mảng gốc", () => {
    const input = [row("a", "draft", null), row("b", "returned", null)];
    orderQueue(input, now);
    expect(input.map((r) => r.id)).toEqual(["a", "b"]);
  });
});
