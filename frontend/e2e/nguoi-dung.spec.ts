import type { Page } from "@playwright/test";
import { expect, expectAccessible, signIn, test, watchConsole } from "./fixtures";

/**
 * FE-42 với API thật (scripts/dev-up.sh start): quản trị kỹ thuật thêm người dùng, thêm phân công có hạn (chip vàng khi sắp hết), ủy quyền và thu hồi,
 * kết thúc phân công, khóa và mở khóa; chuyên viên xem trang Tài khoản kèm lịch sử đăng nhập. Người dùng thử có tên bắt đầu "e2e." và "E2E".
 */
const main = (page: Page) => page.locator("main");
const inDays = (days: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + days * 86_400_000));

async function createUser(page: Page, username: string, displayName: string) {
  await page.goto("/quan-tri/nguoi-dung");
  await main(page).getByRole("button", { name: "Thêm người dùng" }).click();
  const dialog = page.getByRole("dialog", { name: "Thêm người dùng" });
  await dialog.getByLabel("Tên đăng nhập").fill(username);
  await dialog.getByLabel("Họ tên hiển thị").fill(displayName);
  await dialog.getByRole("button", { name: "Tạo người dùng" }).click();
  await expect(page).toHaveURL(/\/quan-tri\/nguoi-dung\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await expect(main(page).getByText("Người này chưa có phân công nào")).toBeVisible();
  return page.url();
}

async function addAssignment(page: Page, role: string, basis: string, validUntil?: string) {
  await main(page).getByRole("button", { name: "Thêm phân công" }).click();
  const dialog = page.getByRole("dialog", { name: "Thêm phân công" });
  await dialog.getByLabel("Vai trò").selectOption(role);
  if (role === "employee" || role === "manager") await dialog.getByLabel(/^Đơn vị/).selectOption({ index: 1 });
  if (validUntil) await dialog.getByLabel(/^Hết hạn/).fill(validUntil);
  await dialog.getByLabel(/^Căn cứ/).fill(basis);
  await dialog.getByRole("button", { name: "Thêm phân công" }).click();
  await expect(page.getByText("Đã thêm phân công.")).toBeVisible({ timeout: 30_000 });
}

test("Người dùng: thêm người, phân công có hạn, ủy quyền và thu hồi, kết thúc phân công, khóa và mở khóa @integration", async ({ page }) => {
  const problems = watchConsole(page);
  const tag = `${Date.now()}`;
  const a = { username: `e2e.a.${tag}`, name: `E2E Người ủy quyền ${tag}` };
  const b = { username: `e2e.b.${tag}`, name: `E2E Người nhận ${tag}` };
  await signIn(page, "employee");
  await page.goto("/quan-tri/nguoi-dung");
  await expect(main(page).getByText(/Bạn chưa có quyền quản lý người dùng/)).toBeVisible();      // chuyên viên không vào được

  await signIn(page, "technical_admin");
  const urlA = await createUser(page, a.username, a.name);
  await expectAccessible(page);
  const urlB = await createUser(page, b.username, b.name);

  // Phân công của A: căn cứ ngắn bị chặn tại ô; thêm trưởng phòng có hạn 3 ngày thì có chip vàng.
  await page.goto(urlA);
  await main(page).getByRole("button", { name: "Thêm phân công" }).click();
  const dialog = page.getByRole("dialog", { name: "Thêm phân công" });
  await dialog.getByLabel("Vai trò").selectOption("manager");
  await dialog.getByLabel(/^Căn cứ/).fill("ngắn");
  await dialog.getByRole("button", { name: "Thêm phân công" }).click();
  await expect(dialog.getByRole("alert").filter({ hasText: /Chọn đơn vị/ })).toBeVisible();
  await expect(dialog.getByText(/Ghi căn cứ từ 10 ký tự/)).toBeVisible();
  await dialog.getByRole("button", { name: "Hủy" }).click();
  await addAssignment(page, "manager", "Quyết định 15/QĐ-UBND ngày 01/11/2026", inDays(3));
  const assignments = main(page).getByRole("list", { name: "Phân công" });
  await expect(assignments.getByText(/Hết hạn sau [1-4] ngày/)).toBeVisible();
  await expectAccessible(page);

  // Danh sách: lọc phân công sắp hết hạn tìm ra A kèm chip; người không sắp hết hạn (B chưa có phân công) không có trong bộ lọc.
  await page.goto(`/quan-tri/nguoi-dung?q=${a.username}&sap-het-han=1`);
  const row = main(page).getByRole("link", { name: new RegExp(a.name) });
  await expect(row).toBeVisible();
  await expect(row.getByText(/1 phân công sắp hết hạn/)).toBeVisible();
  await page.goto(`/quan-tri/nguoi-dung?q=${b.username}&sap-het-han=1`);
  await expect(main(page).getByText("Không có người dùng khớp.")).toBeVisible();

  // Ủy quyền từ A sang B: chọn quyền, tối đa 90 ngày; thu hồi thì B không còn nhận.
  await page.goto(urlA);
  await main(page).getByRole("button", { name: "Tạo ủy quyền" }).click();
  const delegation = page.getByRole("dialog", { name: "Tạo ủy quyền" });
  await delegation.getByRole("button", { name: "Tạo ủy quyền" }).click();
  await expect(delegation.getByText("Chọn người nhận ủy quyền.")).toBeVisible();
  await expect(delegation.getByText(/Chọn ít nhất một quyền/)).toBeVisible();
  await delegation.getByLabel("Người nhận ủy quyền").selectOption({ label: `${b.name} (${b.username})` });
  await delegation.getByLabel(/dossier\.read/).check();
  await delegation.getByLabel(/^Hết hạn/).fill(inDays(5));
  await delegation.getByLabel(/^Căn cứ/).fill("Đi công tác theo Quyết định 33/QĐ-UBND");
  await delegation.getByRole("button", { name: "Tạo ủy quyền" }).click();
  await expect(page.getByText("Đã tạo ủy quyền.")).toBeVisible({ timeout: 30_000 });
  const given = main(page).getByRole("list", { name: "Ủy quyền đã trao" });
  await expect(given.getByText(`Ủy quyền cho ${b.username}`)).toBeVisible();
  await expect(given.getByText("Đang hiệu lực")).toBeVisible();

  await page.goto(urlB);
  await expect(main(page).getByRole("list", { name: "Ủy quyền đã nhận" }).getByText(/Nhận ủy quyền vai trò Trưởng phòng/)).toBeVisible();
  await page.goto(urlA);
  await main(page).getByRole("button", { name: `Thu hồi ủy quyền cho ${b.username}` }).click();
  await main(page).getByRole("button", { name: "Thu hồi", exact: true }).click();
  await expect(page.getByText("Đã thu hồi ủy quyền.")).toBeVisible({ timeout: 30_000 });
  await expect(main(page).getByRole("list", { name: "Ủy quyền đã trao" }).getByText("Đã thu hồi")).toBeVisible();

  // Kết thúc phân công của A.
  await main(page).getByRole("button", { name: /^Kết thúc phân công/ }).click();
  await main(page).getByRole("button", { name: "Kết thúc", exact: true }).click();
  await expect(page.getByText("Đã kết thúc phân công.")).toBeVisible({ timeout: 30_000 });
  await expect(assignments.getByText("Đã kết thúc")).toBeVisible();

  // Khóa và mở khóa A.
  await main(page).getByRole("button", { name: "Khóa tài khoản" }).click();
  await page.getByRole("dialog", { name: /Khóa tài khoản/ }).getByRole("button", { name: "Khóa tài khoản" }).click();
  await expect(page.getByText(/Đã khóa tài khoản/)).toBeVisible({ timeout: 30_000 });
  await page.goto(`/quan-tri/nguoi-dung?q=${a.username}&tt=locked`);
  await expect(main(page).getByRole("link", { name: new RegExp(a.name) })).toBeVisible();
  await page.goto(urlA);
  await main(page).getByRole("button", { name: "Mở khóa" }).click();
  await expect(page.getByText("Đã mở khóa tài khoản.")).toBeVisible({ timeout: 30_000 });

  expect(problems, "không có lỗi console/CSP").toEqual([]);
});

test("Tài khoản: thông tin, phân công và lịch sử đăng nhập gần đây @integration", async ({ page }) => {
  const problems = watchConsole(page);
  await signIn(page, "employee");
  await page.goto("/tai-khoan");
  await expect(main(page).getByRole("heading", { name: "Tài khoản", exact: true })).toBeVisible();
  await expect(main(page).getByRole("list", { name: "Phân công" }).getByText("Đang dùng")).toBeVisible();
  const logins = main(page).getByRole("list", { name: "Đăng nhập gần đây" });
  await expect(logins.getByRole("listitem").first()).toBeVisible();
  await expect(logins.getByText("Mới nhất")).toBeVisible();
  await expectAccessible(page);
  expect(problems, "không có lỗi console/CSP").toEqual([]);
});
