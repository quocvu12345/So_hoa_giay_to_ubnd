import { describe, expect, it } from "vitest";
import { dayToInstant, daysLeft, expiryChip, maxDelegationEnd, parseUserFilter, roleScope, todayVietnam, userListHref, validateAssignment, validateDelegation, validateUserForm } from "./user-rules";

const user = { username: "nguyen.van.a", displayName: "Nguyễn Văn A", email: "", externalAuthSubject: "" };

describe("validateUserForm", () => {
  it("hợp lệ", () => expect(validateUserForm(user)).toEqual({}));
  it("tên đăng nhập: chữ thường, 3–50 ký tự, không dấu cách/dấu tiếng Việt", () => {
    for (const bad of ["ab", "nguyễn", "a b c", "-abc", "a".repeat(51)]) expect(validateUserForm({ ...user, username: bad }).username, bad).toBeTruthy();
    expect(validateUserForm({ ...user, username: "  Abc.d_e-f  " }).username).toBeUndefined();      // cắt khoảng trắng, đổi chữ thường như API
    expect(validateUserForm({ ...user, username: "Nguyen" }).username).toBeUndefined();
  });
  it("sửa không đòi tên đăng nhập (không đổi được)", () => expect(validateUserForm({ ...user, username: "" }, "edit")).toEqual({}));
  it("họ tên bắt buộc, email đúng dạng", () => {
    expect(validateUserForm({ ...user, displayName: "  " }).displayName).toBeTruthy();
    expect(validateUserForm({ ...user, email: "khong-phai-email" }).email).toBeTruthy();
    expect(validateUserForm({ ...user, email: "a@b.vn" }).email).toBeUndefined();
  });
});

describe("roleScope", () => {
  it("quản trị kỹ thuật không gắn đơn vị; chuyên viên/trưởng phòng cần cả cơ quan và đơn vị; còn lại chỉ cơ quan", () => {
    expect(roleScope("technical_admin")).toEqual({ organization: false, department: false });
    expect(roleScope("employee")).toEqual({ organization: true, department: true });
    expect(roleScope("manager")).toEqual({ organization: true, department: true });
    expect(roleScope("clerk")).toEqual({ organization: true, department: false });
    expect(roleScope("chair")).toEqual({ organization: true, department: false });
  });
});

describe("validateAssignment", () => {
  const base = { userId: "u", roleCode: "employee", organizationCode: "tl-ubnd", departmentCode: "ht", validFrom: "", validUntil: "", basis: "Quyết định 12/QĐ-UBND ngày 01/01/2026" };
  it("hợp lệ", () => expect(validateAssignment(base)).toEqual({}));
  it("thiếu đơn vị với chuyên viên", () => expect(validateAssignment({ ...base, departmentCode: "" }).departmentCode).toBeTruthy());
  it("quản trị kỹ thuật không cần cơ quan", () => expect(validateAssignment({ ...base, roleCode: "technical_admin", organizationCode: "", departmentCode: "" })).toEqual({}));
  it("căn cứ từ 10 ký tự", () => expect(validateAssignment({ ...base, basis: "ngắn" }).basis).toBeTruthy());
  it("hết hạn phải sau bắt đầu", () => {
    expect(validateAssignment({ ...base, validFrom: "2026-06-01", validUntil: "2026-05-01" }).validUntil).toBeTruthy();
    expect(validateAssignment({ ...base, validFrom: "2026-06-01", validUntil: "2026-06-01" }).validUntil).toBeTruthy();
    expect(validateAssignment({ ...base, validFrom: "2026-06-01", validUntil: "2026-06-02" })).toEqual({});
  });
});

describe("dayToInstant", () => {
  it("giờ Việt Nam: đầu ngày và cuối ngày", () => {
    expect(dayToInstant("2026-11-20", "start")).toBe("2026-11-19T17:00:00.000Z");
    expect(dayToInstant("2026-11-20", "end")).toBe("2026-11-20T16:59:59.000Z");
    expect(dayToInstant("20/11/2026", "start")).toBeNull();
  });
});

describe("hạn phân công", () => {
  const now = new Date("2026-11-18T03:00:00Z");
  it("daysLeft", () => {
    expect(daysLeft(null, now)).toBeNull();
    expect(daysLeft("2026-11-21T03:00:00Z", now)).toBe(3);
    expect(daysLeft("2026-11-17T00:00:00Z", now)).toBeLessThan(0);
  });
  it("chip: vàng trong 7 ngày, đỏ khi sát hạn, không chip khi còn lâu hoặc đã qua", () => {
    expect(expiryChip("2026-11-21T03:00:00Z", now)).toEqual({ tone: "warn", text: "Hết hạn sau 3 ngày" });
    expect(expiryChip("2026-11-18T20:00:00Z", now)?.tone).toBe("bad");
    expect(expiryChip("2026-12-30T00:00:00Z", now)).toBeNull();
    expect(expiryChip("2026-11-10T00:00:00Z", now)).toBeNull();
    expect(expiryChip(null, now)).toBeNull();
  });
});

describe("validateDelegation", () => {
  const today = "2026-11-18";
  const base = { fromAssignmentId: "a", toUserId: "u", permissionCodes: ["dossier.read"], validFrom: "", validUntil: "2026-12-01", basis: "Đi công tác theo Quyết định 33/QĐ-UBND" };
  it("hợp lệ", () => expect(validateDelegation(base, today)).toEqual({}));
  it("phải chọn quyền và người nhận", () => {
    expect(validateDelegation({ ...base, permissionCodes: [] }, today).permissionCodes).toBeTruthy();
    expect(validateDelegation({ ...base, toUserId: "" }, today).toUserId).toBeTruthy();
  });
  it("tối đa 90 ngày kể từ ngày bắt đầu", () => {
    expect(validateDelegation({ ...base, validUntil: maxDelegationEnd(today) }, today)).toEqual({});
    expect(validateDelegation({ ...base, validUntil: "2027-03-01" }, today).validUntil).toContain("90");
    expect(validateDelegation({ ...base, validFrom: "2026-12-01", validUntil: "2027-02-28" }, today)).toEqual({});     // 89 ngày
  });
  it("hết hạn phải sau bắt đầu", () => expect(validateDelegation({ ...base, validUntil: "2026-11-18" }, today).validUntil).toBeTruthy());
});

describe("todayVietnam và bộ lọc", () => {
  it("giờ Việt Nam đã sang ngày mới", () => expect(todayVietnam(new Date("2026-11-18T18:00:00Z"))).toBe("2026-11-19"));
  it("đọc và dựng lại bộ lọc", () => {
    const f = parseUserFilter({ q: " an ", tt: "locked", "sap-het-han": "1" });
    expect(f).toEqual({ q: "an", status: "locked", expiring: true });
    expect(userListHref(f)).toBe("/quan-tri/nguoi-dung?q=an&tt=locked&sap-het-han=1");
    expect(userListHref(parseUserFilter({}))).toBe("/quan-tri/nguoi-dung");
    expect(parseUserFilter({ tt: "hack" }).status).toBe("");
  });
});
