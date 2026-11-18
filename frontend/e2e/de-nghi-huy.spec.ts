import type { Page } from "@playwright/test";
import { ensureDevUser, expect, expectAccessible, samplePdf, signIn, sql, test, watchConsole } from "./fixtures";

/**
 * FE-39 với API thật (scripts/dev-up.sh start): văn thư đề nghị hủy hồ sơ hết thời hạn bảo quản, người khác (Chủ tịch thử) phê duyệt kèm văn bản quyết định hoặc từ chối,
 * văn thư thực hiện hủy bằng xác nhận hai bước, nội dung tệp bị xóa. Dựng bằng SQL: một quy tắc bảo quản ĐÃ XÁC NHẬN 5 năm cho nhóm U15 (tên "E2E 5 năm", để lại
 * trong CSDL dev; chỉ có hiệu lực với hồ sơ lưu trữ cách đây ≥ 5 năm) và hai hồ sơ đã lưu trữ cách đây 6 năm. Tài khoản thứ hai `e2e.chair`.
 */
const main = (page: Page) => page.locator("main");

test("Đề nghị hủy: đề nghị, người khác phê duyệt hoặc từ chối, thực hiện hủy xóa nội dung tệp @integration", async ({ page }) => {
  const problems = watchConsole(page);
  const tag = `${Date.now()}`;
  const withFile = `E2E-HUY-${tag}-A`;
  const plain = `E2E-HUY-${tag}-B`;
  ensureDevUser("e2e.chair", "E2E Chủ tịch thử", "chair", "tl-ubnd");
  sql(`INSERT INTO hoso.retention_rules(work_group_code, retention_label, retention_years, legal_reference, status, confirmed_by, confirmed_at)
       SELECT 'U15', 'E2E 5 năm', 5, 'Thông tư thử nghiệm E2E', 'confirmed', (SELECT id FROM hoso.users WHERE username = 'dev_admin'), now()
       WHERE NOT EXISTS (SELECT 1 FROM hoso.retention_rules WHERE work_group_code = 'U15' AND retention_label = 'E2E 5 năm')`);
  const [decision] = sql(`SELECT title FROM hoso.documents WHERE origin = 'public_source' AND length(title) > 12 ORDER BY created_at LIMIT 1`);

  await signIn(page, "employee");
  await page.goto("/de-nghi-huy");
  await expect(main(page).getByText(/Bạn chưa có quyền xem đề nghị hủy/)).toBeVisible();      // chuyên viên không có quyền

  // Dựng hai hồ sơ đã lưu trữ cách đây 6 năm; hồ sơ A có một giấy tờ nội bộ chỉ thuộc hồ sơ này (sẽ bị xóa nội dung).
  await signIn(page, "clerk");
  const make = (code: string) => sql(`INSERT INTO hoso.dossiers(code, origin, title, year, organization_code, department_code, work_group_code, status, archived_at, created_by)
    SELECT '${code}', 'internal', 'E2E hủy ${code}', 2020, 'tl-ubnd', 'ht', 'U15', 'archived', now() - interval '6 years', (SELECT id FROM hoso.users WHERE username = 'dev_admin') RETURNING id`)[0];
  const aId = make(withFile);
  make(plain);
  const me = (await (await page.request.get("/api/v1/me")).json()) as { activeAssignment: { id: string } };
  const upload = await page.request.post("/api/v1/intake/files", { headers: { "X-CSRF": "1", "X-Assignment-Id": me.activeAssignment.id }, multipart: { file: samplePdf("filled-u15-d07", withFile) } });
  expect(upload.status()).toBe(201);
  const { documentId } = (await upload.json()) as { documentId: string };
  sql(`UPDATE hoso.documents SET intake_status = 'filed' WHERE id = '${documentId}'`);
  sql(`INSERT INTO hoso.dossier_documents(dossier_id, document_id, position) VALUES ('${aId}', '${documentId}', 1)`);

  // Văn thư đề nghị hủy cả hai: lý do ngắn bị chặn tại ô.
  await page.goto("/de-nghi-huy");
  await expect(main(page).getByRole("heading", { name: /^Hồ sơ đủ điều kiện hủy \(\d+\)$/ })).toBeVisible();
  await expectAccessible(page);
  for (const code of [withFile, plain]) {
    await main(page).getByRole("button", { name: `Đề nghị hủy hồ sơ ${code}` }).click();
    const dialog = page.getByRole("dialog", { name: `Đề nghị hủy hồ sơ ${code}` });
    await dialog.getByLabel(/^Lý do đề nghị hủy/).fill("ngắn");
    await dialog.getByRole("button", { name: "Gửi đề nghị" }).click();
    await expect(dialog.getByText(/Ghi lý do từ 10 ký tự/)).toBeVisible();
    await dialog.getByLabel(/^Lý do đề nghị hủy/).fill("Hồ sơ đã hết thời hạn bảo quản 5 năm theo quy định");
    await dialog.getByRole("button", { name: "Gửi đề nghị" }).click();
    await expect(page.getByText(`Đã đề nghị hủy hồ sơ ${code}.`)).toBeVisible({ timeout: 30_000 });
  }
  await expect(main(page).getByRole("button", { name: `Đề nghị hủy hồ sơ ${withFile}` })).toHaveCount(0);     // đã có đề nghị nên không còn ở danh sách đủ điều kiện

  // Người đề nghị không tự phê duyệt: nút ẩn, có giải thích. (dev_admin cũng có phân công Chủ tịch)
  await signIn(page, "chair");
  await page.goto("/de-nghi-huy");
  const own = main(page).getByRole("listitem").filter({ hasText: withFile });
  await expect(own.getByText(/không tự phê duyệt được/)).toBeVisible();
  await expect(own.getByRole("button", { name: /^Phê duyệt/ })).toHaveCount(0);

  // Người khác (Chủ tịch thử): từ chối hồ sơ B, phê duyệt hồ sơ A kèm văn bản quyết định.
  await signIn(page, "chair", undefined, "e2e.chair");
  await page.goto("/de-nghi-huy");
  const rowB = main(page).getByRole("listitem").filter({ hasText: plain });
  await rowB.getByRole("button", { name: /^Từ chối đề nghị hủy/ }).click();
  const reject = page.getByRole("dialog", { name: new RegExp(`Từ chối hủy hồ sơ ${plain}`) });
  await reject.getByLabel(/^Lý do từ chối/).fill("ngắn");
  await reject.getByRole("button", { name: "Từ chối đề nghị" }).click();
  await expect(reject.getByText(/Ghi lý do từ 10 ký tự/)).toBeVisible();
  await reject.getByLabel(/^Lý do từ chối/).fill("Hồ sơ còn cần giữ thêm để đối chiếu thanh tra");
  await reject.getByRole("button", { name: "Từ chối đề nghị" }).click();
  await expect(page.getByText("Đã từ chối đề nghị hủy.")).toBeVisible({ timeout: 30_000 });

  const rowA = main(page).getByRole("listitem").filter({ hasText: withFile });
  await rowA.getByRole("button", { name: /^Phê duyệt đề nghị hủy/ }).click();
  const approve = page.getByRole("dialog", { name: new RegExp(`Phê duyệt hủy hồ sơ ${withFile}`) });
  await approve.getByRole("button", { name: "Phê duyệt" }).click();
  await expect(approve.getByText("Chọn văn bản quyết định hủy.")).toBeVisible();      // chưa chọn văn bản thì không duyệt
  await approve.getByLabel("Văn bản quyết định hủy").fill(decision.slice(0, 14));
  await approve.getByRole("list", { name: "Kết quả tìm văn bản" }).getByRole("button").first().click({ timeout: 30_000 });
  await approve.getByRole("button", { name: "Phê duyệt" }).click();
  await expect(page.getByText(/Đã phê duyệt kèm văn bản quyết định/)).toBeVisible({ timeout: 30_000 });

  // Văn thư thực hiện hủy: xác nhận hai bước; nội dung tệp của hồ sơ A bị xóa, thông tin giữ lại.
  await signIn(page, "clerk");
  await page.goto("/de-nghi-huy?trang-thai=da-duyet");
  const toExecute = main(page).getByRole("listitem").filter({ hasText: withFile });
  await expect(toExecute.getByText("Đã phê duyệt, chờ thực hiện")).toBeVisible();
  await toExecute.getByRole("button", { name: `Thực hiện hủy hồ sơ ${withFile}` }).click();
  await expect(toExecute.getByText(/xóa vĩnh viễn nội dung/i)).toBeVisible();
  await toExecute.getByRole("button", { name: "Xác nhận hủy vĩnh viễn" }).click();
  await expect(page.getByText(/Đã hủy nội dung 1 tệp/)).toBeVisible({ timeout: 60_000 });
  expect(sql(`SELECT count(*) FROM hoso.files WHERE document_id = '${documentId}' AND disposed_at IS NOT NULL AND storage_key IS NULL`)).toEqual(["1"]);
  expect(sql(`SELECT count(*) FROM hoso.documents WHERE id = '${documentId}'`)).toEqual(["1"]);     // thông tin giấy tờ còn

  await page.goto("/de-nghi-huy?trang-thai=da-huy");
  await expect(main(page).getByRole("listitem").filter({ hasText: withFile }).getByText("Đã hủy")).toBeVisible();
  await page.goto("/de-nghi-huy?trang-thai=tu-choi");
  await expect(main(page).getByRole("listitem").filter({ hasText: plain }).getByText("Bị từ chối")).toBeVisible();

  expect(problems, "không có lỗi console/CSP").toEqual([]);
});
