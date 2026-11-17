import { describe, expect, it } from "vitest";
import { checkFile, duplicateDocumentId, formatBytes, MAX_UPLOAD_BYTES, nextToStart, type UploadItem } from "./upload-queue";

const item = (id: string, status: UploadItem["status"]): UploadItem => ({ id, fileName: `${id}.pdf`, size: 10, status, progress: 0 });

describe("kiểm tra tệp trước khi tải", () => {
  it("nhận PDF hợp lệ", () => {
    expect(checkFile({ name: "to-trinh.PDF", size: 1024 })).toBeNull();
  });
  it("báo lỗi tiếng Việt, nói rõ cách sửa", () => {
    expect(checkFile({ name: "anh.jpg", size: 1024 })).toMatch(/Chỉ nhận tệp PDF/);
    expect(checkFile({ name: "rong.pdf", size: 0 })).toMatch(/Tệp rỗng/);
    expect(checkFile({ name: "lon.pdf", size: MAX_UPLOAD_BYTES + 1 })).toMatch(/lớn hơn giới hạn 200 MB/);
  });
});

describe("hàng đợi tải 3 tệp song song", () => {
  it("20 tệp: chỉ bắt đầu 3 tệp đầu theo thứ tự chọn", () => {
    const items = Array.from({ length: 20 }, (_, i) => item(`f${i}`, "waiting"));
    expect(nextToStart(items)).toEqual(["f0", "f1", "f2"]);
  });
  it("nhận thêm tệp khi có chỗ trống, không vượt 3", () => {
    const items = [item("a", "uploading"), item("b", "done"), item("c", "waiting"), item("d", "waiting"), item("e", "waiting")];
    expect(nextToStart(items)).toEqual(["c", "d"]);
    expect(nextToStart([item("a", "uploading"), item("b", "uploading"), item("c", "uploading"), item("d", "waiting")])).toEqual([]);
  });
  it("tệp lỗi hoặc đã hủy không chiếm chỗ và không tự chạy lại", () => {
    expect(nextToStart([item("a", "failed"), item("b", "cancelled"), item("c", "duplicate"), item("d", "waiting")])).toEqual(["d"]);
  });
});

describe("định dạng", () => {
  it("dung lượng dễ đọc", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(118105)).toBe("115 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(200 * 1024 * 1024)).toBe("200 MB");
  });
  it("lấy mã giấy tờ cũ từ chi tiết lỗi trùng tệp, bỏ qua dữ liệu lạ", () => {
    expect(duplicateDocumentId({ documentId: "abc", fileName: "x.pdf" })).toBe("abc");
    expect(duplicateDocumentId(undefined)).toBeUndefined();
    expect(duplicateDocumentId({ documentId: 5 })).toBeUndefined();
  });
});
