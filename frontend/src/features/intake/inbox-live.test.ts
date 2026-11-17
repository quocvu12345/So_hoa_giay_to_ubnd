import { describe, expect, it } from "vitest";
import type { InboxItem } from "./inbox-data";
import { filterByStage, progressLabel, withLiveProgress } from "./inbox-live";

const row = (over: Partial<InboxItem> = {}): InboxItem => ({
  documentId: "d", fileId: "f", fileName: "a.pdf", pageCount: 5, uploadedAt: "2026-11-17T08:00:00Z", stage: "queued", queuePosition: 2, progress: null,
  suggestion: null, attentionCount: 0, jobId: "j", error: null, intakeStatus: "inbox", queueKind: "background", etaSeconds: 95, ...over,
});

describe("nhãn tiến độ đọc", () => {
  it("processed là số trang đã đọc xong, nhãn hiện trang đang đọc", () => {
    expect(progressLabel({ processed: 0, pageCount: 3 })).toBe("Đang đọc trang 1/3");
    expect(progressLabel({ processed: 2, pageCount: 3 })).toBe("Đang đọc trang 3/3");
    expect(progressLabel({ processed: 3, pageCount: 3 })).toBe("Đang đọc trang 3/3");
    expect(progressLabel({ processed: 1, pageCount: null })).toBe("Đang đọc trang 2/?");
  });
});

describe("phủ tiến độ trực tiếp lên dòng", () => {
  it("việc đang chờ chuyển sang đang đọc, bỏ vị trí và ước tính cũ", () => {
    const out = withLiveProgress(row(), { processed: 1, pageCount: 5 });
    expect(out).toMatchObject({ stage: "reading", progress: "Đang đọc trang 2/5", queuePosition: null, etaSeconds: null });
  });
  it("dòng đã xong, lỗi, hủy không bị đổi; không có tiến độ thì giữ nguyên", () => {
    const done = row({ stage: "ready" });
    expect(withLiveProgress(done, { processed: 1, pageCount: 5 })).toBe(done);
    const failed = row({ stage: "failed" });
    expect(withLiveProgress(failed, { processed: 1, pageCount: 5 })).toBe(failed);
    const queued = row();
    expect(withLiveProgress(queued, undefined)).toBe(queued);
  });
});

describe("lọc theo tình trạng đọc", () => {
  const items = [row({ documentId: "1", stage: "queued" }), row({ documentId: "2", stage: "reading" }), row({ documentId: "3", stage: "ready" }), row({ documentId: "4", stage: "failed" }), row({ documentId: "5", stage: "cancelled" })];
  it("mỗi bộ lọc lấy đúng nhóm", () => {
    expect(filterByStage(items, "tat-ca")).toHaveLength(5);
    expect(filterByStage(items, "dang-cho").map((i) => i.documentId)).toEqual(["1"]);
    expect(filterByStage(items, "dang-doc").map((i) => i.documentId)).toEqual(["2"]);
    expect(filterByStage(items, "da-doc").map((i) => i.documentId)).toEqual(["3"]);
    expect(filterByStage(items, "loi").map((i) => i.documentId)).toEqual(["4", "5"]);
  });
});
