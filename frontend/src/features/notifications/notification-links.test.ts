import { describe, expect, it } from "vitest";
import { bellLabel, kindLabel, mergePages, notificationHref } from "./notification-links";

describe("notificationHref", () => {
  it("nhận đường dẫn trong ứng dụng", () => {
    expect(notificationHref({ link: "/ho-so/abc", dossierId: null })).toBe("/ho-so/abc");
  });
  it("không bao giờ trỏ ra ngoài", () => {
    expect(notificationHref({ link: "//evil.example/x", dossierId: null })).toBeNull();
    expect(notificationHref({ link: "https://evil.example", dossierId: null })).toBeNull();
    expect(notificationHref({ link: "/\\evil.example", dossierId: null })).toBeNull();
    expect(notificationHref({ link: "javascript:alert(1)", dossierId: null })).toBeNull();
  });
  it("link xấu thì rơi về hồ sơ nếu có", () => {
    expect(notificationHref({ link: "//evil.example", dossierId: "11111111-1111-1111-1111-111111111111" })).toBe("/ho-so/11111111-1111-1111-1111-111111111111");
  });
  it("không có gì thì null", () => {
    expect(notificationHref({ link: null, dossierId: null })).toBeNull();
    expect(notificationHref({ link: "  ", dossierId: null })).toBeNull();
  });
});

describe("bellLabel", () => {
  it("ẩn khi 0, rút gọn khi nhiều", () => {
    expect(bellLabel(0)).toBeNull();
    expect(bellLabel(-3)).toBeNull();
    expect(bellLabel(7)).toBe("7");
    expect(bellLabel(99)).toBe("99");
    expect(bellLabel(100)).toBe("99+");
  });
});

describe("mergePages", () => {
  it("bỏ dòng trùng theo mã, giữ thứ tự", () => {
    expect(mergePages([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }]).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
});

describe("kindLabel", () => {
  it("gom theo tiền tố, loại lạ là Hồ sơ", () => {
    expect(kindLabel("archive.received")).toBe("Nộp lưu");
    expect(kindLabel("loan.overdue")).toBe("Mượn trả");
    expect(kindLabel("dossier.due")).toBe("Hạn hồ sơ");
    expect(kindLabel("overdue")).toBe("Hạn hồ sơ");
    expect(kindLabel("returned")).toBe("Hồ sơ");
    expect(kindLabel("loanx")).toBe("Hồ sơ");
  });
});
