import { describe, expect, it } from "vitest";
import { dueOnForApi, mapApiErrors, validateDossierForm, type DossierFormValues } from "./dossier-form-rules";

const valid: DossierFormValues = { title: "Hồ sơ kiểm tra môi trường", workGroupCode: "U16", accessLevel: "internal", internalDueOn: "", notes: "", year: "", creatorOrganizationName: "" };
const today = new Date("2026-11-17T03:00:00Z");

describe("kiểm tra biểu mẫu hồ sơ", () => {
  it("hợp lệ thì không có lỗi", () => {
    expect(validateDossierForm(valid, "create", today)).toEqual({});
  });
  it("tên quá ngắn, thiếu nhóm khi tạo, năm sai", () => {
    expect(Object.keys(validateDossierForm({ ...valid, title: "abc", workGroupCode: "", year: "20x6" }, "create", today)).sort()).toEqual(["title", "workGroupCode", "year"]);
  });
  it("khi sửa không bắt buộc nhóm và không kiểm năm", () => {
    expect(validateDossierForm({ ...valid, workGroupCode: "", year: "abc" }, "edit", today)).toEqual({});
  });
  it("hạn nội bộ: đúng dạng ngày và không trước hôm nay", () => {
    expect(validateDossierForm({ ...valid, internalDueOn: "17/11/2026" }, "create", today)).toEqual({});
    expect(validateDossierForm({ ...valid, internalDueOn: "16/11/2026" }, "create", today).internalDueOn).toMatch(/trước hôm nay/);
    expect(validateDossierForm({ ...valid, internalDueOn: "31/02/2026" }, "create", today).internalDueOn).toMatch(/ngày\/tháng\/năm/);
  });
  it("đổi ngày sang dạng gửi API", () => {
    expect(dueOnForApi("20/11/2026")).toBe("2026-11-20");
    expect(dueOnForApi("  ")).toBe("");
    expect(dueOnForApi("sai")).toBe("");
  });
  it("lỗi API gắn đúng ô, khóa lạ để hiện chung", () => {
    expect(mapApiErrors({ title: ["Nhập tên hồ sơ."], "fields[0]": ["lạ"] })).toEqual({ fields: { title: "Nhập tên hồ sơ." }, other: ["lạ"] });
  });
});
