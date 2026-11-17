import { expect, expectAccessible, FILE_INPUT, samplePdf, signIn, test, waitForHydration, watchConsole } from "./fixtures";

/**
 * Luồng tiếp nhận trên giao diện với API thật (docs/tasks/ai.md bước 3):
 * nạp 3 PDF → hàng đợi → "Trích xuất ngay" → AI đọc xong (SSE) → đối chiếu → tạo hồ sơ và xếp vào.
 * Cần stack thật chạy (scripts/dev-up.sh start), gồm worker AI; mất khoảng 1–3 phút. Dữ liệu thử nằm lại trong hoso_dev (tên bắt đầu bằng "E2E").
 */
test("Nạp 3 PDF, đọc xong, đối chiếu và xếp vào hồ sơ mới @integration", async ({ page }) => {
  const problems = watchConsole(page);
  const tag = `${Date.now()}`;
  await signIn(page, "employee");

  // ---- Bước 1: nạp ----
  await page.goto("/tiep-nhan/tai-len");
  await expect(page.getByRole("heading", { name: "Nạp PDF" })).toBeVisible();
  await expectAccessible(page);
  await waitForHydration(page, FILE_INPUT);
  await page.locator(FILE_INPUT).setInputFiles([samplePdf("filled-u15-d07", tag), samplePdf("filled-u02-d01", tag), samplePdf("filled-u08-d01", tag)]);
  await expect(page.getByText(`e2e-filled-u15-d07-${tag}.pdf`)).toBeVisible();
  await expect(page.getByText("Đã nạp 3/3 tệp")).toBeVisible({ timeout: 60_000 });

  // Mỗi tệp báo tình trạng đọc ngay sau khi nạp xong (vị trí trong khay hoặc đang đọc).
  const statuses = page.locator("li").filter({ hasText: `-${tag}.pdf` });
  await expect(statuses).toHaveCount(3);
  for (let i = 0; i < 3; i++) await expect(statuses.nth(i)).toContainText(/Chờ trong khay|Đang đọc|Ưu tiên|Đã đọc xong/, { timeout: 30_000 });

  // ---- Hộp tiếp nhận: Trích xuất ngay ở PDF thứ 3 ----
  await page.getByRole("link", { name: "Mở hộp tiếp nhận" }).click();
  await expect(page).toHaveURL(/\/tiep-nhan(\?|$)/);
  const third = page.locator("tbody tr").filter({ hasText: `filled-u08-d01-${tag}` });
  await expect(third).toBeVisible();
  await expectAccessible(page);
  const extract = third.getByRole("button", { name: "Trích xuất ngay" });
  if (await extract.isVisible().catch(() => false)) {
    await extract.click();
    await expect(third.getByText(/Đã đưa .* lên đầu hàng|đang được đọc|đã đọc xong/)).toBeVisible();
  }

  // ---- AI đọc xong: bảng tự cập nhật qua SSE, không tải lại trang ----
  await expect(third.getByText(/Đã đọc xong/).first()).toBeVisible({ timeout: 240_000 });
  await third.getByRole("link", { name: "Đối chiếu" }).click();

  // ---- Bước 2: đối chiếu ----
  await expect(page).toHaveURL(/\/doi-chieu$/);
  await expect(page.getByText("Thông tin đầu văn bản")).toBeVisible();
  await expect(page.getByRole("img", { name: /Trang 1 của bản gốc/ })).toBeVisible({ timeout: 30_000 });
  await expectAccessible(page);
  await page.getByLabel("Ngày ban hành").fill("31/02/2026");
  await page.getByRole("button", { name: /Xác nhận, xếp vào hồ sơ/ }).click();
  await expect(page.getByText("Nhập ngày dạng ngày/tháng/năm")).toBeVisible(); // lỗi hiện tại đúng ô, không gửi lên API
  await page.getByLabel("Ngày ban hành").fill("17/11/2026");
  for (const box of await page.getByLabel("Tôi đã kiểm trường này trên bản gốc").all()) await box.check();
  await page.keyboard.press("Control+Enter");

  // ---- Bước 3: xếp hồ sơ ----
  await expect(page).toHaveURL(/\/xep-ho-so$/, { timeout: 60_000 });
  await expectAccessible(page);
  await page.getByRole("button", { name: "Tạo hồ sơ mới" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo hồ sơ mới" });
  await dialog.getByLabel(/Tên hồ sơ/).fill(`E2E hồ sơ thử ${tag}`);
  await dialog.getByLabel(/Nhóm hồ sơ/).selectOption({ index: 1 });
  await dialog.getByRole("button", { name: "Tạo hồ sơ" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page).toHaveURL(/\/tiep-nhan(\?|$)/, { timeout: 30_000 });
  await expect(page.getByText(/Đã xếp .* vào hồ sơ/)).toBeVisible();

  expect(problems, "console phải sạch, không có cảnh báo CSP").toEqual([]);
});
