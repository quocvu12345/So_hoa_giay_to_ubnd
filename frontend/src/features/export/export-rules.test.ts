import { describe, expect, it } from "vitest";
import { applyProgress, canDownload, expiryNote, formatBytes, isRunning, progressFraction, toExportRequest, validateExportForm } from "./export-rules";

const form = { status: "archived", workGroupCode: "", archivedFrom: "", archivedTo: "", format: "zip_pdf_json" };

describe("validateExportForm", () => {
  it("cần ít nhất một điều kiện", () => {
    expect(validateExportForm({ ...form, status: "" }).scope).toBeTruthy();
    expect(validateExportForm(form)).toEqual({});
    expect(validateExportForm({ ...form, status: "", workGroupCode: "U15" })).toEqual({});
    expect(validateExportForm({ ...form, status: "", archivedFrom: "2026-01-01" })).toEqual({});
  });
  it("ngày kết thúc không trước ngày bắt đầu", () => {
    expect(validateExportForm({ ...form, archivedFrom: "2026-06-01", archivedTo: "2026-05-01" }).archivedTo).toBeTruthy();
    expect(validateExportForm({ ...form, archivedFrom: "2026-06-01", archivedTo: "2026-06-01" })).toEqual({});
    expect(validateExportForm({ ...form, archivedFrom: "01/06/2026" }).archivedFrom).toBeTruthy();
  });
  it("định dạng phải hợp lệ", () => expect(validateExportForm({ ...form, format: "rar" }).format).toBeTruthy());
});

describe("toExportRequest", () => {
  it("ô rỗng thành null", () => expect(toExportRequest(form)).toEqual({ dossierIds: null, status: "archived", workGroupCode: null, archivedFrom: null, archivedTo: null, format: "zip_pdf_json" }));
});

describe("tiến độ và hạn", () => {
  it("isRunning", () => {
    expect(isRunning("queued")).toBe(true);
    expect(isRunning("running")).toBe(true);
    expect(isRunning("ready")).toBe(false);
  });
  it("progressFraction chặn trong 0..1", () => {
    expect(progressFraction(5, 10)).toBe(0.5);
    expect(progressFraction(15, 10)).toBe(1);
    expect(progressFraction(1, 0)).toBe(0);
    expect(progressFraction(-1, 10)).toBe(0);
  });
  const now = new Date("2026-11-18T03:00:00Z");
  it("expiryNote", () => {
    expect(expiryNote("2026-11-25T03:00:00Z", now)).toBe("Còn 7 ngày để tải");
    expect(expiryNote("2026-11-18T10:00:00Z", now)).toContain("trong hôm nay");
    expect(expiryNote("2026-11-17T00:00:00Z", now)).toBe("Đã hết hạn");
    expect(expiryNote(null, now)).toBe("");
  });
  it("canDownload: chỉ gói sẵn sàng và chưa quá hạn", () => {
    expect(canDownload("ready", "2026-11-25T00:00:00Z", now)).toBe(true);
    expect(canDownload("ready", "2026-11-17T00:00:00Z", now)).toBe(false);
    expect(canDownload("running", null, now)).toBe(false);
    expect(canDownload("revoked", "2026-11-25T00:00:00Z", now)).toBe(false);
  });
});

describe("applyProgress", () => {
  const rows = [{ id: "a", status: "running", processedItems: 5, totalItems: 10 }, { id: "b", status: "queued", processedItems: 0, totalItems: 3 }];
  it("chỉ đổi gói có mã khớp", () => {
    const next = applyProgress(rows, { exportId: "a", status: "running", processed: 7, total: 10 });
    expect(next[0].processedItems).toBe(7);
    expect(next[1]).toEqual(rows[1]);
  });
  it("không lùi tiến độ khi sự kiện đến muộn", () => expect(applyProgress(rows, { exportId: "a", status: "running", processed: 2, total: 10 })[0].processedItems).toBe(5));
  it("trạng thái cuối được áp dụng", () => expect(applyProgress(rows, { exportId: "a", status: "ready", processed: 10, total: 10 })[0].status).toBe("ready"));
});

describe("formatBytes", () => {
  it("đổi đơn vị", () => {
    expect(formatBytes(2048)).toBe("2,0 KB");
    expect(formatBytes(null)).toBe("—");
  });
});
