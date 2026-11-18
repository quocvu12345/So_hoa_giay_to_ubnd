import type { Page } from "@playwright/test";
import { expect, expectAccessible, samplePdf, signIn, sql, test, watchConsole } from "./fixtures";

/**
 * FE-37 với API thật (scripts/dev-up.sh start): gom hồ sơ chờ nộp lưu thành đợt, nộp, tiếp nhận (một hồ sơ lỗi thì cả đợt không đổi), trả lại kèm lý do,
 * tiếp nhận thành công kèm biên bản PDF, xóa đợt đang soạn. Hồ sơ thử dựng bằng SQL ở bước chờ nộp lưu: một hồ sơ có giấy tờ đã đối chiếu (tiếp nhận được),
 * một hồ sơ trống (API từ chối tiếp nhận vì thiếu giấy tờ). Mã hồ sơ thử bắt đầu "E2E-NL".
 */
const main = (page: Page) => page.locator("main");

async function readyDossier(page: Page, code: string, withDocument: boolean) {
  const [dossier] = sql(`
    INSERT INTO hoso.dossiers(code, origin, title, year, organization_code, department_code, work_group_code, status, created_by)
    SELECT '${code}', 'internal', 'E2E nộp lưu ${code}', 2026, 'tl-ubnd', 'ht', 'U15', 'ready_archive', (SELECT id FROM hoso.users WHERE username = 'dev_admin')
    RETURNING id`);
  if (withDocument) {
    const me = (await (await page.request.get("/api/v1/me")).json()) as { activeAssignment: { id: string } };
    const upload = await page.request.post("/api/v1/intake/files", { headers: { "X-CSRF": "1", "X-Assignment-Id": me.activeAssignment.id }, multipart: { file: samplePdf("filled-u15-d07", code) } });
    expect(upload.status()).toBe(201);
    const { documentId } = (await upload.json()) as { documentId: string };
    sql(`UPDATE hoso.documents SET intake_status = 'filed', data_review_status = 'verified', reviewed_by = (SELECT id FROM hoso.users WHERE username = 'dev_admin'), reviewed_at = now() WHERE id = '${documentId}'`);
    sql(`INSERT INTO hoso.dossier_documents(dossier_id, document_id, position) VALUES ('${dossier}', '${documentId}', 1)`);
  }
  return dossier;
}

const statusOf = (id: string) => sql(`SELECT status FROM hoso.dossiers WHERE id = '${id}'`)[0];

