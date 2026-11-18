import { expect, samplePdf, signIn, test, watchConsole } from "./fixtures";

/**
 * FE-21 (BE-42, BE-62): chọn nhiều PDF ở hộp tiếp nhận để bỏ cùng lúc (có hoàn tác) hoặc xếp vào cùng một hồ sơ.
 * Mọi kết luận đối chiếu với `GET /intake/inbox` và `GET /dossiers/{id}` của API. Dữ liệu thử có tên "E2E".
 */

type Inbox = { items: { documentId: string; fileName: string; stage: string }[] };

test("Hộp tiếp nhận: chọn nhiều PDF, bỏ cùng lúc rồi hoàn tác @integration", async ({ page }) => {
  const problems = watchConsole(page);
  const tag = `${Date.now()}`;
  await signIn(page, "employee");
  const me = (await (await page.request.get("/api/v1/me")).json()) as { assignments: { id: string; role: string }[] };
  const headers = { "x-assignment-id": me.assignments.find((a) => a.role === "employee")!.id, "x-csrf": "1" };
  const inbox = async (status: string) => ((await (await page.request.get(`/api/v1/intake/inbox?status=${status}&limit=200`, { headers })).json()) as Inbox).items;

  const ids: string[] = [];
  for (const sample of ["filled-u15-d07", "filled-u02-d01", "filled-u08-d01"]) {
    const response = await page.request.post("/api/v1/intake/files", { headers, multipart: { file: samplePdf(sample, tag) } });
    expect(response.status()).toBe(201);
    ids.push(((await response.json()) as { documentId: string }).documentId);
  }

  await page.goto("/tiep-nhan");
  const mine = (suffix: string) => page.getByRole("checkbox", { name: new RegExp(`^Chọn e2e-${suffix}-${tag}`) });
  await expect(mine("filled-u15-d07")).toBeVisible({ timeout: 30_000 });
  for (const suffix of ["filled-u15-d07", "filled-u02-d01", "filled-u08-d01"]) await mine(suffix).check();
  const bar = page.getByRole("region", { name: "Thao tác với PDF đã chọn" });
  await expect(bar).toContainText("Đã chọn 3 PDF");

  // Bỏ chọn một PDF thì số đếm giảm; chọn lại thì tăng.
  await mine("filled-u08-d01").uncheck();
  await expect(bar).toContainText("Đã chọn 2 PDF");
  await mine("filled-u08-d01").check();
  await expect(bar).toContainText("Đã chọn 3 PDF");

  // Bỏ khỏi hộp qua xác nhận hai bước tại chỗ.
  await bar.getByRole("button", { name: "Bỏ khỏi hộp" }).click();
  await expect(bar.getByRole("group", { name: "Bỏ 3 PDF khỏi hộp tiếp nhận?" })).toBeVisible();
  await bar.getByRole("button", { name: /^Bỏ$/ }).click();
  await expect(page.getByText(/Đã bỏ 3 PDF khỏi hộp tiếp nhận/)).toBeVisible({ timeout: 30_000 });
  await expect(bar).toHaveCount(0);
  expect((await inbox("discarded")).filter((i) => ids.includes(i.documentId)).length, "cả 3 PDF nằm ở thẻ Đã bỏ").toBe(3);
  expect((await inbox("inbox")).filter((i) => ids.includes(i.documentId)).length).toBe(0);

  // Hoàn tác: đưa cả 3 về hộp tiếp nhận.
  await page.getByRole("button", { name: "Hoàn tác" }).click();
  await expect(page.getByText(/Đã khôi phục 3 PDF vào hộp tiếp nhận/)).toBeVisible({ timeout: 30_000 });
  expect((await inbox("inbox")).filter((i) => ids.includes(i.documentId)).length, "cả 3 PDF về lại hộp tiếp nhận").toBe(3);

  expect(problems, "không có lỗi console hay CSP").toEqual([]);
});

test("Hộp tiếp nhận: chọn nhiều PDF đã đọc xong rồi xếp vào cùng một hồ sơ @integration", async ({ page }) => {
  const problems = watchConsole(page);
  await signIn(page, "employee");
  const me = (await (await page.request.get("/api/v1/me")).json()) as { assignments: { id: string; role: string }[] };
  const headers = { "x-assignment-id": me.assignments.find((a) => a.role === "employee")!.id, "x-csrf": "1" };

  const ready = ((await (await page.request.get("/api/v1/intake/inbox?read=ready&limit=2", { headers })).json()) as Inbox).items;
  test.skip(ready.length < 2, "Hộp tiếp nhận chưa có 2 PDF đã đọc xong (chạy scripts/smoke-ai-flow.py --keep)");
  const title = `E2E xếp nhiều PDF ${Date.now()}`;
  const created = await page.request.post("/api/v1/dossiers", { headers, data: { title, workGroupCode: "U15" } });
  expect(created.status()).toBe(201);
  const dossierId = ((await created.json()) as { id: string }).id;

  await page.goto("/tiep-nhan?doc=da-doc");
  for (const item of ready) await page.getByRole("checkbox", { name: `Chọn ${item.fileName}` }).check({ timeout: 30_000 });
  const bar = page.getByRole("region", { name: "Thao tác với PDF đã chọn" });
  await expect(bar).toContainText("Đã chọn 2 PDF");
  await bar.getByRole("button", { name: "Xếp 2 PDF vào một hồ sơ" }).click();

  const dialog = page.getByRole("dialog", { name: "Xếp 2 PDF vào một hồ sơ" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Tìm hồ sơ").fill(title);
  await dialog.getByRole("radio").first().check({ timeout: 30_000 });
  await dialog.getByRole("button", { name: "Xếp 2 PDF" }).click();
  await expect(page.getByText(/Đã xếp 2 PDF vào hồ sơ/)).toBeVisible({ timeout: 30_000 });

  const detail = (await (await page.request.get(`/api/v1/dossiers/${dossierId}`, { headers })).json()) as { documents: { documentId: string }[] };
  expect(detail.documents.map((d) => d.documentId).sort(), "hồ sơ chứa đúng 2 PDF đã chọn").toEqual(ready.map((r) => r.documentId).sort());
  expect(problems, "không có lỗi console hay CSP").toEqual([]);
});
