import type { Page } from "@playwright/test";
import { expect, expectAccessible, signIn, sql, test, watchConsole } from "./fixtures";

/**
 * FE-36 (quản lý vị trí kho) với API thật (scripts/dev-up.sh start): thêm kho, kệ, hộp (cấp con chỉ chọn được cấp sâu hơn, mã sai hoặc trùng báo rõ), sửa, đặt và chuyển vị trí
 * hồ sơ, ngừng dùng bị chặn khi còn hồ sơ rồi được khi đã chuyển đi, in nhãn cả nhánh. API không có thao tác xóa vị trí nên cây thử (mã E2E-UI-*) tạo MỘT lần
 * rồi dùng lại ở các lần chạy sau; cuối mỗi lần chạy vị trí được để ở trạng thái đang dùng. Hồ sơ thử dựng bằng SQL, mã bắt đầu "E2E-KHO".
 */
const main = (page: Page) => page.locator("main");
const ROOT = { code: "E2E-UI-KHO", name: "E2E Kho UI" };
const SHELF = { code: "E2E-UI-KE", name: "E2E Kệ UI" };
const BOX = { code: "E2E-UI-HOP", name: "E2E Hộp UI" };
const idOf = (code: string) => sql(`SELECT id FROM hoso.storage_locations WHERE code = '${code}'`)[0];

async function add(page: Page, kind: string, spec: { code: string; name: string }, buttonName: string) {
  await main(page).getByRole("button", { name: buttonName }).click();
  const dialog = page.getByRole("dialog", { name: /^Thêm (kho|vị trí)/ });
  await dialog.getByLabel("Cấp").selectOption(kind);
  await dialog.getByLabel("Mã vị trí").fill(spec.code);
  await dialog.getByLabel("Tên vị trí").fill(spec.name);
  await dialog.getByRole("button", { name: "Thêm vị trí" }).click();
}

