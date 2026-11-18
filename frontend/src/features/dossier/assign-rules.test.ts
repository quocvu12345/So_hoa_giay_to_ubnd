import { describe, expect, it } from "vitest";
import { filterAssignees, foldText, todayVietnam, validateAssignment, workload, type AssigneeOption } from "./assign-rules";

const person = (displayName: string, holding = 0, overdue = 0, isCurrent = false): AssigneeOption => ({ userId: displayName, displayName, isDeputy: false, isCurrent, holding, overdue });
const A = person("Nguyễn Văn An", 5, 2, true);
const B = person("Trần Thị Bình");
const C = person("Đặng Văn Cường", 1);

describe("lọc người theo tên", () => {
  it("gõ không dấu, không phân biệt hoa thường, mọi từ đều phải khớp", () => {
    expect(filterAssignees([A, B, C], "nguyen an")).toEqual([A]);
    expect(filterAssignees([A, B, C], "VAN")).toEqual([A, C]);
    expect(filterAssignees([A, B, C], "dang")).toEqual([C]);
    expect(filterAssignees([A, B, C], "đặng")).toEqual([C]);
    expect(filterAssignees([A, B, C], "khong co")).toEqual([]);
  });

  it("để trống thì giữ nguyên thứ tự của API", () => {
    expect(filterAssignees([C, A, B], "  ")).toEqual([C, A, B]);
  });

  it("foldText xử lý đ và dấu", () => {
    expect(foldText("Đặng Thị Hồng")).toBe("dang thi hong");
  });
});

describe("kiểm tra phân công", () => {
  const today = "2026-11-18";
  it("phải chọn người", () => {
    expect(validateAssignment({ userId: "", dueOn: "", note: "" }, null, today).userId).toBeDefined();
  });

  it("hạn không trước hôm nay; đúng hôm nay thì được; sai dạng thì báo", () => {
    expect(validateAssignment({ userId: "u", dueOn: "2026-11-17", note: "Lý do đủ dài" }, null, today).dueOn).toMatch(/trước hôm nay/);
    expect(validateAssignment({ userId: "u", dueOn: "2026-11-18", note: "Lý do đủ dài" }, null, today).dueOn).toBeUndefined();
    expect(validateAssignment({ userId: "u", dueOn: "18/11/2026", note: "Lý do đủ dài" }, null, today).dueOn).toMatch(/đúng dạng/);
    expect(validateAssignment({ userId: "u", dueOn: "", note: "Lý do đủ dài" }, null, today).dueOn).toBeUndefined();
  });

  it("đổi sang người khác phải ghi lý do tối thiểu 10 ký tự; cùng người đổi hạn thì không bắt buộc", () => {
    expect(validateAssignment({ userId: "moi", dueOn: "", note: "ngắn" }, "cu", today).note).toBeDefined();
    expect(validateAssignment({ userId: "moi", dueOn: "", note: "   chín ký tự" }, "cu", today).note).toBeUndefined();
    expect(validateAssignment({ userId: "moi", dueOn: "", note: "Chuyển vì quá tải" }, "cu", today)).toEqual({});
    expect(validateAssignment({ userId: "cu", dueOn: "2026-12-01", note: "" }, "cu", today)).toEqual({});
    expect(validateAssignment({ userId: "moi", dueOn: "", note: "" }, null, today).note).toBeDefined();
  });
});

describe("todayVietnam", () => {
  it("tính theo giờ Việt Nam: 18h UTC đã là ngày hôm sau", () => {
    expect(todayVietnam(new Date("2026-11-17T18:30:00Z"))).toBe("2026-11-18");
    expect(todayVietnam(new Date("2026-11-17T16:30:00Z"))).toBe("2026-11-17");
  });
});

describe("workload", () => {
  it("mô tả tải việc", () => {
    expect(workload(A)).toBe("Đang giữ 5 hồ sơ, 2 quá hạn");
    expect(workload(C)).toBe("Đang giữ 1 hồ sơ");
    expect(workload(B)).toBe("Chưa giữ hồ sơ nào");
  });
});
