import type { Page } from "@playwright/test";
import { expect, expectAccessible, signIn, sql, test, watchConsole } from "./fixtures";

/**
 * FE-36 (mượn trả) với API thật (scripts/dev-up.sh start): đề nghị mượn, duyệt (hạn trả không quá 90 ngày), giao, nhận trả kèm tình trạng; từ chối cần lý do;
 * hồ sơ đã có khoản mượn hiệu lực thì không đề nghị thêm; chuyên viên (chỉ có quyền đề nghị) không thấy nút duyệt. Hồ sơ thử dựng bằng SQL, mã bắt đầu "E2E-MUON".
 */
const main = (page: Page) => page.locator("main");
const inDays = (days: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + days * 86_400_000));

function makeDossier(code: string) {
  sql(`INSERT INTO hoso.dossiers(code, origin, title, year, organization_code, department_code, work_group_code, status, archived_at, created_by)
       SELECT '${code}', 'internal', 'E2E mượn ${code}', 2026, 'tl-ubnd', 'ht', 'U15', 'archived', now(), (SELECT id FROM hoso.users WHERE username = 'dev_admin')`);
}

async function request(page: Page, code: string, purpose: string) {
  await main(page).getByRole("button", { name: "Đề nghị mượn" }).click();
  const dialog = page.getByRole("dialog", { name: "Đề nghị mượn bản giấy" });
  await dialog.getByLabel("Hồ sơ cần mượn").fill(code);
  await dialog.getByRole("list", { name: "Kết quả tìm hồ sơ" }).getByRole("button").first().click({ timeout: 30_000 });
  await dialog.getByLabel("Mục đích mượn").fill(purpose);
  await dialog.getByRole("button", { name: "Gửi đề nghị" }).click();
  return dialog;
}

