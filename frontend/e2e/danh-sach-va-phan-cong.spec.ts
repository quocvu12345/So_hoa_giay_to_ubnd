import { expect, expectAccessible, signIn, test, watchConsole } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * FE-26 (bộ lọc, sắp xếp theo cột, xuất CSV) và FE-31 (giao người chủ trì, hạn nội bộ) với API thật (scripts/dev-up.sh start).
 * Dữ liệu thử nằm lại trong hoso_dev (tên bắt đầu bằng "E2E").
 */

/** Chuyên viên Phòng Hạ tầng tạo hồ sơ bằng form thật; trả địa chỉ hồ sơ. */
async function createDossier(page: Page, title: string): Promise<string> {
  await signIn(page, "employee");
  await page.goto("/ho-so/tao-moi");
  await page.getByLabel(/Tên hồ sơ/).fill(title);
  await page.getByLabel(/Nhóm hồ sơ/).selectOption({ index: 1 });
  await page.getByRole("button", { name: /^Tạo hồ sơ$/ }).click();
  await expect(page).toHaveURL(/\/ho-so\/[0-9a-f-]{36}\/giay-to$/, { timeout: 30_000 });
  return page.url().replace(/\/giay-to$/, "");
}

test("Danh sách hồ sơ: lọc theo năm và quá hạn, sắp xếp theo cột, xuất CSV theo bộ lọc @integration", async ({ page }) => {
  const problems = watchConsole(page);
  const tag = `${Date.now()}`;
  const title = `E2E danh sách ${tag}`;
  await createDossier(page, title);

  // Trưởng phòng Hạ tầng: có quyền xuất dữ liệu.
  await signIn(page, "manager", "ht");
  const year = new Date().getFullYear();
  await page.goto(`/ho-so?q=${tag}`);
  await expect(page.getByRole("link", { name: new RegExp(title) }).first()).toBeVisible();
  await expectAccessible(page);

  // Năm: đúng năm thấy, năm khác thì không.
  await page.goto(`/ho-so?q=${tag}&nam=${year}`);
  await expect(page.getByRole("link", { name: new RegExp(title) }).first()).toBeVisible();
  await expect(page.getByLabel("Năm")).toHaveValue(String(year));
  await page.goto(`/ho-so?q=${tag}&nam=${year - 3}`);
  await expect(page.getByText("Không có hồ sơ khớp bộ lọc")).toBeVisible();

  // Quá hạn: hồ sơ mới chưa có hạn nên không nằm trong danh sách quá hạn.
  await page.goto(`/ho-so?q=${tag}&qua-han=1`);
  await expect(page.getByText("Không có hồ sơ khớp bộ lọc")).toBeVisible();
  await expect(page.getByLabel("Chỉ hồ sơ quá hạn")).toBeChecked();

  // Sắp xếp: bấm tiêu đề cột đổi URL và aria-sort; bấm lần nữa đảo chiều. Cột theo dõi nằm ở bảng (màn rộng).
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/ho-so?q=E2E`);
  await page.getByRole("link", { name: "Sắp xếp theo mã" }).click();
  await expect(page).toHaveURL(/sap-xep=ma/);
  await expect(page.locator("th[aria-sort='ascending']")).toHaveCount(1);
  await page.getByRole("link", { name: "Sắp xếp theo mã" }).click();
  await expect(page).toHaveURL(/chieu=giam/);
  await expect(page.locator("th[aria-sort='descending']")).toHaveCount(1);
  await expectAccessible(page);

  // Xuất CSV: đường dẫn mang đúng bộ lọc; tải bằng một GET chỉ có cookie (phân công lấy từ cookie, BE-118), BOM + đúng hồ sơ.
  await page.goto(`/ho-so?q=${tag}&nam=${year}&sap-xep=ma`);
  const href = await page.getByRole("link", { name: "Xuất danh sách" }).getAttribute("href");
  expect(href).toContain("/api/v1/dossiers/export.csv");
  expect(href).toContain(`Year=${year}`);
  expect(href).toContain("Sort=code");
  const csv = await page.request.get(href!);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const body = await csv.body();
  expect([...body.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const text = body.toString("utf8");
  expect(text).toContain(title);
  expect(text.split("\r\n")[0]).toContain("Mã hồ sơ,Tên hồ sơ");

  // Chuyên viên không có quyền xuất: nút khóa kèm lý do.
  await signIn(page, "employee");
  await page.goto(`/ho-so?q=${tag}`);
  await expect(page.getByRole("button", { name: "Xuất danh sách" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Xuất danh sách" })).toHaveCount(0);

  expect(problems, "không có lỗi console/CSP").toEqual([]);
});

test("Phân công: trưởng phòng xem chuyên viên kèm tải việc, kiểm tra hạn trước khi gửi, lưu hạn nội bộ @integration", async ({ page }) => {
  const problems = watchConsole(page);
  const tag = `${Date.now()}`;
  const dossierUrl = await createDossier(page, `E2E phân công ${tag}`);

  await signIn(page, "manager", "ht");
  await page.goto(`${dossierUrl}/phan-cong`);
  await expect(page.getByRole("heading", { name: "Giao việc" })).toBeVisible();
  await expectAccessible(page);

  // Danh sách chuyên viên của phòng: người đang chủ trì có nhãn và tải việc; gõ tên để lọc.
  const list = page.getByRole("list", { name: "Chuyên viên của phòng" });
  await expect(list.getByText("Đang chủ trì")).toBeVisible();
  await expect(list.getByText(/Đang giữ \d+ hồ sơ/).first()).toBeVisible();
  await page.getByPlaceholder(/Tìm theo tên/).fill("khong-ai-ten-nhu-vay");
  await expect(list.getByText(/Không có ai tên khớp/)).toBeVisible();
  await page.getByPlaceholder(/Tìm theo tên/).fill("");
  await expect(list.getByRole("radio").first()).toBeVisible();

  // Chưa đổi gì thì chưa lưu được; hạn trước hôm nay bị chặn ngay ở giao diện, không gửi lên API.
  const save = page.getByRole("button", { name: "Lưu hạn nội bộ" });
  await expect(save).toBeDisabled();
  const due = page.getByLabel("Hạn nội bộ", { exact: true });
  await due.fill("2020-01-01");
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText("Hạn nội bộ không được trước hôm nay.")).toBeVisible();

  // Hạn hợp lệ (7 ngày tới) thì lưu được và đầu trang hiện hạn mới.
  const next = new Date(Date.now() + 7 * 86_400_000);
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(next);
  await due.fill(iso);
  await save.click();
  await expect(page.getByText("Đã cập nhật hạn nội bộ.")).toBeVisible({ timeout: 30_000 });
  const [y, m, d] = iso.split("-");
  await expect(page.locator("header").getByText(`Hạn nội bộ ${d}/${m}/${y}`)).toBeVisible({ timeout: 30_000 });

  // Chuyên viên không có quyền giao: không có tab Phân công.
  await signIn(page, "employee");
  await page.goto(dossierUrl);
  await expect(page.getByRole("link", { name: "Phân công" })).toHaveCount(0);

  expect(problems, "không có lỗi console/CSP").toEqual([]);
});
