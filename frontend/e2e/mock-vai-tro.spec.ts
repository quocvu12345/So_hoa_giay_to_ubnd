import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { NAVIGATION } from "../src/config/navigation";
import { MOCK_ACCOUNTS, MOCK_ROLE_PERMISSIONS } from "../src/lib/mock/accounts";
import { expect, test, watchConsole } from "./fixtures";

/**
 * FE-10, QA-05. Chế độ GIẢ LẬP (E2E_MODE=mock, mặc định): web tự chạy với HOSO_MOCK=1, KHÔNG cần API hay CSDL, nên chạy được ở CI.
 * Với mỗi tài khoản mẫu (mỗi vai trò một tài khoản): menu hiện đúng mục theo quyền của vai trò, mở từng màn trong menu không lỗi máy chủ,
 * không lỗi console/CSP và không có lỗi tiếp cận nghiêm trọng (axe WCAG 2 A/AA). Bản dùng API thật: `vai-tro.spec.ts`.
 */

const MOCK_USER_COOKIE = "hoso_mock_user";
const checked = new Set<string>();

const visible = (item: { permission?: string | string[] }, permissions: readonly string[]) => {
  const required = item.permission === undefined ? [] : Array.isArray(item.permission) ? item.permission : [item.permission];
  return required.length === 0 || required.some((p) => permissions.includes(p));
};

async function axeFindings(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  return result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.help} (${v.nodes.length} chỗ) ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
}

for (const account of MOCK_ACCOUNTS) {
  const active = account.assignments[0];
  test(`Giả lập · ${active.role} (${account.username}): menu đúng theo quyền, các màn mở được và đạt tiếp cận`, async ({ page, baseURL }) => {
    const problems = watchConsole(page);
    await page.context().addCookies([{ name: MOCK_USER_COOKIE, value: account.username, url: baseURL! }]);
    await page.goto("/viec-cua-toi");
    const menu = page.locator('nav[aria-label="Menu chính"]').first();
    await expect(menu).toBeVisible();

    const permissions = MOCK_ROLE_PERMISSIONS[active.role];
    const all = NAVIGATION.flatMap((group) => group.items);
    const shown = (await menu.getByRole("link").allInnerTexts()).map((text) => text.replace(/\s+/g, " ").trim());
    for (const item of all) {
      expect(shown.some((text) => text.startsWith(item.label)), `${active.role} ${visible(item, permissions) ? "phải" : "không được"} thấy "${item.label}"`).toBe(visible(item, permissions));
    }

    const findings: string[] = [];
    for (const item of all.filter((i) => visible(i, permissions))) {
      const response = await page.goto(item.href);
      if ((response?.status() ?? 0) >= 500) findings.push(`${item.label} (${item.href}): máy chủ trả ${response?.status()}`);
      await expect(page.locator("#noi-dung")).toBeVisible();
      if (!checked.has(item.href)) {
        checked.add(item.href);
        for (const finding of await axeFindings(page)) findings.push(`${item.label} (${item.href}): ${finding}`);
      }
    }
    expect(findings, `lỗi trên các màn của vai trò ${active.role}`).toEqual([]);
    expect(problems, "không có lỗi console hay CSP").toEqual([]);
  });
}

test("Giả lập · chưa đăng nhập thì về trang đăng nhập, không lộ nội dung", async ({ page }) => {
  await page.goto("/ho-so");
  await expect(page).toHaveURL(/\/dang-nhap/);
  await expect(page.getByRole("heading", { name: "Hồ sơ số" })).toBeVisible();
  await expect(page.locator("#noi-dung").getByText("Việc của tôi")).toHaveCount(0);        // không lộ nội dung của trang đã yêu cầu
});
