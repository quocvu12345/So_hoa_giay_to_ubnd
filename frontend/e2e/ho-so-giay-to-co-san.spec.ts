import { expect, signIn, test, watchConsole } from "./fixtures";

/**
 * FE-29 (BE-62, BE-80): thêm giấy tờ ĐÃ CÓ (không qua hộp tiếp nhận) vào hồ sơ: mở hộp thoại Thêm giấy tờ, tìm bằng tra cứu, chọn, thêm.
 * Kết luận đối chiếu với `GET /dossiers/{id}` của API. Giấy tờ dùng là văn bản công khai có sẵn trong CSDL dev.
 */
test("Hồ sơ: thêm giấy tờ đã có bằng tra cứu @integration", async ({ page }) => {
  const problems = watchConsole(page);
  await signIn(page, "employee");
  const me = (await (await page.request.get("/api/v1/me")).json()) as { assignments: { id: string; role: string }[] };
  const headers = { "x-assignment-id": me.assignments.find((a) => a.role === "employee")!.id, "x-csrf": "1" };

  // Một giấy tờ có sẵn mà chuyên viên tra cứu được (văn bản công khai của CSDL dev).
  const query = "quyết định";
  const found = (await (await page.request.get(`/api/v1/search?Q=${encodeURIComponent(query)}&Kind=documents&Limit=10`, { headers })).json()) as {
    hits: { kind: string; id: string; title: string }[];
  };
  const target = found.hits.find((h) => h.kind === "document");
  test.skip(!target, "CSDL dev chưa có giấy tờ nào khớp từ khóa để thử thêm giấy tờ có sẵn");

  const created = await page.request.post("/api/v1/dossiers", { headers, data: { title: `E2E giấy tờ có sẵn ${Date.now()}`, workGroupCode: "U15" } });
  expect(created.status()).toBe(201);
  const dossierId = ((await created.json()) as { id: string }).id;

  // Hồi quy: hộp thoại từng gọi Server Action ngay trong lúc render nên lặp hàng trăm lần mỗi giây (làm API trả 429 cho cả người dùng).
  let actionCalls = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes(`/ho-so/${dossierId}/giay-to`)) actionCalls++;
  });
  await page.goto(`/ho-so/${dossierId}/giay-to`);
  await page.getByRole("button", { name: /Thêm giấy tờ/ }).first().click();
  const dialog = page.getByRole("dialog", { name: "Thêm giấy tờ vào hồ sơ" });
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(3000);
  expect(actionCalls, "mở hộp thoại chỉ tải danh sách PDF một lần (tối đa 2 lần vì StrictMode ở chế độ dev)").toBeLessThanOrEqual(3);

  await dialog.getByLabel("Hoặc tìm giấy tờ đã có").fill(query);
  const results = dialog.getByRole("group", { name: "Giấy tờ đã có, chọn để thêm" });
  await expect(results).toBeVisible({ timeout: 30_000 });
  await results.getByRole("checkbox").first().check();
  await dialog.getByRole("button", { name: /^Thêm 1 giấy tờ$/ }).click();
  await expect(page.getByText(/Đã thêm 1 giấy tờ vào hồ sơ/)).toBeVisible({ timeout: 30_000 });

  const detail = (await (await page.request.get(`/api/v1/dossiers/${dossierId}`, { headers })).json()) as { documents: { documentId: string }[] };
  expect(detail.documents.length, "hồ sơ có đúng một giấy tờ vừa thêm").toBe(1);
  expect(problems, "không có lỗi console hay CSP").toEqual([]);
});
