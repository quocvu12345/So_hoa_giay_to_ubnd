import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { NAVIGATION } from "../src/config/navigation";
import { expect, ROLES, signIn, test, watchConsole, type Role } from "./fixtures";

/**
 * FE-10, QA-05: ma trận vai trò. Với mỗi trong 6 vai trò (tài khoản dev_admin, chọn từng phân công):
 *  - menu chính hiện đúng các mục mà quyền của phân công cho phép (một nguồn: config/navigation);
 *  - mở từng màn trong menu: không lỗi máy chủ, không lỗi console/CSP, không lỗi tiếp cận nghiêm trọng (axe WCAG 2 A/AA).
 * Mỗi màn chỉ quét axe một lần dù nhiều vai trò cùng thấy; lỗi được gom lại báo một lượt thay vì dừng ở lỗi đầu.
 */

const checkedForAccessibility = new Set<string>();

/** Vài điều đã biết chắc theo nghiệp vụ, để bài kiểm không rỗng nếu menu và quyền cùng sai một hướng. */
const KNOWN: Record<Role, { sees: string[]; doesNotSee: string[] }> = {
  employee: { sees: ["Việc của tôi", "Tiếp nhận PDF", "Hồ sơ"], doesNotSee: ["Vận hành"] },
  manager: { sees: ["Việc của tôi", "Hồ sơ"], doesNotSee: ["Vận hành"] },
  clerk: { sees: ["Tiếp nhận PDF", "Nộp lưu"], doesNotSee: ["Vận hành"] },
  chair: { sees: ["Việc của tôi"], doesNotSee: ["Tiếp nhận PDF", "Vận hành"] },
  council: { sees: ["Việc của tôi"], doesNotSee: ["Tiếp nhận PDF", "Vận hành"] },
  technical_admin: { sees: ["Việc của tôi", "Vận hành"], doesNotSee: ["Tiếp nhận PDF"] },
};

type Me = { permissions: string[]; activeAssignment: { role: string; roleName: string } };

const visible = (item: { permission?: string | string[] }, permissions: string[]) => {
  const required = item.permission === undefined ? [] : Array.isArray(item.permission) ? item.permission : [item.permission];
  return required.length === 0 || required.some((p) => permissions.includes(p));
};

async function axeFindings(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  return result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.help} (${v.nodes.length} chỗ) ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
}

for (const role of ROLES) {
  test(`Vai trò ${role}: menu đúng theo quyền, mọi màn trong menu mở được và đạt tiếp cận @integration`, async ({ page }) => {
    const problems = watchConsole(page);
    await signIn(page, role satisfies Role);
    await page.goto("/viec-cua-toi");
    const menu = page.locator('nav[aria-label="Menu chính"]').first();
    await expect(menu).toBeVisible();

    const me = (await (await page.request.get("/api/v1/me")).json()) as Me;
    expect(me.activeAssignment.role, "phân công đang dùng đúng vai trò đã chọn").toBe(role);
    const items = NAVIGATION.flatMap((group) => group.items).filter((item) => visible(item, me.permissions));
    expect(items.length, "vai trò nào cũng có ít nhất Việc của tôi").toBeGreaterThan(0);

    const shown = (await menu.getByRole("link").allInnerTexts()).map((text) => text.replace(/\s+/g, " ").trim());
    for (const item of items) expect(shown.some((text) => text.startsWith(item.label)), `${role} phải thấy mục "${item.label}"`).toBe(true);
    const hidden = NAVIGATION.flatMap((group) => group.items).filter((item) => !visible(item, me.permissions));
    for (const item of hidden) expect(shown.some((text) => text.startsWith(item.label)), `${role} không được thấy mục "${item.label}"`).toBe(false);

    for (const label of KNOWN[role].sees) expect(shown.some((text) => text.startsWith(label)), `${role} phải thấy "${label}"`).toBe(true);
    for (const label of KNOWN[role].doesNotSee) expect(shown.some((text) => text.startsWith(label)), `${role} không được thấy "${label}"`).toBe(false);

    const findings: string[] = [];
    for (const item of items) {
      const response = await page.goto(item.href);
      const status = response?.status() ?? 0;
      if (status >= 500) findings.push(`${item.label} (${item.href}): máy chủ trả ${status}`);
      await expect(page.locator("#noi-dung")).toBeVisible();
      if (!checkedForAccessibility.has(item.href)) {
        checkedForAccessibility.add(item.href);
        for (const finding of await axeFindings(page)) findings.push(`${item.label} (${item.href}): ${finding}`);
      }
    }
    expect(findings, `lỗi trên các màn của vai trò ${role}`).toEqual([]);
    expect(problems, "không có lỗi console hay CSP").toEqual([]);
  });
}
