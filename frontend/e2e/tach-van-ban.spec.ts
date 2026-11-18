import { expect, expectAccessible, multiPagePdf, signIn, sql, test, watchConsole } from "./fixtures";

/**
 * FE-25 với API thật (scripts/dev-up.sh start): nạp một PDF 4 trang tự dựng, đặt và gỡ điểm tách trên dải ảnh thu nhỏ (các phần luôn phủ kín, không chồng, không hở),
 * đặt tên một phần, xác nhận: văn bản nguồn chuyển "đã tách", sinh hai văn bản con trong hộp tiếp nhận. Dữ liệu thử tên bắt đầu "e2e-nhieu-trang".
 */
test("Tách văn bản: đặt và gỡ điểm tách, đặt tên phần, xác nhận sinh các văn bản con @integration", async ({ page }) => {
  const problems = watchConsole(page);
  const tag = `${Date.now()}`;
  const main = page.locator("main");
  await signIn(page, "employee");

  const me = (await (await page.request.get("/api/v1/me")).json()) as { activeAssignment: { id: string } };
  const upload = await page.request.post("/api/v1/intake/files", { headers: { "X-CSRF": "1", "X-Assignment-Id": me.activeAssignment.id }, multipart: { file: multiPagePdf(4, tag) } });
  expect(upload.status()).toBe(201);
  const { documentId } = (await upload.json()) as { documentId: string };

  await page.goto(`/tiep-nhan/${documentId}/tach-van-ban`);
  await expect(page.getByRole("heading", { name: "Tách thành nhiều văn bản", level: 1 })).toBeVisible();
  await expect(main.getByRole("status").filter({ hasText: /1 phần · 4 trang · 0 điểm tách/ })).toBeVisible();
  // Chưa có điểm tách: không tách được, có giải thích; ảnh thu nhỏ của các trang tải được.
  await expect(main.getByText(/Đặt ít nhất một điểm tách/)).toBeVisible();
  await expect(main.getByRole("button", { name: /^Tách thành 1 văn bản/ })).toBeDisabled();
  const first = main.getByRole("img", { name: "Trang 1" });
  await expect(first).toBeVisible();
  await expect.poll(() => first.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), { timeout: 30_000 }).toBe(true);
  await expectAccessible(page);

  // Đặt điểm tách giữa trang 2 và 3: hai phần phủ kín 1–4.
  await main.getByRole("button", { name: "Tách ở đây, giữa trang 2 và trang 3" }).click();
  await expect(main.getByRole("status").filter({ hasText: /2 phần · 4 trang · 1 điểm tách/ })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Phần 1 · Trang 1–2" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Phần 2 · Trang 3–4" })).toBeVisible();

  // Thêm điểm tách thứ hai rồi gỡ bằng "Gộp lại": trở về hai phần; "Bỏ hết" hoàn tác tất cả.
  await main.getByRole("button", { name: "Tách ở đây, giữa trang 1 và trang 2" }).click();
  await expect(main.getByRole("status").filter({ hasText: /3 phần/ })).toBeVisible();
  await main.getByRole("button", { name: "Gộp lại: gỡ điểm tách giữa trang 1 và trang 2" }).click();
  await expect(main.getByRole("status").filter({ hasText: /2 phần/ })).toBeVisible();
  await main.getByRole("button", { name: "Bỏ hết điểm tách" }).click();
  await expect(main.getByRole("status").filter({ hasText: /1 phần · 4 trang · 0 điểm tách/ })).toBeVisible();
  await main.getByRole("button", { name: "Tách ở đây, giữa trang 2 và trang 3" }).click();

  // Đặt tên phần 2, xem tóm tắt rồi xác nhận.
  const title2 = `E2E phần hai ${tag}`;
  await main.getByRole("region", { name: "Phần 2: Trang 3–4" }).getByLabel(/^Tên văn bản/).fill(title2);
  await main.getByRole("button", { name: /^Tách thành 2 văn bản/ }).click();
  const dialog = page.getByRole("dialog", { name: "Tách thành 2 văn bản?" });
  await expect(dialog.getByText("Trang 1–2")).toBeVisible();
  await expect(dialog.getByText(new RegExp(`Trang 3–4.*${title2}`))).toBeVisible();
  await dialog.getByRole("button", { name: "Xác nhận tách" }).click();
  await expect(page.getByText("Đã tách thành 2 văn bản.", { exact: false })).toBeVisible({ timeout: 60_000 });
  await expect(page).toHaveURL(/\/tiep-nhan(\?|$)/, { timeout: 30_000 });

  // Hệ quả: nguồn "đã tách", hai văn bản con đúng dải trang và có tên đã đặt; tách lại bị từ chối.
  expect(sql(`SELECT intake_status FROM hoso.documents WHERE id = '${documentId}'`)).toEqual(["split"]);
  expect(sql(`SELECT count(*) FROM hoso.document_segments WHERE source_document_id = '${documentId}' AND status = 'confirmed'`)).toEqual(["2"]);
  expect(sql(`SELECT count(*) FROM hoso.documents WHERE title = '${title2}'`)).toEqual(["1"]);
  await page.goto(`/tiep-nhan/${documentId}/tach-van-ban`);
  await expect(page.getByText(/đã được tách hoặc đã xếp vào hồ sơ/)).toBeVisible();

  // Mở lại trang của văn bản đã tách cố ý làm API trả 409; Next dev chuyển dòng nhật ký máy chủ đó ra console trình duyệt. Chỉ loại đúng dòng ấy.
  expect(problems.filter((p) => !p.includes('\\"status\\":409') && !p.includes('"status":409')), "không có lỗi console/CSP").toEqual([]);
});