test("Mượn trả: đề nghị, duyệt, giao, nhận trả; từ chối cần lý do; một hồ sơ một khoản mượn; chuyên viên không duyệt @integration", async ({ page }) => {
  const problems = watchConsole(page);
  const tag = `${Date.now()}`;
  const a = `E2E-MUON-${tag}-A`;
  const b = `E2E-MUON-${tag}-B`;
  makeDossier(a);
  makeDossier(b);

  await signIn(page, "clerk");
  await page.goto("/muon-tra");
  await expect(page.getByRole("heading", { name: "Mượn trả", exact: true, level: 1 })).toBeVisible();
  await expectAccessible(page);

  // Đề nghị mượn A: mục đích ngắn bị chặn, chưa chọn hồ sơ cũng chặn.
  await main(page).getByRole("button", { name: "Đề nghị mượn" }).click();
  const empty = page.getByRole("dialog", { name: "Đề nghị mượn bản giấy" });
  await empty.getByRole("button", { name: "Gửi đề nghị" }).click();
  await expect(empty.getByText("Chọn hồ sơ cần mượn.")).toBeVisible();
  await expect(empty.getByText(/Nêu mục đích mượn/)).toBeVisible();
  await empty.getByRole("button", { name: "Hủy" }).click();
  await request(page, a, "Đối chiếu bản gốc");
  await expect(page.getByText(`Đã đề nghị mượn hồ sơ ${a}.`)).toBeVisible({ timeout: 30_000 });
  const rowA = main(page).getByRole("listitem").filter({ hasText: a });
  await expect(rowA.getByText("Chờ duyệt")).toBeVisible();

  // Chuyên viên (chỉ có quyền đề nghị) thấy khoản của mình nhưng không có nút duyệt.
  await signIn(page, "employee");
  await page.goto("/muon-tra");
  const mine = main(page).getByRole("listitem").filter({ hasText: a });
  await expect(mine).toBeVisible();
  await expect(mine.getByRole("button", { name: /^Duyệt/ })).toHaveCount(0);

  // Văn thư duyệt: hạn quá 90 ngày bị chặn; hạn hợp lệ thì duyệt rồi giao.
  await signIn(page, "clerk");
  await page.goto("/muon-tra");
  await rowA.getByRole("button", { name: `Duyệt mượn hồ sơ ${a}` }).click();
  const approve = page.getByRole("dialog", { name: `Duyệt mượn hồ sơ ${a}` });
  await approve.getByLabel(/^Hạn trả/).evaluate((el, value) => { (el as HTMLInputElement).removeAttribute("max"); (el as HTMLInputElement).value = value; el.dispatchEvent(new Event("input", { bubbles: true })); }, inDays(120));
  await expect(approve.getByText(/Hạn trả tối đa 90 ngày/)).toBeVisible();
  await approve.getByLabel(/^Hạn trả/).fill(inDays(30));
  await approve.getByRole("button", { name: "Duyệt", exact: true }).click();
  await expect(page.getByText("Đã duyệt. Giao hồ sơ ở bước tiếp theo.")).toBeVisible({ timeout: 30_000 });
  await expect(rowA.getByText("Đã duyệt, chờ giao")).toBeVisible();

  // Hồ sơ đã có khoản mượn được duyệt: đề nghị thêm bị từ chối với lý do rõ.
  const dup = await request(page, a, "Mượn lần hai khi đang có khoản khác");
  await expect(dup.getByText(/đã có khoản mượn được duyệt/)).toBeVisible({ timeout: 30_000 });
  await dup.getByRole("button", { name: "Hủy" }).click();

  await rowA.getByRole("button", { name: `Giao hồ sơ ${a}` }).click();
  await expect(page.getByText(new RegExp(`Đã giao hồ sơ ${a}`))).toBeVisible({ timeout: 30_000 });
  await expect(rowA.getByText("Đang mượn")).toBeVisible();
  await rowA.getByRole("button", { name: `Nhận trả hồ sơ ${a}` }).click();
  const back = page.getByRole("dialog", { name: `Nhận trả hồ sơ ${a}` });
  await back.getByLabel(/^Tình trạng khi trả/).fill("Nguyên vẹn, đủ số trang");
  await back.getByRole("button", { name: "Nhận trả" }).click();
  await expect(page.getByText(`Đã nhận trả hồ sơ ${a}.`)).toBeVisible({ timeout: 30_000 });
  await page.goto("/muon-tra?trang-thai=da-tra");
  const returned = main(page).getByRole("listitem").filter({ hasText: a });
  await expect(returned.getByText("Đã trả", { exact: true })).toBeVisible();
  await expect(returned.getByText(/Nguyên vẹn, đủ số trang/)).toBeVisible();

  // Từ chối hồ sơ B: lý do ngắn bị chặn.
  await page.goto("/muon-tra");
  await request(page, b, "Cần xem lại bản giấy");
  await expect(page.getByText(`Đã đề nghị mượn hồ sơ ${b}.`)).toBeVisible({ timeout: 30_000 });
  const rowB = main(page).getByRole("listitem").filter({ hasText: b });
  await rowB.getByRole("button", { name: `Từ chối mượn hồ sơ ${b}` }).click();
  const reject = page.getByRole("dialog", { name: `Từ chối mượn hồ sơ ${b}` });
  await reject.getByLabel(/^Lý do từ chối/).fill("no");
  await reject.getByRole("button", { name: "Từ chối" }).click();
  await expect(reject.getByText(/ít nhất 5 ký tự/)).toBeVisible();
  await reject.getByLabel(/^Lý do từ chối/).fill("Hồ sơ đang được kiểm kê");
  await reject.getByRole("button", { name: "Từ chối" }).click();
  await expect(page.getByText("Đã từ chối đề nghị mượn.")).toBeVisible({ timeout: 30_000 });
  await page.goto("/muon-tra?trang-thai=tu-choi");
  await expect(main(page).getByRole("listitem").filter({ hasText: b }).getByText("Bị từ chối")).toBeVisible();

  expect(problems, "không có lỗi console/CSP").toEqual([]);
});
