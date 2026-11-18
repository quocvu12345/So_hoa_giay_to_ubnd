import { describe, expect, it } from "vitest";
import { parseDossierFilter } from "@/features/dossier/dossier-filter";
import { cellHref, listHref, STAGE_ORDER } from "./leadership-links";

function filterOf(href: string) {
  return parseDossierFilter(Object.fromEntries(new URL(href, "http://x").searchParams));
}

describe("liên kết từ bảng tổng hợp sang danh sách hồ sơ", () => {
  it("phòng × cột: đúng trạng thái, và đọc lại ra đúng bộ lọc", () => {
    expect(filterOf(listHref("preparing", { department: "ht" })!)).toMatchObject({ department: "ht", status: "draft,returned", overdue: false });
    expect(filterOf(listHref("awaitingCheck", { department: "kt" })!)).toMatchObject({ department: "kt", status: "department_review" });
    expect(filterOf(listHref("awaitingOpinion", { department: "kt" })!).status).toBe("leadership_review");
    expect(filterOf(listHref("awaitingArchive", { department: "vp" })!).status).toBe("ready_archive");
    expect(filterOf(listHref("open", { department: "ht" })!).status).toBe("draft,returned,department_review,leadership_review,ready_archive");
  });

  it("quá hạn là bộ lọc quá hạn, không kèm trạng thái", () => {
    const f = filterOf(listHref("overdue", { department: "ht" })!);
    expect(f).toMatchObject({ department: "ht", overdue: true, status: "" });
  });

  it("hoạt động HĐND: nhiều nhóm hồ sơ trong một liên kết", () => {
    const f = filterOf(listHref("awaitingCheck", { workGroups: ["H03", "H04"] })!);
    expect(f).toMatchObject({ workGroup: "H03,H04", status: "department_review", department: "" });
  });

  it("hoạt động chưa có nhóm nào thì không có liên kết; số 0 thì không có liên kết", () => {
    expect(listHref("open", { workGroups: [] })).toBeNull();
    expect(cellHref("preparing", 0, { department: "ht" })).toBeNull();
    expect(cellHref("preparing", 3, { department: "ht" })).toContain("/ho-so?");
  });

  it("mọi cột đều có liên kết hợp lệ", () => {
    for (const stage of STAGE_ORDER) expect(listHref(stage, { department: "ht" })).toMatch(/^\/ho-so\?/);
  });
});
