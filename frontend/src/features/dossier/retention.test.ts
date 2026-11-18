import { describe, expect, it } from "vitest";
import { describeRetention, type DossierRetention } from "./retention";

const base: DossierRetention = { status: "confirmed", label: "20 năm", years: 20, legalReference: "Luật Lưu trữ 2011", eligibleSince: null, eligible: false };

describe("describeRetention", () => {
  it("quy tắc đã xác nhận, hồ sơ chưa lưu trữ: nêu số năm và căn cứ, chưa có ngày đủ hạn", () => {
    expect(describeRetention(base)).toEqual({ text: "20 năm · Luật Lưu trữ 2011", hint: "Hạn tính từ ngày hồ sơ được lưu trữ.", tone: "neutral" });
  });

  it("đã lưu trữ chưa đủ hạn thì báo ngày đủ hạn; đủ hạn thì nhắc có thể đề nghị hủy", () => {
    const waiting = describeRetention({ ...base, eligibleSince: "2046-11-12T00:00:00+00:00" });
    expect(waiting.hint).toMatch(/^Đủ hạn từ \d{2}\/\d{2}\/2046\.$/);
    expect(waiting.tone).toBe("ok");
    const due = describeRetention({ ...base, eligibleSince: "2020-01-05T00:00:00+00:00", eligible: true });
    expect(due.hint).toMatch(/Đã đủ hạn từ .*có thể đề nghị hủy/);
    expect(due.tone).toBe("warn");
  });

  it("thiếu nhãn hoặc căn cứ vẫn ra câu dùng được", () => {
    expect(describeRetention({ ...base, label: null, legalReference: null }).text).toBe("20 năm");
    expect(describeRetention({ ...base, label: null, years: null, legalReference: null }).text).toBe("Đã xác nhận");
  });

  it("đề xuất chưa có hiệu lực thì không nêu con số như thể đã áp dụng", () => {
    const result = describeRetention({ status: "proposed", label: "10 năm", years: 10, legalReference: null, eligibleSince: null, eligible: false });
    expect(result.text).toBe("Chưa xác nhận");
    expect(result.hint).toContain("chưa có hiệu lực");
    expect(result.tone).toBe("warn");
  });

  it("nhiều quy tắc chưa gán, chưa có quy tắc, và thiếu dữ liệu", () => {
    expect(describeRetention({ ...base, status: "ambiguous" }).text).toBe("Chưa xác định");
    expect(describeRetention({ ...base, status: "none" }).text).toBe("Chưa có");
    expect(describeRetention(null)).toEqual({ text: "Chưa có thông tin", hint: null, tone: "neutral" });
  });
});