test("Kho bản giấy: thêm vị trí các cấp, đặt và chuyển vị trí hồ sơ, ngừng dùng bị chặn khi còn hồ sơ, in nhãn cả nhánh @integration", async ({ page }) => {
  const problems = watchConsole(page);
  const tag = `${Date.now()}`;
  const code = `E2E-KHO-${tag}`;
  // Hồ sơ thử còn sót từ lần chạy hỏng trước vẫn nằm trong hộp thử và chặn việc ngừng dùng: gỡ vị trí của chúng.
  sql(`UPDATE hoso.dossiers SET storage_location_id = NULL, physical_location = NULL WHERE code LIKE 'E2E-KHO-%' AND storage_location_id IS NOT NULL`);

  await signIn(page, "employee");
  await page.goto("/kho-ban-giay");
  await expect(main(page).getByText(/Bạn chưa có quyền quản lý kho bản giấy/)).toBeVisible();

  await signIn(page, "clerk");
  await page.goto("/kho-ban-giay");
  await expect(page.getByRole("heading", { name: "Kho bản giấy", exact: true, level: 1 })).toBeVisible();
  await expectAccessible(page);

  // Kho gốc: mã sai bị chặn ngay ở ô; tạo nếu chưa có.
  await main(page).getByRole("button", { name: "Thêm kho" }).click();
  const bad = page.getByRole("dialog", { name: "Thêm kho" });
  await bad.getByLabel("Mã vị trí").fill("không hợp lệ!");
  await bad.getByLabel("Tên vị trí").fill("x");
  await bad.getByRole("button", { name: "Thêm vị trí" }).click();
  await expect(bad.getByText(/Mã vị trí gồm chữ, số/)).toBeVisible();
  await bad.getByRole("button", { name: "Hủy" }).click();
  if (!idOf(ROOT.code)) {
    await add(page, "warehouse", ROOT, "Thêm kho");
    await expect(page).toHaveURL(/\/kho-ban-giay\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  } else await page.goto(`/kho-ban-giay/${idOf(ROOT.code)}`);
  await expect(page.getByRole("heading", { name: ROOT.name, level: 1 })).toBeVisible();

  // Trong kho: chỉ chọn được cấp sâu hơn (không có "Kho"); thêm kệ nếu chưa có. Mã trùng thì báo rõ.
  await main(page).getByRole("button", { name: "Thêm vị trí con" }).click();
  const kinds = await page.getByRole("dialog", { name: /^Thêm vị trí trong/ }).getByLabel("Cấp").locator("option").allTextContents();
  expect(kinds).toEqual(["Phòng", "Tủ", "Kệ", "Hộp"]);
  await page.getByRole("dialog", { name: /^Thêm vị trí trong/ }).getByRole("button", { name: "Hủy" }).click();
  if (!idOf(SHELF.code)) {
    await add(page, "shelf", SHELF, "Thêm vị trí con");
    await expect(page).toHaveURL(/\/kho-ban-giay\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  } else {
    await add(page, "shelf", SHELF, "Thêm vị trí con");
    await expect(page.getByRole("dialog", { name: /^Thêm vị trí trong/ }).getByRole("alert").filter({ hasText: /.+/ }).first()).toBeVisible({ timeout: 30_000 });      // mã đã tồn tại
    await page.getByRole("dialog", { name: /^Thêm vị trí trong/ }).getByRole("button", { name: "Hủy" }).click();
    await page.goto(`/kho-ban-giay/${idOf(SHELF.code)}`);
  }
  await expect(page.getByRole("heading", { name: SHELF.name, level: 1 })).toBeVisible();
  // Trong kệ chỉ còn "Hộp".
  await main(page).getByRole("button", { name: "Thêm vị trí con" }).click();
  expect(await page.getByRole("dialog", { name: /^Thêm vị trí trong/ }).getByLabel("Cấp").locator("option").allTextContents()).toEqual(["Hộp"]);
  await page.getByRole("dialog", { name: /^Thêm vị trí trong/ }).getByRole("button", { name: "Hủy" }).click();
  if (!idOf(BOX.code)) {
    await add(page, "box", BOX, "Thêm vị trí con");
    await expect(page).toHaveURL(/\/kho-ban-giay\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  } else await page.goto(`/kho-ban-giay/${idOf(BOX.code)}`);
  const boxUrl = page.url();
  // Hộp là cấp cuối: không còn nút thêm vị trí con.
  await expect(main(page).getByRole("button", { name: "Thêm vị trí con" })).toHaveCount(0);

  // Dùng lại nếu lần trước dừng giữa chừng; sửa tên.
  if (await main(page).getByRole("button", { name: "Dùng lại" }).count()) await main(page).getByRole("button", { name: "Dùng lại" }).click();
  await main(page).getByRole("button", { name: "Sửa", exact: true }).click();
  const edit = page.getByRole("dialog", { name: `Sửa ${BOX.name}` });
  await edit.getByLabel("Tên vị trí").fill("");
  await edit.getByRole("button", { name: "Lưu" }).click();
  await expect(edit.getByText("Nhập tên vị trí.")).toBeVisible();
  await edit.getByLabel("Tên vị trí").fill(BOX.name);
  await edit.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã lưu vị trí.")).toBeVisible({ timeout: 30_000 });

  // Nhãn cả nhánh của kho: liên kết in tới API, trả PDF.
  await page.goto(`/kho-ban-giay/${idOf(ROOT.code)}`);
  const labels = main(page).getByRole("link", { name: /In nhãn cả nhánh/ });
  const pdf = await page.request.get((await labels.getAttribute("href"))!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");

  // Đặt hồ sơ vào hộp, chuyển sang kệ; ngừng dùng hộp bị chặn khi còn hồ sơ.
  const [dossierId] = sql(`INSERT INTO hoso.dossiers(code, origin, title, year, organization_code, department_code, work_group_code, status, created_by)
    SELECT '${code}', 'internal', 'E2E kho ${code}', 2026, 'tl-ubnd', 'ht', 'U15', 'draft', (SELECT id FROM hoso.users WHERE username = 'dev_admin') RETURNING id`);
  await page.goto(`/ho-so/${dossierId}`);
  await main(page).getByRole("button", { name: "Đặt vị trí" }).click();
  const place = page.getByRole("dialog", { name: "Đặt vị trí bản giấy" });
  await place.getByLabel("Vị trí mới").selectOption({ label: `${ROOT.name} › ${SHELF.name} › ${BOX.name}` });
  await place.getByLabel(/^Ghi chú/).fill("E2E xếp vào hộp");
  await place.getByRole("button", { name: "Lưu vị trí" }).click();
  await expect(page.getByText(new RegExp(`Đã đặt hồ sơ ở ${ROOT.name}`))).toBeVisible({ timeout: 30_000 });
  await expect(main(page).getByRole("link", { name: `${ROOT.name} › ${SHELF.name} › ${BOX.name}` })).toBeVisible();

  await page.goto(boxUrl);
  await expect(main(page).getByRole("link", { name: new RegExp(code) })).toBeVisible();
  await main(page).getByRole("button", { name: "Ngừng dùng" }).click();
  await expect(main(page).getByRole("alert").filter({ hasText: /còn \d+ hồ sơ/ })).toBeVisible({ timeout: 30_000 });

  await page.goto(`/ho-so/${dossierId}`);
  await main(page).getByRole("button", { name: "Chuyển vị trí" }).click();
  const move = page.getByRole("dialog", { name: "Chuyển vị trí bản giấy" });
  await move.getByLabel("Vị trí mới").selectOption({ label: `${ROOT.name} › ${SHELF.name}` });
  await move.getByRole("button", { name: "Lưu vị trí" }).click();
  await expect(page.getByText(`Đã đặt hồ sơ ở ${ROOT.name} › ${SHELF.name}.`)).toBeVisible({ timeout: 30_000 });
  await page.goto(boxUrl);
  await main(page).getByRole("button", { name: "Ngừng dùng" }).click();
  await expect(page.getByText("Đã ngừng dùng vị trí.")).toBeVisible({ timeout: 30_000 });
  await main(page).getByRole("button", { name: "Dùng lại" }).click();
  await expect(page.getByText("Đã dùng lại vị trí.")).toBeVisible({ timeout: 30_000 });

  // Gỡ vị trí hồ sơ.
  await page.goto(`/ho-so/${dossierId}`);
  await main(page).getByRole("button", { name: "Chuyển vị trí" }).click();
  await page.getByRole("dialog", { name: "Chuyển vị trí bản giấy" }).getByRole("button", { name: "Gỡ vị trí" }).click();
  await expect(page.getByText("Đã gỡ vị trí bản giấy của hồ sơ.")).toBeVisible({ timeout: 30_000 });
  await expect(main(page).getByText("Chưa đặt")).toBeVisible();

  expect(problems, "không có lỗi console/CSP").toEqual([]);
});
