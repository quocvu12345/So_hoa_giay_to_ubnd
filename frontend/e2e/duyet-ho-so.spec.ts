import { expect, expectAccessible, FILE_INPUT, samplePdf, signIn, test, waitForHydration, watchConsole } from "./fixtures";

/**
 * Luồng duyệt hồ sơ theo nghiep-vu-vai-tro.html, với API và worker AI thật (cần scripts/dev-up.sh start, mất 1–3 phút):
 * chuyên viên Phòng Hạ tầng nạp PDF, đối chiếu, tạo hồ sơ, trình → trưởng phòng TRẢ LẠI (ý kiến ≥ 10 ký tự) → chuyên viên trình lại
 * → trưởng phòng đạt → văn thư tiếp nhận nộp lưu. Nhật ký phải ghi đủ, kể cả ý kiến trả lại.
 * Dữ liệu thử nằm lại trong hoso_dev (tên bắt đầu bằng "E2E").
 */
test("Trình → trả lại → trình lại → đạt → nộp lưu, đổi vai giữa các bước @integration", async ({ page }) => {
  const problems = watchConsole(page);
  const tag = `${Date.now()}`;
  const title = `E2E duyệt hồ sơ ${tag}`;
  await signIn(page, "employee");

  // ---- Chuẩn bị: nạp 1 PDF, đối chiếu, tạo hồ sơ và xếp vào ----
  await page.goto("/tiep-nhan/tai-len");
  await waitForHydration(page, FILE_INPUT);
  await page.locator(FILE_INPUT).setInputFiles([samplePdf("filled-u15-d07", `duyet${tag}`)]);
  await expect(page.getByText("Đã nạp 1/1 tệp")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("link", { name: "Đối chiếu ngay →" }).click({ timeout: 240_000 });
  await expect(page).toHaveURL(/\/doi-chieu$/);
  await expect(page.getByText("Thông tin đầu văn bản")).toBeVisible();
  await page.getByLabel("Ngày ban hành").fill("17/11/2026");
  for (const box of await page.getByLabel("Tôi đã kiểm trường này trên bản gốc").all()) await box.check();
  await page.keyboard.press("Control+Enter");
  await expect(page).toHaveURL(/\/xep-ho-so$/, { timeout: 60_000 });
  await page.getByRole("button", { name: "Tạo hồ sơ mới" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo hồ sơ mới" });
  await dialog.getByLabel(/Tên hồ sơ/).fill(title);
  await dialog.getByLabel(/Nhóm hồ sơ/).selectOption({ index: 1 });
  await dialog.getByRole("button", { name: "Tạo hồ sơ" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page).toHaveURL(/\/tiep-nhan(\?|$)/, { timeout: 30_000 });

  // ---- Danh sách hồ sơ: tìm theo từ khóa trên URL, mở hồ sơ ----
  await page.goto(`/ho-so?q=${encodeURIComponent(tag)}`);
  await expectAccessible(page);
  await page.getByRole("link", { name: new RegExp(title) }).first().click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const dossierUrl = page.url();
  const status = page.locator("header").getByText(/Đang chuẩn bị|Chờ trưởng phòng|Yêu cầu bổ sung|Chờ tiếp nhận nộp lưu|Đã lưu trữ/).first();
  await expect(status).toHaveText("Đang chuẩn bị");
  await expect(page.getByText(/Đủ điều kiện trình/)).toBeVisible();
  await expectAccessible(page);

  // ---- 1. Chuyên viên trình ----
  await page.getByRole("button", { name: "Trình trưởng phòng / Ban" }).click();
  await expect(status).toHaveText("Chờ trưởng phòng / Ban", { timeout: 30_000 });
  await expect(page.getByText("Bạn không có thao tác ở bước này")).toBeVisible();

  // ---- 2. Trưởng phòng Hạ tầng trả lại, ý kiến phải đủ 10 ký tự ----
  await signIn(page, "manager", "ht");
  await page.goto(dossierUrl);
  await page.getByRole("button", { name: "Trả lại để bổ sung" }).click();
  const send = page.getByRole("button", { name: /^Gửi: Trả lại/ });
  await page.getByLabel(/Ý kiến khi/).fill("Thiếu");
  await expect(send).toBeDisabled();
  await page.getByLabel(/Ý kiến khi/).fill("Thiếu báo cáo kết quả thực hiện, bổ sung rồi trình lại.");
  await send.click();
  await expect(page.locator("header").getByText("Yêu cầu bổ sung")).toBeVisible({ timeout: 30_000 });

  // ---- 3. Chuyên viên trình lại ----
  await signIn(page, "employee");
  await page.goto(dossierUrl);
  await expect(page.locator("header").getByText("Yêu cầu bổ sung")).toBeVisible();
  await page.getByRole("button", { name: "Trình trưởng phòng / Ban" }).click();
  await expect(status).toHaveText("Chờ trưởng phòng / Ban", { timeout: 30_000 });

  // ---- 4. Trưởng phòng đạt ----
  await signIn(page, "manager", "ht");
  await page.goto(dossierUrl);
  await page.getByRole("button", { name: "Đạt, chuyển nộp lưu" }).click();
  await expect(page.locator("header").getByText("Chờ tiếp nhận nộp lưu")).toBeVisible({ timeout: 30_000 });

  // ---- 5. Văn thư tiếp nhận nộp lưu ----
  await signIn(page, "clerk", undefined);
  await page.goto(dossierUrl);
  await page.getByRole("button", { name: "Tiếp nhận nộp lưu" }).click();
  await expect(page.locator("header").getByText("Đã lưu trữ")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Bạn không có thao tác ở bước này")).toBeVisible();

  // ---- Nhật ký ghi đủ, kể cả ý kiến trả lại ----
  await page.getByRole("link", { name: "Nhật ký" }).click();
  await expect(page.getByText("Thiếu báo cáo kết quả thực hiện, bổ sung rồi trình lại.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Trả lại/ }).first()).toBeVisible();
  await expectAccessible(page);

  expect(problems, "console phải sạch, không có cảnh báo CSP").toEqual([]);
});
