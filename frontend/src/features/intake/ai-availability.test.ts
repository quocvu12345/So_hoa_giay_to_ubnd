import { describe, expect, it } from "vitest";
import { aiAvailabilityNotice } from "./ai-availability";

describe("aiAvailabilityNotice (AI-24)", () => {
  it("bình thường hoặc chưa biết thì không báo", () => {
    expect(aiAvailabilityNotice(null)).toBeNull();
    expect(aiAvailabilityNotice({ state: "ok", since: null })).toBeNull();
    expect(aiAvailabilityNotice({ state: "trang-thai-la", since: null }), "trạng thái lạ: không báo bừa").toBeNull();
  });

  it("máy AI không trả lời: nói từ lúc nào và PDF đã nạp không mất, không cần nạp lại", () => {
    const notice = aiAvailabilityNotice({ state: "engine_down", since: "2026-11-19T00:01:35Z" })!;
    expect(notice.title).toMatch(/^Máy AI tạm thời không trả lời từ /);
    expect(notice.title).toContain("19/11/2026");
    expect(notice.body).toContain("không cần nạp lại");
    expect(aiAvailabilityNotice({ state: "engine_down", since: null })!.title).toBe("Máy AI tạm thời không trả lời");
  });

  it("không còn bộ đọc: báo lần cuối thấy nếu biết", () => {
    expect(aiAvailabilityNotice({ state: "no_worker", since: null })!.body).not.toContain("Lần cuối");
    expect(aiAvailabilityNotice({ state: "no_worker", since: "2026-11-19T00:09:00Z" })!.body).toContain("Lần cuối thấy bộ đọc lúc");
  });

  it("không lộ chi tiết kỹ thuật cho cán bộ", () => {
    const notice = aiAvailabilityNotice({ state: "engine_down", since: "2026-11-19T00:01:35Z" })!;
    expect(`${notice.title} ${notice.body}`).not.toMatch(/Ollama|Tailscale|worker|http/i);
  });
});
