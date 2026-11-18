import { expect, expectAccessible, signIn, sql, test, watchConsole } from "./fixtures";

/**
 * FE-40 với API thật (scripts/dev-up.sh start). Thông báo được chèn thẳng vào CSDL cho `dev_admin` (API không gửi thông báo cho chính người thao tác);
 * trigger của CSDL phát SSE `notification.created` như khi API ghi, nên chuông và trang tự cập nhật. Dữ liệu thử mang tiền tố "E2E thông báo".
 */
const OWNER = "(SELECT id FROM hoso.users WHERE username = 'dev_admin')";

test("Thông báo: danh sách phân trang, bấm mở đúng nơi và đánh dấu đã đọc, chuông tăng ngay khi có thông báo mới, đánh dấu tất cả @integration", async ({ page }) => {
  const problems = watchConsole(page);
  const tag = `${Date.now()}`;
  const title = (n: number) => `E2E thông báo ${tag} số ${n}`;
  // Dọn dữ liệu của các lần chạy trước (nếu không, thông báo cũ xen vào làm lệch trang), rồi dựng 32 thông báo
  // (nhiều hơn một trang 30), số 1 mới nhất; thông báo số 1 trỏ tới Tra cứu.
  sql(`DELETE FROM hoso.notifications WHERE title LIKE 'E2E thông báo %'`);
  sql(`
    INSERT INTO hoso.notifications(user_id, kind, title, body, link, created_at)
    SELECT ${OWNER}, 'dossier.due', 'E2E thông báo ${tag} số ' || n, 'Nội dung thử ' || n,
           CASE WHEN n = 1 THEN '/tra-cuu' END, now() - n * interval '1 minute'
    FROM generate_series(1, 32) n`);

  await signIn(page, "employee");
  await page.goto("/thong-bao");
  const main = page.locator("main");
  await expect(main.getByRole("heading", { name: "Thông báo" })).toBeVisible();
  await expectAccessible(page);

  const list = main.getByRole("list", { name: "Danh sách thông báo" });
  await expect(list.getByText(title(1), { exact: true })).toBeVisible();
  await expect(list.getByRole("listitem")).toHaveCount(30);           // trang đầu 30 dòng
  await main.getByRole("button", { name: "Tải thêm" }).click();
  await expect(list.getByText(title(32), { exact: true })).toBeVisible();              // trang sau có dòng cũ nhất
  await expect(main.getByRole("button", { name: "Tải thêm" })).toHaveCount(0);

  // Chuông có số chưa đọc (ít nhất 32 thông báo vừa chèn).
  const bell = page.getByRole("link", { name: /^Thông báo, \d+ chưa đọc$/ });
  await expect(bell).toBeVisible();
  const before = Number((await bell.getAttribute("aria-label"))!.match(/\d+/)![0]);
  expect(before).toBeGreaterThanOrEqual(32);

  // SSE: thông báo mới đến thì chuông tăng ngay, không cần tải lại.
  sql(`INSERT INTO hoso.notifications(user_id, kind, title, body) SELECT ${OWNER}, 'dossier.due', 'E2E thông báo ${tag} mới đến', ''`);
  await expect(page.getByRole("link", { name: `Thông báo, ${before + 1} chưa đọc` })).toBeVisible({ timeout: 10_000 });
  // Trang cũng tự làm mới: thông báo mới lên đầu danh sách.
  await expect(list.getByText(`E2E thông báo ${tag} mới đến`, { exact: true })).toBeVisible({ timeout: 10_000 });

  // Bấm thông báo số 1: mở Tra cứu và đánh dấu đã đọc.
  await list.getByRole("link", { name: new RegExp(`${title(1)}(?!\\d)`) }).click();
  await expect(page).toHaveURL(/\/tra-cuu$/);
  await page.goto("/thong-bao?chua-doc=1");
  await expect(main.getByRole("list", { name: "Danh sách thông báo" }).getByText(title(2), { exact: true })).toBeVisible();
  await expect(main.getByText(title(1), { exact: true })).toHaveCount(0);   // đã đọc nên không còn trong bộ lọc chưa đọc

  // Đánh dấu tất cả đã đọc: chuông về 0, bộ lọc chưa đọc rỗng.
  await main.getByRole("button", { name: /Đánh dấu tất cả/ }).click();
  await expect(page.getByText(/Đã đánh dấu \d+ thông báo là đã đọc/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Thông báo, 0 chưa đọc" })).toBeVisible({ timeout: 15_000 });
  await expect(main.getByText("Không có thông báo chưa đọc")).toBeVisible({ timeout: 15_000 });

  expect(problems, "không có lỗi console/CSP").toEqual([]);
});
