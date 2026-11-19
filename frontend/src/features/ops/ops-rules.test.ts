import { describe, expect, it } from "vitest";
import { ageLabel, availabilityAlert, formatBytes, heartbeatTone, jobStatusParam, machineState, parseJobFilter, parseSettingValue, settingPreview } from "./ops-rules";

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

describe("machineState, availabilityAlert (AI-24)", () => {
  const now = Date.parse("2026-11-19T01:00:00Z");

  it("worker sống, máy AI trả lời", () => {
    expect(machineState({ alive: true, engineOk: true, engine: "Ollama http://100.78.102.53:11434", lastSeenSecondsAgo: 12 }, now)).toEqual({ label: "Máy AI trả lời", tone: "ok" });
    expect(machineState({ alive: true, engineOk: true, engine: null, lastSeenSecondsAgo: 12 }, now)).toEqual({ label: "Đang hoạt động", tone: "ok" });
  });

  it("worker sống mà máy AI không trả lời: nói từ bao lâu", () => {
    expect(machineState({ alive: true, engineOk: false, engineDownSince: "2026-11-19T00:48:00Z", lastSeenSecondsAgo: 5 }, now))
      .toEqual({ label: "Máy AI không trả lời 12 phút", tone: "bad" });
    expect(machineState({ alive: true, engineOk: false, engineDownSince: null, lastSeenSecondsAgo: 5 }, now).label).toBe("Máy AI không trả lời");
  });

  it("im lặng quá 2 phút là có thể đã dừng, kể cả khi lần cuối báo máy AI tốt", () => {
    expect(machineState({ alive: false, engineOk: true, lastSeenSecondsAgo: 600 }, now)).toEqual({ label: "Im lặng 10 phút, có thể đã dừng", tone: "warn" });
  });

  it("cảnh báo đầu trang chỉ khi PDF không được đọc", () => {
    expect(availabilityAlert("ok")).toBeNull();
    expect(availabilityAlert(undefined)).toBeNull();
    expect(availabilityAlert("engine_down")).toContain("Tailscale");
    expect(availabilityAlert("no_worker")).toContain("Chạy lại worker");
  });
});
