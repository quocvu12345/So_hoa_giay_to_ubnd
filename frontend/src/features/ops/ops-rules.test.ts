import { describe, expect, it } from "vitest";
import { ageLabel, formatBytes, heartbeatTone, jobStatusParam, parseJobFilter, parseSettingValue, settingPreview } from "./ops-rules";

describe("ageLabel", () => {
  it("chọn đơn vị vừa đọc", () => {
    expect(ageLabel(45)).toBe("45 giây");
    expect(ageLabel(600)).toBe("10 phút");
    expect(ageLabel(7200)).toBe("2,0 giờ");
    expect(ageLabel(200_000)).toBe("2,3 ngày");
  });
  it("thiếu hoặc sai thì —", () => {
    expect(ageLabel(null)).toBe("—");
    expect(ageLabel(undefined)).toBe("—");
    expect(ageLabel(-1)).toBe("—");
    expect(ageLabel(Number.NaN)).toBe("—");
  });
});

describe("heartbeatTone", () => {
  it("ngưỡng 2 và 5 phút; -1 là chưa có nhịp", () => {
    expect(heartbeatTone(5)).toBe("ok");
    expect(heartbeatTone(121)).toBe("warn");
    expect(heartbeatTone(301)).toBe("bad");
    expect(heartbeatTone(-1)).toBe("warn");
  });
});

describe("bộ lọc việc AI", () => {
  it("mặc định đang chờ/chạy; giá trị lạ về mặc định", () => {
    expect(parseJobFilter(undefined)).toBe("active");
    expect(parseJobFilter("hack")).toBe("active");
    expect(parseJobFilter("failed")).toBe("failed");
    expect(parseJobFilter(["completed", "x"])).toBe("completed");
  });
  it("all là không lọc", () => {
    expect(jobStatusParam("all")).toBeUndefined();
    expect(jobStatusParam("failed")).toBe("failed");
  });
});

describe("formatBytes", () => {
  it("đổi đơn vị", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1,5 KB");
    expect(formatBytes(5 * 1024 ** 3)).toBe("5,0 GB");
    expect(formatBytes(null)).toBe("—");
  });
});

describe("parseSettingValue", () => {
  it("nhận JSON hợp lệ", () => {
    expect(parseSettingValue("a.b", "true")).toEqual({ ok: true, value: true });
    expect(parseSettingValue("a.b", " 12 ")).toEqual({ ok: true, value: 12 });
    expect(parseSettingValue("a.b", '"abc"')).toEqual({ ok: true, value: "abc" });
    expect(parseSettingValue("a.b", '{"x":[1,2]}')).toEqual({ ok: true, value: { x: [1, 2] } });
  });
  it("chuỗi trần không ngoặc kép là sai", () => {
    const r = parseSettingValue("a.b", "abc");
    expect(r.ok).toBe(false);
  });
  it("rỗng và quá dài bị từ chối", () => {
    expect(parseSettingValue("a.b", "  ").ok).toBe(false);
    expect(parseSettingValue("a.b", `"${"x".repeat(4000)}"`).ok).toBe(false);
  });
  it("cài đặt SQL đọc trực tiếp chỉ nhận true/false", () => {
    expect(parseSettingValue("dossier.enforce_procedure_components", "true").ok).toBe(true);
    expect(parseSettingValue("dossier.enforce_procedure_components", '"true"').ok).toBe(false);
    expect(parseSettingValue("dossier.enforce_procedure_components", "1").ok).toBe(false);
  });
});

describe("settingPreview", () => {
  it("cắt khi dài", () => {
    expect(settingPreview(true)).toBe("true");
    expect(settingPreview("x".repeat(200), 20).length).toBe(20);
  });
});
