import { expect, signIn, test, watchConsole } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * FE-21, BE-129: hộp tiếp nhận lọc trên TOÀN hộp (không chỉ phần đã tải) theo tình trạng đọc, lô quét, nhóm hồ sơ; bộ lọc nằm trên địa chỉ;
 * số trên các nút lấy từ máy chủ. Dùng dữ liệu sẵn có trong hộp của chuyên viên (các lần chạy trước để lại PDF), không nạp thêm.
 */

type Summary = { total: number; queued: number; reading: number; ready: number; failed: number; cancelled: number };

async function summary(page: Page, query = ""): Promise<Summary> {
  const me = (await (await page.request.get("/api/v1/me")).json()) as { assignments: { id: string; role: string }[] };
  const mine = me.assignments.find((a) => a.role === "employee")!;
  return (await (await page.request.get(`/api/v1/intake/inbox/summary${query}`, { headers: { "x-assignment-id": mine.id } })).json()) as Summary;
}

/** Số trong ngoặc ở nút lọc, ví dụ "Đã đọc xong (12)". */
async function chipCount(page: Page, label: string): Promise<number> {
  const text = (await page.getByRole("navigation", { name: "Lọc theo tình trạng đọc" }).getByRole("link", { name: new RegExp(`^${label}`) }).innerText()).trim();
  return Number(/\((\d+)\)/.exec(text)![1]);
}

test("Hộp tiếp nhận: lọc theo tình trạng đọc ở máy chủ, số trên nút khớp tổng hợp, bộ lọc nằm trên địa chỉ @integration", async ({ page }) => {
  const problems = watchConsole(page);
  await signIn(page, "employee");
  await page.goto("/tiep-nhan");
  const chips = page.getByRole("navigation", { name: "Lọc theo tình trạng đọc" });
  await expect(chips).toBeVisible();

  // Số trên nút lấy từ tổng hợp của máy chủ, đúng cả khi hộp lớn hơn một trang.
  const all = await summary(page);
  expect(all.total).toBeGreaterThan(0);                       // các lần chạy trước (hoặc smoke --keep) để lại PDF; không có thì chạy scripts/smoke-ai-flow.py --keep
  expect(await chipCount(page, "Tất cả")).toBe(all.total);
  expect(await chipCount(page, "Đã đọc xong")).toBe(all.ready);
  expect(await chipCount(page, "Lỗi")).toBe(all.failed + all.cancelled);
  expect(all.total).toBe(all.queued + all.reading + all.ready + all.failed + all.cancelled);

  // Bấm "Đã đọc xong": đổi địa chỉ, và mọi dòng đang hiện đều là đã đọc xong.
  await chips.getByRole("link", { name: /^Đã đọc xong/ }).click();
  await expect(page).toHaveURL(/[?&]doc=da-doc\b/);
  await expect(chips.getByRole("link", { name: /^Đã đọc xong/ })).toHaveAttribute("aria-current", "true");
  const rows = page.locator("tbody tr");
  if (all.ready > 0) {
    await expect(rows.first()).toBeVisible();
    const total = await rows.count();
    expect(total).toBeLessThanOrEqual(50);                    // trang đầu
    for (let i = 0; i < total; i++) await expect(rows.nth(i)).toContainText("Đã đọc xong");
  }

  // Bộ lọc không có kết quả vẫn giữ các nút lọc (không thoát sớm sang lời mời nạp PDF) và nói rõ.
  await page.goto("/tiep-nhan?doc=da-doc&nhom=ZZ99");
  await expect(chips).toBeVisible();
  // Thông báo có hai bản (thẻ cho màn hẹp, bảng cho màn rộng), chỉ một bản hiện theo kích thước cửa sổ.
  await expect(page.getByText("Không có PDF nào khớp bộ lọc.").filter({ visible: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Bỏ bộ lọc" })).toBeVisible();
  await page.getByRole("link", { name: "Bỏ bộ lọc" }).click();
  await expect(page).toHaveURL(/\/tiep-nhan$/);

  // Giá trị lạ trên địa chỉ bị bỏ, không làm hỏng trang.
  await page.goto("/tiep-nhan?doc=xoa-het&lo=khong-phai-uuid&nhom=U15%3BDROP");
  await expect(chips.getByRole("link", { name: /^Tất cả/ })).toHaveAttribute("aria-current", "true");
  expect(await chipCount(page, "Tất cả")).toBe(all.total);

  expect(problems, "không có lỗi console hay CSP").toEqual([]);
});

test("Hộp tiếp nhận: lọc theo lô quét và theo nhóm của gợi ý AI @integration", async ({ page }) => {
  await signIn(page, "employee");
  await page.goto("/tiep-nhan");
  const batchSelect = page.getByLabel("Lô quét");
  const groupSelect = page.getByLabel("Nhóm hồ sơ");
  await expect(batchSelect).toBeVisible();
  await expect(groupSelect).toBeVisible();

  // Chọn một nhóm: địa chỉ có ?nhom=, số trên nút "Tất cả" bằng tổng hợp của máy chủ cho đúng nhóm đó.
  const groupOptions = await groupSelect.locator("option").evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
  expect(groupOptions.length).toBeGreaterThan(0);
  const code = groupOptions.includes("U15") ? "U15" : groupOptions[0];
  await groupSelect.selectOption(code);
  await expect(page).toHaveURL(new RegExp(`[?&]nhom=${code}\\b`));
  const expected = await summary(page, `?group=${code}`);
  await expect(page.getByRole("navigation", { name: "Lọc theo tình trạng đọc" }).getByRole("link", { name: /^Tất cả/ })).toContainText(`(${expected.total})`);

  // Đã chọn nhóm thì có ô lọc theo loại giấy tờ của nhóm; đổi nhóm thì loại bị bỏ.
  const typeSelect = page.getByLabel("Loại giấy tờ");
  await expect(typeSelect).toBeVisible();
  const typeOptions = await typeSelect.locator("option").evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
  expect(typeOptions.length).toBeGreaterThan(0);
  await typeSelect.selectOption(typeOptions[0]);
  await expect(page).toHaveURL(new RegExp(`[?&]loai=${typeOptions[0]}\\b`));
  const byType = await summary(page, `?group=${code}&type=${typeOptions[0]}`);
  await expect(page.getByRole("navigation", { name: "Lọc theo tình trạng đọc" }).getByRole("link", { name: /^Tất cả/ })).toContainText(`(${byType.total})`);
  expect(byType.total).toBeLessThanOrEqual(expected.total);

  // Bỏ nhóm bằng ô chọn: địa chỉ không còn tham số (loại đi theo nhóm nên cũng mất).
  await groupSelect.selectOption("");
  await expect(page).not.toHaveURL(/nhom=|loai=/);
  await expect(page.getByLabel("Loại giấy tờ")).toHaveCount(0);

  // Lô: nếu có lô thì chọn được và số khớp; không có lô thì ô vẫn dùng được (chỉ có "Tất cả lô").
  const batchOptions = await batchSelect.locator("option").evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
  if (batchOptions.length > 0) {
    await batchSelect.selectOption(batchOptions[0]);
    await expect(page).toHaveURL(new RegExp(`[?&]lo=${batchOptions[0]}`));
    const inBatch = await summary(page, `?batch=${batchOptions[0]}`);
    await expect(page.getByRole("navigation", { name: "Lọc theo tình trạng đọc" }).getByRole("link", { name: /^Tất cả/ })).toContainText(`(${inBatch.total})`);
  }
});
