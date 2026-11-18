import { describe, expect, it } from "vitest";
import { addDays, filterLoans, loanActions, overdueDays, parseLoanFilter, todayVietnam, validateDue, validatePurpose, validateRejectNote } from "./loan-rules";

describe("bộ lọc", () => {
  const rows = [{ status: "requested" }, { status: "approved" }, { status: "lent" }, { status: "overdue" }, { status: "returned" }, { status: "rejected" }];
  it("mặc định: đang xử lý (chờ duyệt, chờ giao, đang mượn, quá hạn)", () => {
    expect(parseLoanFilter(undefined)).toBe("dang-xu-ly");
    expect(parseLoanFilter("hack")).toBe("dang-xu-ly");
    expect(filterLoans(rows, "dang-xu-ly")).toHaveLength(4);
    expect(filterLoans(rows, "da-tra")).toHaveLength(1);
    expect(filterLoans(rows, "tu-choi")).toHaveLength(1);
    expect(filterLoans(rows, "tat-ca")).toHaveLength(6);
  });
});

describe("validatePurpose", () => {
  it("từ 5 đến 500 ký tự", () => {
    expect(validatePurpose("abc")).toContain("5");
    expect(validatePurpose("Đối chiếu bản gốc")).toBeNull();
    expect(validatePurpose("x".repeat(501))).toContain("500");
  });
});

describe("validateDue", () => {
  const today = "2026-11-18";
  it("rỗng hợp lệ; từ hôm nay đến 90 ngày", () => {
    expect(validateDue("", today)).toBeNull();
    expect(validateDue("2026-11-18", today)).toBeNull();
    expect(validateDue(addDays(today, 90), today)).toBeNull();
    expect(validateDue(addDays(today, 91), today)).toContain("90");
    expect(validateDue("2026-11-17", today)).toContain("hôm nay");
    expect(validateDue("18/11/2026", today)).toContain("không hợp lệ");
  });
});

describe("ngày", () => {
  it("addDays qua tháng", () => expect(addDays("2026-11-30", 1)).toBe("2026-12-01"));
  it("todayVietnam sang ngày mới trước nửa đêm UTC", () => expect(todayVietnam(new Date("2026-11-18T18:00:00Z"))).toBe("2026-11-19"));
  it("overdueDays", () => {
    expect(overdueDays("2026-11-10", "2026-11-18")).toBe(8);
    expect(overdueDays("2026-11-18", "2026-11-18")).toBe(0);
    expect(overdueDays("2026-11-20", "2026-11-18")).toBe(0);
    expect(overdueDays(null, "2026-11-18")).toBe(0);
  });
});

describe("loanActions", () => {
  const approver = { canApprove: true };
  const borrower = { canApprove: false };
  it("người duyệt: duyệt/từ chối khi chờ, giao khi đã duyệt, nhận trả khi đang mượn hoặc quá hạn", () => {
    expect(loanActions("requested", approver)).toEqual({ approve: true, reject: true, lend: false, receive: false });
    expect(loanActions("approved", approver)).toEqual({ approve: false, reject: false, lend: true, receive: false });
    expect(loanActions("lent", approver).receive).toBe(true);
    expect(loanActions("overdue", approver).receive).toBe(true);
    expect(loanActions("returned", approver)).toEqual({ approve: false, reject: false, lend: false, receive: false });
  });
  it("người mượn không có thao tác nào", () => expect(loanActions("requested", borrower)).toEqual({ approve: false, reject: false, lend: false, receive: false }));
});

describe("validateRejectNote", () => {
  it("từ 5 ký tự", () => {
    expect(validateRejectNote("no")).toBeTruthy();
    expect(validateRejectNote("Đang bị mượn khác")).toBeNull();
  });
});
