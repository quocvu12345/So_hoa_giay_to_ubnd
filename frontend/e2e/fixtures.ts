import { execFileSync } from "node:child_process";
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
export const ROLES = ["employee", "manager", "clerk", "chair", "council", "technical_admin"] as const;
export type Role = (typeof ROLES)[number];

export async function signIn(page: Page, role: Role = "employee", department?: string, username = "dev_admin") {
  // Đổi người giữa chừng: rời trang đang mở và bỏ cookie phân công của người trước TRƯỚC khi đăng nhập. Nếu không, trang cũ (luồng SSE,
  // chuông thông báo) có thể gọi máy chủ với phiên mới + phân công cũ; máy chủ xử lý đúng (ghi "assignment_cookie_stale", về phân công
  // mặc định) nhưng dòng cảnh báo lọt vào console và watchConsole báo lỗi. Người thật đổi tài khoản thì trang được tải lại từ đầu.
  const origin = page.url().startsWith("http") ? new URL(page.url()).origin : undefined;
  if (origin) await page.goto("about:blank");
  await page.context().clearCookies({ name: "hoso_assignment" });
  const login = await page.request.get(`/api/v1/auth/dev-login?username=${encodeURIComponent(username)}&returnUrl=/`);
  expect(login.ok(), `đăng nhập dev ${username} phải thành công`).toBeTruthy();
  const me = (await (await page.request.get("/api/v1/me")).json()) as { assignments: { id: string; role: string; departmentCode: string | null }[] };
  const assignment = me.assignments.find((a) => a.role === role && (department === undefined || a.departmentCode === department));
  expect(assignment, `tài khoản ${username} phải có phân công ${role}${department ? ` ở ${department}` : ""}`).toBeTruthy();
  const base = origin ?? new URL(process.env.E2E_BASE_URL ?? "http://localhost:3000").origin;
  await page.context().addCookies([{ name: "hoso_assignment", value: assignment!.id, url: base }]);
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

/**
 * Chạy một câu SQL trên CSDL dev (`psql`) để dựng dữ liệu mà giao diện không tạo được (ví dụ thông báo cho chính người đang thử:
 * API loại người thao tác khỏi người nhận). Chỉ dùng cho dữ liệu thử có tiền tố "E2E"; địa chỉ đổi được bằng `E2E_DATABASE_URL`.
 * Trả về từng dòng kết quả (cột cách nhau `|`), rỗng nếu không có.
 */
export function sql(statement: string): string[] {
  const url = process.env.E2E_DATABASE_URL ?? "postgresql://quoc@127.0.0.1:5432/hoso_dev";
  const out = execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-At", "-c", statement], { encoding: "utf8" });
  return out.split("\n").filter(Boolean);
}

/**
 * Tài khoản dev THỨ HAI có một phân công (idempotent): cần khi luật bắt "người khác" làm bước kế tiếp (phê duyệt hủy khác người đề nghị) mà `dev_admin`
 * là người duy nhất mọi E2E dùng. `is_demo` để đăng nhập được bằng đường dev. Dữ liệu thử mang tên đăng nhập bắt đầu "e2e.".
 */
export function ensureDevUser(username: string, displayName: string, role: string, organization: string) {
  sql(`INSERT INTO hoso.users(username, display_name, is_demo) VALUES ('${username}', '${displayName}', true) ON CONFLICT (username) DO UPDATE SET is_demo = true, active = true`);
  sql(`INSERT INTO hoso.user_roles(user_id, role_code, organization_code, assignment_basis)
       SELECT u.id, '${role}', '${organization}', 'E2E tài khoản thử, không dùng thật' FROM hoso.users u
       WHERE u.username = '${username}' AND NOT EXISTS (SELECT 1 FROM hoso.user_roles r WHERE r.user_id = u.id AND r.role_code = '${role}' AND r.organization_code = '${organization}')`);
}

/**
 * PDF nhiều trang hợp lệ tự dựng (bảng xref đúng): mẫu trong data/filled-samples đều một trang nên không dùng được để thử tách văn bản.
 * Mỗi trang ghi "Trang N" bằng chữ; `marker` làm mã băm khác nhau giữa các lần chạy (không bị chặn tải trùng).
 */
export function multiPagePdf(pages: number, marker: string) {
  const objects: string[] = [];
  const kids = Array.from({ length: pages }, (_, i) => `${3 + i * 2} 0 R`).join(" ");
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`);
  for (let i = 0; i < pages; i++) {
    const pageObject = 3 + i * 2;
    const stream = `BT /F1 24 Tf 20 160 Td (Trang ${i + 1} - ${marker}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 240 320] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${pageObject + 1} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => { offsets.push(body.length); body += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return { name: `e2e-nhieu-trang-${marker}.pdf`, mimeType: "application/pdf", buffer: Buffer.from(body, "latin1") };
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
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} chỗ) ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`), "lỗi tiếp cận nghiêm trọng").toEqual([]);
}

export const test = base.extend({});
export { expect };
