import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test as base, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * FE-10. Fixture dùng chung cho E2E chế độ tích hợp (stack thật: scripts/dev-up.sh start).
 * Đăng nhập bằng tài khoản dev của API (GET /api/v1/auth/dev-login, chỉ có ở môi trường dev), chọn phân công theo vai trò.
 */

/**
 * Đăng nhập bằng `dev_admin` rồi chọn phân công theo vai trò (và đầu mối nếu có nhiều phân công cùng vai trò, ví dụ trưởng phòng),
 * như khi người dùng bấm đổi phân công. Gọi lại để đổi vai giữa chừng; trang đang mở cần tải lại để thấy phân công mới.
 */
export async function signIn(page: Page, role: "employee" | "manager" | "clerk" = "employee", department?: string) {
  const login = await page.request.get("/api/v1/auth/dev-login?username=dev_admin&returnUrl=/");
  expect(login.ok(), "đăng nhập dev phải thành công").toBeTruthy();
  const me = (await (await page.request.get("/api/v1/me")).json()) as { assignments: { id: string; role: string; departmentCode: string | null }[] };
  const assignment = me.assignments.find((a) => a.role === role && (department === undefined || a.departmentCode === department));
  expect(assignment, `tài khoản dev_admin phải có phân công ${role}${department ? ` ở ${department}` : ""}`).toBeTruthy();
  const base = new URL(page.url() === "about:blank" ? (process.env.E2E_BASE_URL ?? "http://localhost:3000") : page.url());
  await page.context().addCookies([{ name: "hoso_assignment", value: assignment!.id, url: base.origin }]);
}

/**
 * Ô chọn tệp của trang Nạp PDF. Phải giới hạn trong <main>: khi React đang stream nội dung, bản sao của trang nằm tạm trong
 * một thẻ `hidden` ngoài <main>, nên `input[type=file]` trần có thể khớp hai phần tử trong vài trăm mili giây đầu.
 */
export const FILE_INPUT = 'main input[type="file"]';

/**
 * Chờ React gắn xong vào phần tử (hydrate) trước khi thao tác. Thao tác sớm hơn (đặc biệt `setInputFiles`, `fill`) có thể rơi vào lúc
 * trình xử lý sự kiện chưa được gắn nên bị bỏ qua, nhất là khi `next dev` đang biên dịch lại. React gắn `__reactProps$…` lên nút DOM khi hydrate.
 */
export async function waitForHydration(page: Page, selector: string) {
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return Boolean(el && Object.keys(el).some((k) => k.startsWith("__reactProps$")));
  }, selector);
}

/** PDF mẫu quét giả lập trong data/filled-samples/pdf, thêm dòng riêng ở cuối để mã băm khác nhau (không bị chặn tải trùng). */
export function samplePdf(sample: string, tag: string) {
  const path = resolve(__dirname, "../../data/filled-samples/pdf", `${sample}.pdf`);
  const bytes = Buffer.concat([readFileSync(path), Buffer.from(`\n% e2e ${tag} ${Date.now()}-${Math.random()}\n`)]);
  return { name: `e2e-${sample}-${tag}.pdf`, mimeType: "application/pdf", buffer: bytes };
}

/** Lỗi CSP và lỗi script trong console. Màn đạt khi không có dòng nào. */
export function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" || /content security policy/i.test(text)) problems.push(`[${message.type()}] ${text}`);
  });
  page.on("pageerror", (error) => problems.push(`[pageerror] ${error.message}`));
  return problems;
}

/** Quét tiếp cận bằng axe: không được có lỗi mức nghiêm trọng hoặc rất nghiêm trọng. */
export async function expectAccessible(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} chỗ)`), "lỗi tiếp cận nghiêm trọng").toEqual([]);
}

export const test = base.extend({});
export { expect };
