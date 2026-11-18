import { describe, expect, it } from "vitest";
import { etaText, summarizeExtract, toExtractResult, waitingLabel, type ExtractResult } from "./ai-queue";

describe("thời gian chờ ước tính", () => {
  it("làm tròn dễ đọc và không bịa số khi chưa có số đo", () => {
    expect(etaText(null)).toBeNull();
    expect(etaText(undefined)).toBeNull();
    expect(etaText(-1)).toBeNull();
    expect(etaText(3)).toBe("khoảng 5 giây");
    expect(etaText(25)).toBe("khoảng 25 giây");
    expect(etaText(95)).toBe("khoảng 2 phút");
    expect(etaText(3900)).toBe("khoảng 1 giờ 5 phút");
    expect(etaText(7200)).toBe("khoảng 2 giờ");
  });
});

describe("nhãn khay chờ", () => {
  it("tách rõ khay nền, đang chờ và ưu tiên; bỏ phần thời gian khi không có ước tính", () => {
    expect(waitingLabel("background", 2, 95)).toBe("Chờ trong khay · thứ 2 · khoảng 2 phút");
    expect(waitingLabel("priority", 1, null)).toBe("Ưu tiên · thứ 1");
    expect(waitingLabel("interactive", null, null)).toBe("Đang chờ");
    expect(waitingLabel(null, null, null)).toBe("Chờ trong khay");
  });
});

describe("kết quả Trích xuất ngay", () => {
  const base: ExtractResult = { items: [], raised: 0, running: 0, alreadyDone: 0, created: 0, skipped: 0 };
  it("tóm tắt như thiết kế", () => {
    expect(summarizeExtract({ ...base, raised: 3, alreadyDone: 1 })).toBe("Đã đưa 3 giấy tờ lên đầu hàng · 1 giấy tờ đã đọc xong");
    expect(summarizeExtract(base)).toBe("Không có giấy tờ nào cần trích xuất.");
  });
  it("một giấy tờ thì kèm thời gian xong ước tính", () => {
    const item = { documentId: "d", fileId: null, jobId: "j", outcome: "raised" as const, queueKind: "priority" as const, queuePosition: 1, etaSeconds: 25, message: null };
    expect(summarizeExtract({ ...base, items: [item], raised: 1 })).toBe("Đã đưa 1 giấy tờ lên đầu hàng · xong khoảng 25 giây");
  });
});

describe("toExtractResult", () => {
  const raw = {
    items: [
      { documentId: "d1", fileId: "f1", jobId: "j1", outcome: "raised", queueKind: "priority", queuePosition: 1, etaSeconds: 25, message: null },
      { documentId: "d2", fileId: null, jobId: null, outcome: "moi-chua-biet", queueKind: "khay-la", queuePosition: null, etaSeconds: null, message: "API thêm giá trị mới" },
    ],
    raised: 1, running: 0, alreadyDone: 0, created: 0, skipped: 1,
  };

  it("giữ nguyên giá trị đã biết", () => {
    const result = toExtractResult(raw);
    expect(result.items[0]).toMatchObject({ outcome: "raised", queueKind: "priority", queuePosition: 1, etaSeconds: 25 });
    expect(result).toMatchObject({ raised: 1, skipped: 1 });
  });

  it("giá trị lạ không làm vỡ màn: outcome về skipped (giữ thông điệp của API), khay lạ bỏ trống", () => {
    const item = toExtractResult(raw).items[1];
    expect(item.outcome).toBe("skipped");
    expect(item.queueKind).toBeNull();
    expect(item.message).toBe("API thêm giá trị mới");
  });
});