async function createSubmission(page: Page, codes: string[], note: string): Promise<string> {
  await page.goto("/nop-luu");
  for (const code of codes) await main(page).getByRole("checkbox", { name: `Chọn hồ sơ ${code}` }).check();
  await main(page).getByLabel(/^Ghi chú của đợt/).fill(note);
  await main(page).getByRole("button", { name: /^Tạo đợt nộp lưu/ }).click();
  await expect(page).toHaveURL(/\/nop-luu\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await expect(main(page).getByText("Đang soạn").first()).toBeVisible();
  return page.url();
}

test("Nộp lưu: gom đợt, tiếp nhận lỗi thì cả đợt không đổi, trả lại kèm lý do, tiếp nhận thành công có biên bản, xóa đợt đang soạn @integration", async ({ page }) => {
  const problems = watchConsole(page);
  const tag = `${Date.now()}`;
  const good = `E2E-NL-${tag}-A`;
  const empty = `E2E-NL-${tag}-B`;

  await signIn(page, "employee");
  await page.goto("/nop-luu");
  await expect(main(page).getByText(/Bạn chưa có quyền nộp lưu hồ sơ/)).toBeVisible();      // chuyên viên không có quyền nộp lưu

  await signIn(page, "clerk");
  const goodId = await readyDossier(page, good, true);
  const emptyId = await readyDossier(page, empty, false);

  // Gom cả hai hồ sơ vào một đợt, nộp, tiếp nhận: hồ sơ trống làm cả đợt không đổi.
  await page.goto("/nop-luu");
  await expect(main(page).getByRole("heading", { name: /^Hồ sơ chờ nộp lưu \(\d+\)$/ })).toBeVisible();
  await expectAccessible(page);
  const batch1 = await createSubmission(page, [good, empty], `E2E đợt ${tag}`);
  await expect(main(page).getByRole("list", { name: "Hồ sơ trong đợt" }).getByRole("link", { name: good, exact: true })).toBeVisible();
  await main(page).getByRole("button", { name: "Nộp đợt" }).click();
  await expect(page.getByText("Đã nộp đợt.")).toBeVisible({ timeout: 30_000 });
  await expect(main(page).getByText("Đã nộp, chờ tiếp nhận").first()).toBeVisible();

  await main(page).getByRole("button", { name: "Tiếp nhận cả đợt" }).click();
  await main(page).getByRole("button", { name: "Tiếp nhận", exact: true }).click();
  const issues = main(page).getByRole("list", { name: "Hồ sơ có vấn đề" });
  await expect(issues.getByText(empty, { exact: true })).toBeVisible({ timeout: 30_000 });
  expect(statusOf(goodId)).toBe("ready_archive");       // một hồ sơ lỗi: hồ sơ tốt cũng KHÔNG đổi trạng thái
  expect(statusOf(emptyId)).toBe("ready_archive");

  // Trả lại: lý do ngắn bị chặn; đủ lý do kèm lỗi hồ sơ trống thì trả được, hồ sơ được giải phóng.
  await main(page).getByRole("button", { name: "Trả lại đợt" }).click();
  const giveBack = page.getByRole("dialog", { name: "Trả lại đợt" });
  await giveBack.getByLabel(/^Lý do trả lại/).fill("ngắn");
  await giveBack.getByRole("button", { name: "Trả lại đợt" }).click();
  await expect(giveBack.getByText(/ít nhất 10 ký tự/)).toBeVisible();
  await giveBack.getByLabel(/^Lý do trả lại/).fill("Hồ sơ trống chưa có giấy tờ nào");
  await giveBack.getByLabel(new RegExp(empty)).fill("Chưa có giấy tờ");
  await giveBack.getByRole("button", { name: "Trả lại đợt" }).click();
  await expect(page.getByText("Đã trả lại đợt kèm lý do.")).toBeVisible({ timeout: 30_000 });
  await expect(main(page).getByText(/Đã trả lại:/)).toBeVisible();
  await expect(main(page).getByText("Chưa có giấy tờ", { exact: true })).toBeVisible();
  await page.goto("/nop-luu?trang-thai=da-tra-lai");
  await expect(main(page).locator(`a[href$="/${batch1.split("/").pop()}"]`)).toBeVisible();

  // Đợt mới chỉ có hồ sơ tốt: nộp và tiếp nhận thành công, có biên bản PDF.
  const batch2 = await createSubmission(page, [good], `E2E đợt tốt ${tag}`);
  await main(page).getByRole("button", { name: "Nộp đợt" }).click();
  await expect(page.getByText("Đã nộp đợt.")).toBeVisible({ timeout: 30_000 });
  await main(page).getByRole("button", { name: "Tiếp nhận cả đợt" }).click();
  await main(page).getByRole("button", { name: "Tiếp nhận", exact: true }).click();
  await expect(page.getByText(/Đã tiếp nhận cả đợt/)).toBeVisible({ timeout: 60_000 });
  const minutes = main(page).getByRole("link", { name: /Tải biên bản/ });
  await expect(minutes).toBeVisible({ timeout: 30_000 });
  const pdf = await page.request.get((await minutes.getAttribute("href"))!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect(statusOf(goodId)).toBe("archived");
  expect(batch2).not.toBe(batch1);

  // Xóa đợt đang soạn: hồ sơ trống được gom lại rồi xóa đợt thì trở về danh sách chờ.
  const batch3 = await createSubmission(page, [empty], `E2E đợt xóa ${tag}`);
  await main(page).getByRole("button", { name: "Xóa đợt" }).click();
  await main(page).getByRole("button", { name: "Xóa đợt", exact: true }).last().click();
  await expect(page).toHaveURL(/\/nop-luu$/, { timeout: 30_000 });
  await expect(main(page).getByRole("checkbox", { name: `Chọn hồ sơ ${empty}` })).toBeVisible();
  expect(batch3).toContain("/nop-luu/");

  expect(problems, "không có lỗi console/CSP").toEqual([]);
});
