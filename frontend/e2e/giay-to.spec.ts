import { expect, expectAccessible, samplePdf, signIn, test, watchConsole } from "./fixtures";

/**
 * FE-33 với API thật (scripts/dev-up.sh start): thêm và gỡ liên kết văn bản (liên kết tạo vòng bị API từ chối), thay bản quét kèm lý do và xem lý do ở danh sách phiên bản.
 * Hai giấy tờ thử nằm trong hộp tiếp nhận của chuyên viên (tên tệp bắt đầu "e2e-").
 */
test("Chi tiết giấy tờ: thêm và gỡ liên kết văn bản, thay bản quét kèm lý do @integration", async ({ page }) => {
  const problems = watchConsole(page);
  const tag = `${Date.now()}`;
  const main = page.locator("main");
  await signIn(page, "employee");
  const me = (await (await page.request.get("/api/v1/me")).json()) as { activeAssignment: { id: string } };
  const upload = async (sample: string) => {
    const response = await page.request.post("/api/v1/intake/files", { headers: { "X-CSRF": "1", "X-Assignment-Id": me.activeAssignment.id }, multipart: { file: samplePdf(sample, tag) } });
    expect(response.status()).toBe(201);
    return (await response.json()) as { documentId: string; fileName: string };
  };
  const a = await upload("filled-u15-d07");
  const b = await upload("filled-u02-d01");
  const titleB = b.fileName.replace(/\.pdf$/, "");

  // Thêm liên kết A "Là phụ lục của" B: chưa chọn văn bản thì chặn; chọn xong thì thêm.
  await page.goto(`/giay-to/${a.documentId}`);
  await expectAccessible(page);
  await main.getByRole("button", { name: "Thêm liên kết" }).click();
  const dialog = page.getByRole("dialog", { name: "Thêm liên kết văn bản" });
  await dialog.getByRole("button", { name: "Thêm liên kết" }).click();
  await expect(dialog.getByText("Chọn văn bản cần liên kết.")).toBeVisible();
  await dialog.getByLabel("Văn bản này").selectOption("appendix_of");
  await dialog.getByLabel("Văn bản cần liên kết").fill(tag);
  await dialog.getByRole("list", { name: "Kết quả tìm văn bản" }).getByRole("button", { name: new RegExp(titleB) }).click({ timeout: 30_000 });
  await dialog.getByLabel(/^Ghi chú/).fill("E2E phụ lục");
  await dialog.getByRole("button", { name: "Thêm liên kết" }).click();
  await expect(page.getByText("Đã thêm liên kết.")).toBeVisible({ timeout: 30_000 });
  const relations = main.getByRole("list", { name: "Liên kết văn bản" });
  await expect(relations.getByText("Là phụ lục của:")).toBeVisible();
  await expect(relations.getByRole("link", { name: new RegExp(titleB) })).toBeVisible();
  await expect(relations.getByText("(E2E phụ lục)")).toBeVisible();

  // Ở văn bản B hiện chiều ngược lại, không có nút gỡ (liên kết do A khai); B liên kết ngược lại thành vòng thì API từ chối.
  await page.goto(`/giay-to/${b.documentId}`);
  await expect(main.getByRole("list", { name: "Liên kết văn bản" }).getByText("Có phụ lục:")).toBeVisible();
  await expect(main.getByRole("button", { name: /^Gỡ liên kết/ })).toHaveCount(0);
  await main.getByRole("button", { name: "Thêm liên kết" }).click();
  const cycle = page.getByRole("dialog", { name: "Thêm liên kết văn bản" });
  await cycle.getByLabel("Văn bản này").selectOption("appendix_of");
  await cycle.getByLabel("Văn bản cần liên kết").fill(tag);
  await cycle.getByRole("list", { name: "Kết quả tìm văn bản" }).getByRole("button", { name: new RegExp(a.fileName.replace(/\.pdf$/, "")) }).click({ timeout: 30_000 });
  await cycle.getByRole("button", { name: "Thêm liên kết" }).click();
  await expect(cycle.getByText(/tạo vòng/)).toBeVisible({ timeout: 30_000 });
  await cycle.getByRole("button", { name: "Hủy" }).click();

  // Gỡ liên kết ở A.
  await page.goto(`/giay-to/${a.documentId}`);
  await main.getByRole("button", { name: new RegExp(`^Gỡ liên kết Là phụ lục của ${titleB}`) }).click();
  await expect(page.getByText("Đã gỡ liên kết.")).toBeVisible({ timeout: 30_000 });
  await expect(main.getByText("Chưa có liên kết")).toBeVisible();

  // Thay bản quét: lý do hiện ở danh sách phiên bản kèm bản được thay.
  await main.getByRole("button", { name: /^Thay bản quét của/ }).click();
  const replace = page.getByRole("dialog", { name: "Thay bản quét" });
  await replace.getByLabel("Bản quét mới (PDF)").setInputFiles(samplePdf("filled-u15-d07", `${tag}-thay`));
  await replace.getByLabel("Lý do thay (bắt buộc)").fill("Quét lại vì bản đầu bị mờ góc");
  await replace.getByRole("button", { name: "Thay bản quét" }).click();
  await expect(page.getByText(/Đã thay bằng bản quét phiên bản 2/)).toBeVisible({ timeout: 60_000 });
  const versions = main.getByRole("heading", { name: "Phiên bản tệp" }).locator("xpath=ancestor::section[1]");
  await expect(versions.getByText(/Thay bản quét.*Quét lại vì bản đầu bị mờ góc/)).toBeVisible();
  await expect(versions.getByText("Hiện hành", { exact: true })).toHaveCount(1);

  expect(problems.filter((p) => !p.includes('"status":409') && !p.includes('\\"status\\":409')), "không có lỗi console/CSP").toEqual([]);
});
