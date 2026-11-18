import { expect, expectAccessible, signIn, test, watchConsole } from "./fixtures";

/**
 * FE-38 với API thật (scripts/dev-up.sh start, ExportWorker chạy nền cùng API): văn thư tạo gói xuất hồ sơ đã lưu trữ, thấy gói chuyển từ đang đóng sang sẵn sàng
 * không cần tải lại (SSE), tải được ZIP kèm mã băm; điều kiện thiếu hoặc không hồ sơ nào khớp thì báo rõ. Cần có ít nhất một hồ sơ đã lưu trữ (E2E nop-luu để lại).
 */
test("Xuất dữ liệu: tạo gói, theo dõi tiến độ, tải ZIP; điều kiện thiếu hoặc không khớp thì báo rõ @integration", async ({ page }) => {
  const problems = watchConsole(page);
  const main = page.locator("main");
  await signIn(page, "employee");
  await page.goto("/xuat-du-lieu");
  await expect(main.getByText(/Bạn chưa có quyền xuất dữ liệu/)).toBeVisible();      // chuyên viên không có quyền xuất

  await signIn(page, "clerk");
  await page.goto("/xuat-du-lieu");
  await expect(main.getByRole("heading", { name: "Tạo gói xuất" })).toBeVisible();
  await expectAccessible(page);

  // Không điều kiện nào: chặn ngay ở giao diện.
  await main.getByLabel("Trạng thái hồ sơ").selectOption("");
  await main.getByRole("button", { name: "Tạo gói xuất" }).click();
  await expect(main.getByText(/Chọn ít nhất một điều kiện/)).toBeVisible();

  // Khoảng thời gian không có hồ sơ nào: API trả 422 export_empty, giao diện nêu lý do.
  await main.getByLabel("Trạng thái hồ sơ").selectOption("archived");
  await main.getByLabel("Lưu trữ từ ngày").fill("2099-01-01");
  await main.getByRole("button", { name: "Tạo gói xuất" }).click();
  await expect(main.getByText(/Không có hồ sơ nào khớp điều kiện/)).toBeVisible({ timeout: 30_000 });
  await main.getByLabel("Lưu trữ từ ngày").fill("");

  // Tạo gói thật: chuyển tới sẵn sàng (SSE hoặc làm mới), có nút tải và mã băm.
  await main.getByRole("button", { name: "Tạo gói xuất" }).click();
  await expect(page.getByText(/Đã tạo gói xuất \d+ hồ sơ/)).toBeVisible({ timeout: 30_000 });
  const list = main.getByRole("list", { name: "Gói xuất gần đây" });
  const newest = list.getByRole("listitem").first();
  await expect(newest.getByText("Sẵn sàng tải")).toBeVisible({ timeout: 120_000 });
  await expect(newest.getByText(/SHA-256 của danh mục/)).toBeVisible();
  await expect(newest.getByText(/Còn \d+ ngày để tải/)).toBeVisible();
  const download = newest.getByRole("link", { name: /Tải gói xuất/ });
  const response = await page.request.get((await download.getAttribute("href"))!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("zip");
  const body = await response.body();
  expect(body.subarray(0, 2).toString("latin1")).toBe("PK");      // đúng là tệp ZIP
  await expectAccessible(page);

  expect(problems, "không có lỗi console/CSP").toEqual([]);
});
