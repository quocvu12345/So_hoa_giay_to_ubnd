import { expect, expectAccessible, signIn, test, watchConsole } from "./fixtures";

/**
 * FE-35 với API thật (scripts/dev-up.sh start, CSDL dev có thủ tục nạp từ data/official-forms): tìm không dấu, lọc trên URL, chi tiết thành phần và mẫu biểu,
 * thủ tục đã bãi bỏ có cảnh báo và không tạo được hồ sơ, tạo hồ sơ theo thủ tục. Hồ sơ thử tên bắt đầu "E2E".
 */
test("Thủ tục: tìm không dấu, lọc trên URL, xem thành phần và tải mẫu, tạo hồ sơ theo thủ tục @integration", async ({ page }) => {
  const problems = watchConsole(page);
  const tag = `${Date.now()}`;
  const main = page.locator("main");
  await signIn(page, "employee");

  // Tìm không dấu: "khai sinh" ra thủ tục có chữ "khai sinh"; kết quả đếm và bộ lọc nằm trên URL.
  await page.goto("/thu-tuc");
  await expect(main.getByRole("heading", { name: "Thủ tục hành chính", exact: true })).toBeVisible();
  await expectAccessible(page);
  await main.getByLabel(/^Từ khóa/).fill("khai sinh");
  await main.getByLabel("Hiệu lực").selectOption("active");
  await main.getByRole("button", { name: "Tìm" }).click();
  await expect(page).toHaveURL(/q=khai\+sinh.*hieu-luc=active|hieu-luc=active.*q=khai\+sinh/);
  const list = main.getByRole("list", { name: "Danh sách thủ tục" });
  await expect(list.getByRole("link").first()).toBeVisible();
  await expect(main.getByText(/\d[\d.]* thủ tục/)).toBeVisible();
  // Lọc cấp thực hiện lấy từ danh sách API (đã gộp hoa/thường): chọn một cấp thì URL mang `cap=`.
  const levelOptions = await main.getByLabel("Cấp thực hiện").locator("option").allTextContents();
  expect(levelOptions.length).toBeGreaterThan(1);
  await main.getByLabel("Cấp thực hiện").selectOption({ index: 1 });
  await main.getByRole("button", { name: "Tìm" }).click();
  await expect(page).toHaveURL(/cap=/);
  await main.getByRole("link", { name: "Xóa lọc" }).click();
  await expect(page).toHaveURL(/\/thu-tuc$/);

  // Chi tiết một thủ tục đang hiệu lực có mẫu tải về: thành phần theo mục, số bản, nút tạo hồ sơ.
  await page.goto("/thu-tuc?q=khai+sinh&hieu-luc=active");
  await list.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/thu-tuc\/[A-Za-z0-9._-]+$/);
  const procedureUrl = page.url();
  await expect(main.getByRole("heading", { name: /^Thành phần hồ sơ \(\d+\)$/ })).toBeVisible();
  await expectAccessible(page);
  const template = main.locator('a[href^="/api/v1/form-templates/"]').first();
  if (await template.count()) {
    const response = await page.request.get((await template.getAttribute("href"))!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-disposition"] ?? "").toContain("filename");
  }

  // Tạo hồ sơ theo thủ tục: biểu mẫu mang theo thủ tục; hồ sơ mới ghi tên thủ tục.
  const procedureName = (await main.getByRole("heading", { level: 1 }).or(page.locator("header h1")).first().innerText()).trim();
  await page.getByRole("link", { name: "Tạo hồ sơ theo thủ tục này" }).click();
  await expect(page).toHaveURL(/\/ho-so\/tao-moi\?thu-tuc=/);
  await expect(main.getByText(/Hồ sơ theo thủ tục này có \d+ thành phần/)).toBeVisible();
  await main.getByLabel(/Tên hồ sơ/).fill(`E2E hồ sơ theo thủ tục ${tag}`);
  await main.getByLabel(/Nhóm hồ sơ/).selectOption({ index: 1 });
  await main.getByRole("button", { name: /^Tạo hồ sơ$/ }).click();
  await expect(page).toHaveURL(/\/ho-so\/[0-9a-f-]{36}\/giay-to$/, { timeout: 30_000 });
  await page.goto(page.url().replace(/\/giay-to$/, ""));
  await expect(main.getByText(procedureName.slice(0, 40), { exact: false }).first()).toBeVisible();
  await page.goto(procedureUrl);

  // Thủ tục đã bãi bỏ: có cảnh báo, không có nút tạo hồ sơ; mở thẳng đường tạo cũng bị từ chối nhẹ nhàng (hồ sơ thường vẫn tạo được).
  await page.goto("/thu-tuc?hieu-luc=repealed");
  await list.getByRole("link").first().click();
  await expect(page.getByRole("alert").filter({ hasText: /không dùng mẫu cũ/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tạo hồ sơ theo thủ tục này" })).toHaveCount(0);
  const retiredId = page.url().split("/").pop()!;
  await page.goto(`/ho-so/tao-moi?thu-tuc=${retiredId}`);
  await expect(main.getByText(/đã bãi bỏ hoặc được thay thế nên không dùng để tạo hồ sơ mới/)).toBeVisible();
  await expect(main.getByText(/Hồ sơ theo thủ tục này có \d+ thành phần/)).toHaveCount(0);

  expect(problems, "không có lỗi console/CSP").toEqual([]);
});
