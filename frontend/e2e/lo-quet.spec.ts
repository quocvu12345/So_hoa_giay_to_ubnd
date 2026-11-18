import type { Page } from "@playwright/test";
import { expect, expectAccessible, FILE_INPUT, samplePdf, signIn, test, waitForHydration, watchConsole } from "./fixtures";

/**
 * FE-41 và BE-125/126 với API thật (scripts/dev-up.sh start): tạo lô, nạp PDF vào lô, ghi lỗi ảnh, đóng lô còn lỗi (phải ghi lý do chấp nhận bỏ qua),
 * thay bản quét tự đóng lỗi của bản cũ rồi đóng lô thẳng. Dữ liệu thử nằm lại trong hoso_dev (đơn vị giao bắt đầu bằng "E2E").
 */
const main = (page: Page) => page.locator("main");

/** Văn thư tạo lô qua hộp thoại, nạp một PDF vào lô, trả địa chỉ trang lô. */
async function newBatchWithFile(page: Page, tag: string, sample: string): Promise<{ url: string; fileName: string }> {
  await signIn(page, "clerk");
  await page.goto("/tiep-nhan/lo-quet");
  await expect(main(page).getByRole("heading", { name: "Lô quét", exact: true })).toBeVisible();
  await main(page).getByRole("button", { name: "Tạo lô quét" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo lô quét" });
  await dialog.getByLabel("Đơn vị hoặc người bàn giao").fill(`E2E Phòng Nội vụ ${tag}`);
  await dialog.getByLabel("Nhãn hộp").fill("Hộp E2E");
  // Số tờ sai thì báo ngay tại ô, không gửi lên API.
  await dialog.getByLabel("Số tờ dự kiến").fill("abc");
  await dialog.getByRole("button", { name: "Tạo lô" }).click();
  await expect(dialog.getByText(/Nhập số tờ từ 0 đến/)).toBeVisible();
  await dialog.getByLabel("Số tờ dự kiến").fill("5");
  await dialog.getByRole("button", { name: "Tạo lô" }).click();
  await expect(page).toHaveURL(/\/tiep-nhan\/lo-quet\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const url = page.url();
  await expect(main(page).getByRole("heading", { name: /^Lô LQ-/ })).toBeVisible();

  // Nạp PDF vào đúng lô này (liên kết "Nạp PDF vào lô" chọn sẵn lô).
  await main(page).getByRole("link", { name: "Nạp PDF vào lô" }).click();
  await expect(page).toHaveURL(/\/tiep-nhan\/tai-len\?lo=/);
  await waitForHydration(page, FILE_INPUT);
  const pdf = samplePdf(sample, tag);
  await page.locator(FILE_INPUT).setInputFiles([pdf]);
  await expect(page.getByText("Đã nạp 1/1 tệp")).toBeVisible({ timeout: 60_000 });
  await page.goto(url);
  await expect(main(page).getByRole("heading", { name: "Tệp trong lô (1)" })).toBeVisible();
  await expect(main(page).getByRole("link", { name: pdf.name })).toBeVisible();
  return { url, fileName: pdf.name };
}

async function recordIssue(page: Page, fileName: string) {
  await main(page).getByRole("button", { name: "Ghi lỗi" }).click();
  const dialog = page.getByRole("dialog", { name: "Ghi lỗi ảnh" });
  await dialog.getByLabel("Tệp").selectOption({ label: fileName });
  await dialog.getByLabel(/^Trang/).fill("1");
  await dialog.getByLabel("Mô tả").fill("Trang 1 bị mờ mép phải");
  await dialog.getByRole("button", { name: "Ghi lỗi" }).click();
  await expect(main(page).getByText("1 đang mở")).toBeVisible({ timeout: 30_000 });
}

test("Lô quét: còn lỗi ảnh thì cảnh báo, vẫn đóng được khi ghi lý do chấp nhận bỏ qua @integration", async ({ page }) => {
  const problems = watchConsole(page);
  const tag = `${Date.now()}`;
  const { url, fileName } = await newBatchWithFile(page, tag, "filled-u15-d07");
  await expectAccessible(page);
  await recordIssue(page, fileName);

  // Đóng lô: cảnh báo còn 1 lỗi; lý do ngắn bị chặn tại ô; lý do đủ thì đóng.
  await main(page).getByRole("button", { name: "Đóng lô" }).click();
  const dialog = page.getByRole("dialog", { name: "Đóng lô quét" });
  await expect(dialog.getByText(/Còn 1 lỗi ảnh chưa xử lý/)).toBeVisible();
  const confirm = dialog.getByRole("button", { name: /Chấp nhận bỏ qua 1 lỗi và đóng lô/ });
  await confirm.click();
  await expect(dialog.getByText(/Ghi lý do từ 10 ký tự/)).toBeVisible();
  await dialog.getByLabel(/Lý do chấp nhận bỏ qua/).fill("Bản gốc đã mờ sẵn, không quét tốt hơn được");
  await confirm.click();

  await expect(page.getByText(/Đã đóng lô; 1 lỗi ảnh được ghi là chấp nhận bỏ qua/)).toBeVisible({ timeout: 30_000 });
  await expect(main(page).getByText("Đã đóng").first()).toBeVisible();
  await expect(main(page).getByText("Chấp nhận bỏ qua").first()).toBeVisible();
  await expect(main(page).getByText(/Bản gốc đã mờ sẵn/)).toBeVisible();      // lý do được ghi vào lỗi
  await expect(main(page).getByRole("button", { name: "Ghi lỗi" })).toHaveCount(0);     // lô đã đóng: không ghi thêm lỗi
  await expect(main(page).getByRole("link", { name: "Nạp PDF vào lô" })).toHaveCount(0);

  // Lô đã đóng nằm ở bộ lọc "Đã đóng", không còn ở "Đang mở".
  const id = url.split("/").pop()!;
  await page.goto("/tiep-nhan/lo-quet?trang-thai=dong");
  await expect(main(page).locator(`a[href$="/${id}"]`)).toBeVisible();
  await page.goto("/tiep-nhan/lo-quet");
  await expect(main(page).locator(`a[href$="/${id}"]`)).toHaveCount(0);

  expect(problems, "không có lỗi console/CSP").toEqual([]);
});

test("Lô quét: thay bản quét đóng lỗi ảnh của bản cũ, rồi đóng lô thẳng không cần lý do @integration", async ({ page }) => {
  const problems = watchConsole(page);
  const tag = `${Date.now()}`;
  const { url, fileName } = await newBatchWithFile(page, tag, "filled-u02-d01");
  await recordIssue(page, fileName);

  // Thay bản quét từ chính dòng lỗi: lý do ngắn bị chặn; chọn tệp mới + lý do đủ thì thay.
  await main(page).getByRole("button", { name: `Thay bản quét của ${fileName}` }).click();
  const dialog = page.getByRole("dialog", { name: "Thay bản quét" });
  await dialog.getByLabel("Lý do thay (bắt buộc)").fill("ngắn");
  await dialog.getByRole("button", { name: "Thay bản quét" }).click();
  await expect(dialog.getByText(/Chọn tệp PDF bản quét mới/)).toBeVisible();
  await expect(dialog.getByText(/Ghi lý do thay bản quét từ 10 ký tự/)).toBeVisible();
  const replacement = samplePdf("filled-u02-d01", `${tag}-thay`);
  await dialog.getByLabel("Bản quét mới (PDF)").setInputFiles(replacement);
  await dialog.getByLabel("Lý do thay (bắt buộc)").fill("Quét lại trang 1 bị mờ ở 300 dpi");
  await dialog.getByRole("button", { name: "Thay bản quét" }).click();
  await expect(page.getByText(/Đã thay bằng bản quét phiên bản 2\. Bản cũ vẫn được giữ lại/)).toBeVisible({ timeout: 60_000 });

  // Lỗi của bản cũ đã đóng ("Đã sửa"); lô vẫn đếm một tệp (bản mới thay chỗ bản cũ).
  await expect(main(page).getByText("Không còn lỗi mở")).toBeVisible({ timeout: 30_000 });
  await expect(main(page).getByText("Đã sửa").first()).toBeVisible();
  await expect(main(page).getByText(/Đã thay bằng bản quét phiên bản 2/)).toBeVisible();
  await expect(main(page).getByRole("heading", { name: "Tệp trong lô (1)" })).toBeVisible();
  await expect(main(page).getByRole("link", { name: replacement.name })).toBeVisible();

  // Hết lỗi mở: đóng lô thẳng, không có cảnh báo, không đòi lý do.
  await main(page).getByRole("button", { name: "Đóng lô" }).click();
  const close = page.getByRole("dialog", { name: "Đóng lô quét" });
  await expect(close.getByText(/Còn \d+ lỗi ảnh/)).toHaveCount(0);
  await close.getByRole("button", { name: "Đóng lô" }).click();
  await expect(page.getByText("Đã đóng lô quét.")).toBeVisible({ timeout: 30_000 });
  expect(page.url()).toBe(url);

  expect(problems, "không có lỗi console/CSP").toEqual([]);
});
