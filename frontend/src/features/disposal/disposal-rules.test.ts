import { describe, expect, it } from "vitest";
import { describeResult, disposalActions, filterDisposals, parseDisposalFilter, validateReason } from "./disposal-rules";

describe("bộ lọc", () => {
  const rows = [{ status: "requested" }, { status: "approved" }, { status: "executing" }, { status: "executed" }, { status: "rejected" }];
  it("mặc định là chờ phê duyệt", () => {
    expect(parseDisposalFilter(undefined)).toBe("dang-cho");
    expect(parseDisposalFilter("hack")).toBe("dang-cho");
    expect(filterDisposals(rows, "dang-cho")).toHaveLength(1);
  });
  it("chờ thực hiện gồm cả đang thực hiện", () => expect(filterDisposals(rows, "da-duyet").map((r) => r.status)).toEqual(["approved", "executing"]));
  it("tất cả", () => expect(filterDisposals(rows, "tat-ca")).toHaveLength(5));
});

describe("validateReason", () => {
  it("từ 10 đến 1000 ký tự", () => {
    expect(validateReason("ngắn")).toContain("từ 10");
    expect(validateReason("Hồ sơ đã hết thời hạn bảo quản 20 năm")).toBeNull();
    expect(validateReason("x".repeat(1001))).toContain("1000");
  });
});

describe("disposalActions", () => {
  const clerk = { canRequest: true, canApprove: false };
  const chair = { canRequest: false, canApprove: true };
  const both = { canRequest: true, canApprove: true };
  it("văn thư chỉ thực hiện đề nghị đã duyệt, không phê duyệt", () => {
    expect(disposalActions("requested", clerk, true)).toEqual({ approve: false, reject: false, execute: false, ownNote: false });
    expect(disposalActions("approved", clerk, true).execute).toBe(true);
    expect(disposalActions("executed", clerk, true).execute).toBe(false);
  });
  it("người phê duyệt duyệt hoặc từ chối đề nghị của người khác", () => {
    expect(disposalActions("requested", chair, false)).toEqual({ approve: true, reject: true, execute: false, ownNote: false });
    expect(disposalActions("approved", chair, false).execute).toBe(false);
  });
  it("tự đề nghị thì không tự phê duyệt được (ẩn nút, có ghi chú)", () => {
    const own = disposalActions("requested", both, true);
    expect(own.approve).toBe(false);
    expect(own.ownNote).toBe(true);
  });
});

describe("describeResult", () => {
  it("nêu số tệp, số bản xóa, số giấy tờ giữ", () => expect(describeResult({ filesDisposed: 3, blobsDeleted: "2", documentsKept: 1 })).toBe("Đã hủy nội dung 3 tệp (xóa 2 bản trên kho), giữ lại thông tin của 1 giấy tờ."));
});
