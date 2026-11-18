import { expect, expectAccessible, samplePdf, signIn, sql, test, watchConsole } from "./fixtures";

/**
 * FE-44 và BE-120 với API thật (scripts/dev-up.sh start): quản trị kỹ thuật xem máy AI, chạy lại việc lỗi, hủy việc đang chạy, sửa cài đặt, ghi nhận sao lưu.
 * Việc AI thử được dựng bằng cách nạp một PDF rồi đặt thẳng trạng thái trong CSDL (worker thật không được lỗi theo ý muốn). Dữ liệu thử có tiền tố "E2E".
 */
test("Vận hành: xem máy AI, chạy lại việc lỗi, hủy việc đang chạy, sửa cài đặt và ghi sao lưu @integration", async ({ page }) => {
  const problems = watchConsole(page);
  const tag = `${Date.now()}`;
  const main = page.locator("main");

  // Người không có quyền (chuyên viên) không vào được.
  await signIn(page, "employee");
  await page.goto("/quan-tri/van-hanh");
  // Khoanh vào vùng nội dung chính: trang có ranh giới loading nên lúc vừa tải xong còn một bản ẩn của luồng streaming (strict mode báo 2 phần tử).
  await expect(page.locator("#noi-dung").getByText(/Bạn chưa có quyền xem vận hành/)).toBeVisible();

  // Nạp một PDF bằng tài khoản chuyên viên, rồi ép việc đọc của nó thành "lỗi" (đã thử 3 lần).
  const me = (await (await page.request.get("/api/v1/me")).json()) as { activeAssignment: { id: string } };
  const pdf = samplePdf("filled-u15-d07", tag);
  const upload = await page.request.post("/api/v1/intake/files", {
    headers: { "X-CSRF": "1", "X-Assignment-Id": me.activeAssignment.id },
    multipart: { file: pdf },
  });
  expect(upload.status()).toBe(201);
  const { jobId, fileId } = (await upload.json()) as { jobId: string; fileId: string };
  sql(`UPDATE hoso.ocr_jobs SET status = 'failed', locked_by = NULL, attempt = 3, started_at = now(), finished_at = now(), error_message = 'E2E lỗi giả lập ${tag}' WHERE id = '${jobId}'`);

  await signIn(page, "technical_admin");
  await page.goto("/quan-tri/van-hanh");
  await expect(main.getByRole("heading", { name: "Hàng đợi AI", exact: true })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Mục vận hành" });
  await expect(nav.getByRole("link", { name: "Máy AI" })).toHaveAttribute("aria-current", "page");
  for (const name of ["Việc AI", "Sao lưu", "Cài đặt"]) await expect(nav.getByRole("link", { name })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Mô hình", exact: true })).toBeVisible();
  await expectAccessible(page);

  // Việc AI: việc lỗi hiện kèm lý do; chạy lại tạo việc mới, việc cũ giữ nguyên và khóa kèm lý do.
  await page.goto("/quan-tri/van-hanh?muc=viec&trang-thai=failed");
  const row = main.getByRole("listitem").filter({ hasText: pdf.name });
  await expect(row).toBeVisible();
  await expect(row.getByText(`E2E lỗi giả lập ${tag}`)).toBeVisible();
  await expectAccessible(page);
  await row.getByRole("button", { name: `Chạy lại việc đọc ${pdf.name}` }).click();
  await expect(page.getByText(`Đã xếp việc đọc mới cho ${pdf.name}.`)).toBeVisible({ timeout: 30_000 });
  await expect(row.getByText(/Chưa chạy lại được:/)).toBeVisible({ timeout: 30_000 });
  const [retried] = sql(`SELECT id FROM hoso.ocr_jobs WHERE options->>'retry_of' = '${jobId}'`);
  expect(retried, "việc mới ghi retry_of").toBeTruthy();

  // Hủy việc đang chạy: đặt việc mới thành "đang đọc" bởi một worker giả (worker thật không đụng tới), rồi hủy trên giao diện.
  sql(`UPDATE hoso.ocr_jobs SET status = 'running', locked_by = 'e2e-worker', heartbeat_at = now(), started_at = now(), finished_at = NULL, stage = 'ocr' WHERE id = '${retried}'`);
  await page.goto("/quan-tri/van-hanh?muc=viec");
  const running = main.getByRole("listitem").filter({ hasText: pdf.name });
  await expect(running.getByText("Đang đọc").first()).toBeVisible();
  await running.getByRole("button", { name: `Hủy việc đọc ${pdf.name}` }).click();
  await running.getByRole("button", { name: "Hủy việc", exact: true }).click();
  await expect(page.getByText(`Đã hủy việc đọc ${pdf.name}.`)).toBeVisible({ timeout: 30_000 });
  expect(sql(`SELECT status FROM hoso.ocr_jobs WHERE id = '${retried}'`)).toEqual(["cancelled"]);
  expect(sql(`SELECT status FROM hoso.ocr_jobs WHERE id = '${jobId}'`)).toEqual(["failed"]);     // việc lỗi cũ vẫn là lịch sử
  void fileId;

  // Cài đặt: giá trị sai kiểu bị chặn ngay ở ô; đúng thì lưu; trả về như cũ.
  await page.goto("/quan-tri/van-hanh?muc=cai-dat");
  const key = "dossier.enforce_procedure_components";
  const original = sql(`SELECT value FROM hoso.system_settings WHERE key = '${key}'`)[0] ?? "false";
  await main.getByRole("button", { name: `Sửa cài đặt ${key}` }).click();
  const dialog = page.getByRole("dialog", { name: `Sửa ${key}` });
  await dialog.getByLabel("Giá trị").fill('"true"');
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(dialog.getByText(/chỉ nhận true hoặc false/)).toBeVisible();
  await dialog.getByLabel("Giá trị").fill(original === "true" ? "false" : "true");
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText(`Đã lưu cài đặt ${key}.`)).toBeVisible({ timeout: 30_000 });
  await main.getByRole("button", { name: `Sửa cài đặt ${key}` }).click();
  await dialog.getByLabel("Giá trị").fill(original);
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText(`Đã lưu cài đặt ${key}.`).last()).toBeVisible({ timeout: 30_000 });
  expect(sql(`SELECT value FROM hoso.system_settings WHERE key = '${key}'`)).toEqual([original]);

  // Sao lưu: tình trạng hiện; ghi tay một lần sao lưu cấu hình (loại không bắt buộc nên không đổi cảnh báo của hệ thống).
  await page.goto("/quan-tri/van-hanh?muc=sao-luu");
  await expect(main.getByRole("heading", { name: "Từng loại sao lưu" })).toBeVisible();
  await expectAccessible(page);
  await main.getByRole("button", { name: "Ghi tay một lần sao lưu" }).click();
  const backup = page.getByRole("dialog", { name: "Ghi tay một lần sao lưu" });
  await backup.getByLabel("Loại").selectOption("config");
  await backup.getByLabel("Ghi chú").fill(`E2E ${tag}`);
  await backup.getByRole("button", { name: "Ghi nhận" }).click();
  await expect(page.getByText("Đã ghi nhận lần sao lưu.")).toBeVisible({ timeout: 30_000 });
  await expect(main.getByText(`E2E ${tag}`)).toBeVisible();

  expect(problems, "không có lỗi console/CSP").toEqual([]);
});
