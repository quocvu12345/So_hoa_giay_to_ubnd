import { describe, expect, it } from "vitest";
import { highlight, queryTokens } from "./highlight";

describe("từ khóa tra cứu", () => {
  it("tách từ, bỏ dấu, bỏ trùng", () => {
    expect(queryTokens("Kiểm tra  kiểm TRA hiện trạng")).toEqual(["kiem", "tra", "hien", "trang"]);
    expect(queryTokens("26/KH-UBND")).toEqual(["26", "kh", "ubnd"]);
    expect(queryTokens("  ")).toEqual([]);
  });
});

describe("tô đậm đoạn trích", () => {
  it("gõ không dấu vẫn tô được chữ có dấu, giữ nguyên chữ gốc", () => {
    expect(highlight("Biên bản kiểm tra hiện trường", "kiem tra")).toEqual([
      { text: "Biên bản ", match: false },
      { text: "kiểm", match: true },
      { text: " ", match: false },
      { text: "tra", match: true },
      { text: " hiện trường", match: false },
    ]);
  });
  it("không phân biệt hoa thường, xử lý chữ đ", () => {
    expect(highlight("Đất đai", "DAT")).toEqual([
      { text: "Đất", match: true },
      { text: " đai", match: false },
    ]);
  });
  it("khớp tiền tố giữa từ cũng tô phần khớp", () => {
    expect(highlight("hợp đồng", "hop")).toEqual([
      { text: "hợp", match: true },
      { text: " đồng", match: false },
    ]);
  });
  it("không có từ khóa hoặc không khớp thì trả nguyên đoạn", () => {
    expect(highlight("Công văn", "")).toEqual([{ text: "Công văn", match: false }]);
    expect(highlight("Công văn", "xyz")).toEqual([{ text: "Công văn", match: false }]);
  });
});
