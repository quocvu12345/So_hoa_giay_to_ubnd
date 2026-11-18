import type { Page } from "@playwright/test";
import { expect, expectAccessible, signIn, sql, test, watchConsole } from "./fixtures";

/**
 * FE-43 với API thật (scripts/dev-up.sh start): quản trị kỹ thuật thêm nhóm hồ sơ, loại giấy tờ, trường dữ liệu; sửa, ngừng dùng, xóa; đề xuất và xác nhận thời hạn bảo quản.
 * Nhóm thử có mã cố định "E2EKT" (tạo lần đầu, các lần sau dùng lại) và luôn được ngừng dùng ở cuối nên không lọt vào lựa chọn của người dùng thật.
 * Loại giấy tờ thử được tạo rồi xóa trong từng lần chạy. Quy tắc bảo quản đã xác nhận của nhóm thử để lại (giữ khóa ngoại tới nhóm).
 */
const main = (page: Page) => page.locator("main");
const GROUP = "E2EKT";

test("Danh mục: thêm nhóm, loại giấy tờ và trường; sửa, ngừng dùng, xóa; đề xuất và xác nhận thời hạn bảo quản @integration", async ({ page }) => {
  const problems = watchConsole(page);
  const tag = `${Date.now()}`;
  const typeName = `E2E loại ${tag}`;

  // Dọn loại giấy tờ thử còn sót từ lần chạy hỏng trước (nếu có).
  sql(`DELETE FROM hoso.field_definitions WHERE document_type_code IN (SELECT code FROM hoso.document_types WHERE work_group_code = '${GROUP}' AND name LIKE 'E2E loại %')`);
  sql(`DELETE FROM hoso.document_types WHERE work_group_code = '${GROUP}' AND name LIKE 'E2E loại %'`);

  await signIn(page, "employee");
  await page.goto("/quan-tri/danh-muc");
  await expect(main(page).getByText(/Bạn chưa có quyền quản lý danh mục/)).toBeVisible();

  await signIn(page, "technical_admin");
  await page.goto("/quan-tri/danh-muc");
  await expect(page.getByRole("heading", { name: "Danh mục", exact: true, level: 1 })).toBeVisible();
  await expectAccessible(page);

  // Tìm nhóm không dấu ở cột trái.
  await main(page).getByLabel("Tìm nhóm hồ sơ").fill("dat dai va ho so dia chinh");
  await main(page).getByRole("button", { name: "Tìm", exact: true }).click();
  await expect(main(page).getByRole("link", { name: /U15/ })).toBeVisible();

  // Nhóm thử: tạo nếu chưa có (mã sai bị chặn ngay ở ô).
  if (sql(`SELECT 1 FROM hoso.work_groups WHERE code = '${GROUP}'`).length === 0) {
    await main(page).getByRole("button", { name: "Thêm nhóm hồ sơ" }).click();
    const dialog = page.getByRole("dialog", { name: "Thêm nhóm hồ sơ" });
    await dialog.getByLabel("Mã nhóm").fill("1 sai");
    await dialog.getByRole("button", { name: "Thêm nhóm" }).click();
    await expect(dialog.getByText(/Mã nhóm 2–10 ký tự/).first()).toBeVisible();
    await dialog.getByLabel("Mã nhóm").fill(GROUP);
    await dialog.getByLabel("Đơn vị phụ trách").selectOption({ index: 1 });
    await dialog.getByLabel("Tên nhóm hồ sơ").fill("E2E nhóm thử danh mục");
    await dialog.getByRole("button", { name: "Thêm nhóm" }).click();
    await expect(page).toHaveURL(new RegExp(`nhom=${GROUP}`), { timeout: 30_000 });
  } else {
    await page.goto(`/quan-tri/danh-muc?nhom=${GROUP}`);
  }
  await expect(main(page).getByRole("heading", { name: new RegExp(`^${GROUP} ·`) })).toBeVisible();
  // Dùng lại nếu lần trước đã ngừng dùng.
  if (await main(page).getByRole("button", { name: "Dùng lại", exact: true }).count()) {
    await main(page).getByRole("button", { name: "Dùng lại", exact: true }).click();
    await expect(page.getByText("Đã dùng lại nhóm.")).toBeVisible({ timeout: 30_000 });
  }

  // Sửa nhóm và xác nhận thông tin.
  await main(page).getByRole("button", { name: "Sửa nhóm" }).click();
  const edit = page.getByRole("dialog", { name: `Sửa nhóm ${GROUP}` });
  await edit.getByLabel("Tên nhóm hồ sơ").fill("");
  await edit.getByRole("button", { name: "Lưu" }).click();
  await expect(edit.getByText("Nhập tên nhóm hồ sơ.")).toBeVisible();
  await edit.getByLabel("Tên nhóm hồ sơ").fill("E2E nhóm thử danh mục");
  await edit.getByLabel("Trách nhiệm").fill(`Cập nhật ${tag}`);
  await edit.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã lưu nhóm.")).toBeVisible({ timeout: 30_000 });
  await expect(main(page).getByText(`Cập nhật ${tag}`)).toBeVisible();

  // Loại giấy tờ: tên trống và số lượng sai bị chặn; thêm loại, thêm trường (biểu thức sai bị chặn), sửa trường.
  await main(page).getByRole("button", { name: "Thêm loại giấy tờ" }).click();
  const type = page.getByRole("dialog", { name: new RegExp(`Thêm loại giấy tờ cho nhóm ${GROUP}`) });
  await type.getByRole("button", { name: "Thêm loại" }).click();
  await expect(type.getByText("Nhập tên loại giấy tờ.")).toBeVisible();
  await type.getByLabel("Tên loại giấy tờ").fill(typeName);
  await type.getByLabel("Số lượng tối thiểu").fill("101");
  await type.getByRole("button", { name: "Thêm loại" }).click();
  await expect(type.getByText("Số lượng tối thiểu từ 0 đến 100.")).toBeVisible();
  await type.getByLabel("Số lượng tối thiểu").fill("1");
  await type.getByLabel("Bắt buộc có trong hồ sơ").check();
  await type.getByRole("button", { name: "Thêm loại" }).click();
  await expect(page.getByText(`Đã thêm loại giấy tờ ${typeName}.`)).toBeVisible({ timeout: 30_000 });
  const row = main(page).getByRole("listitem").filter({ hasText: typeName }).first();
  await expect(row.getByText(/Bắt buộc có ≥ 1/)).toBeVisible();

  await row.getByText(/^Trường dữ liệu \(0\)$/).click();
  await row.getByRole("button", { name: `Thêm trường cho ${typeName}` }).click();
  const field = page.getByRole("dialog", { name: new RegExp(`Thêm trường cho ${typeName}`) });
  await field.getByLabel("Tên trường").fill("Số văn bản thử");
  await field.getByLabel(/^Biểu thức kiểm tra/).fill("(");
  await field.getByRole("button", { name: "Thêm trường" }).click();
  await expect(field.getByText("Biểu thức kiểm tra không hợp lệ.")).toBeVisible();
  await field.getByLabel(/^Biểu thức kiểm tra/).fill("^\\d+/\\d{4}$");
  await field.getByLabel("Trường quan trọng (hiện đầu danh sách đối chiếu)").check();
  await field.getByRole("button", { name: "Thêm trường" }).click();
  await expect(page.getByText("Đã thêm trường.")).toBeVisible({ timeout: 30_000 });
  await expect(row.getByText("Số văn bản thử")).toBeVisible();
  await expect(row.getByText("Quan trọng")).toBeVisible();
  await row.getByRole("button", { name: "Sửa trường Số văn bản thử" }).click();
  const editField = page.getByRole("dialog", { name: "Sửa trường Số văn bản thử" });
  await editField.getByLabel("Kiểu giá trị").selectOption("number");
  await editField.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã lưu trường.")).toBeVisible({ timeout: 30_000 });
  await expect(row.getByText("Số", { exact: true })).toBeVisible();
  await expectAccessible(page);

  // Thời hạn bảo quản: đề xuất chưa có hiệu lực; xác nhận cần căn cứ pháp lý ≥ 5 ký tự.
  await main(page).getByRole("button", { name: "Đề xuất thời hạn" }).click();
  const retention = page.getByRole("dialog", { name: new RegExp(`Đề xuất thời hạn bảo quản cho nhóm ${GROUP}`) });
  await retention.getByLabel("Thời hạn", { exact: true }).fill(`E2E ${tag} năm`);
  await retention.getByLabel(/^Số năm/).fill("201");
  await retention.getByRole("button", { name: "Đề xuất" }).click();
  await expect(retention.getByText(/Số năm từ 0 đến 200/)).toBeVisible();
  await retention.getByLabel(/^Số năm/).fill("10");
  await retention.getByRole("button", { name: "Đề xuất" }).click();
  await expect(page.getByText("Đã đề xuất thời hạn bảo quản.")).toBeVisible({ timeout: 30_000 });
  const rule = main(page).getByRole("listitem").filter({ hasText: `E2E ${tag} năm` });
  await expect(rule.getByText("Đề xuất", { exact: true })).toBeVisible();
  await rule.getByRole("button", { name: `Xác nhận thời hạn E2E ${tag} năm` }).click();
  const confirm = page.getByRole("dialog", { name: new RegExp("Xác nhận thời hạn") });
  await confirm.getByLabel(/^Căn cứ pháp lý/).fill("TT 1");
  await confirm.getByRole("button", { name: "Xác nhận" }).click();
  await expect(confirm.getByText(/Ghi căn cứ pháp lý từ 5 ký tự/)).toBeVisible();
  await confirm.getByLabel(/^Căn cứ pháp lý/).fill("Thông tư thử nghiệm E2E");
  await confirm.getByRole("button", { name: "Xác nhận" }).click();
  await expect(page.getByText(/Đã xác nhận thời hạn bảo quản/)).toBeVisible({ timeout: 30_000 });
  await expect(rule.getByText("Đã xác nhận")).toBeVisible();

  // Dọn: xóa trường, ngừng dùng loại thử rồi xóa (chỉ xóa được loại đã ngừng dùng và hết trường); cuối cùng ngừng dùng nhóm thử.
  await row.getByRole("button", { name: "Xóa trường Số văn bản thử" }).click();
  await row.getByRole("button", { name: "Xóa trường", exact: true }).click();
  await expect(page.getByText("Đã xóa trường.")).toBeVisible({ timeout: 30_000 });
  await row.getByRole("button", { name: `Ngừng dùng loại ${typeName}` }).click();
  await expect(page.getByText("Đã ngừng dùng loại giấy tờ.")).toBeVisible({ timeout: 30_000 });
  await expect(row.getByText("Đã ngừng dùng").first()).toBeVisible();
  await row.getByRole("button", { name: `Xóa loại ${typeName}` }).click();
  await row.getByRole("button", { name: "Xóa", exact: true }).click();
  await expect(page.getByText("Đã xóa loại giấy tờ.")).toBeVisible({ timeout: 30_000 });
  await expect(main(page).getByText(typeName)).toHaveCount(0);

  // Nhóm thử đã được xác nhận ở lần chạy trước thì nút này không còn (không có thao tác đưa về "đề xuất").
  if (await main(page).getByRole("button", { name: "Xác nhận thông tin" }).count()) {
    await main(page).getByRole("button", { name: "Xác nhận thông tin" }).click();
    await expect(page.getByText("Đã xác nhận thông tin nhóm.")).toBeVisible({ timeout: 30_000 });
  }
  await expect(main(page).getByText("Đã xác nhận", { exact: true }).first()).toBeVisible();
  await main(page).getByRole("button", { name: "Ngừng dùng", exact: true }).first().click();
  await expect(page.getByText(/Đã ngừng dùng nhóm/)).toBeVisible({ timeout: 30_000 });
  await expect(main(page).getByText("Đã ngừng dùng").first()).toBeVisible();

  expect(problems, "không có lỗi console/CSP").toEqual([]);
});
