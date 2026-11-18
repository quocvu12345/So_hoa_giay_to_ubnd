import { expect, signIn, test, watchConsole } from "./fixtures";

/** FE-28, BE-130: tab Tổng quan của hồ sơ hiện thời hạn bảo quản áp dụng, khớp với điều API trả (chỉ quy tắc đã xác nhận mới có hiệu lực). */
test("Hồ sơ: Tổng quan hiện thời hạn bảo quản đúng với API @integration", async ({ page }) => {
  const problems = watchConsole(page);
  await signIn(page, "employee");
  const me = (await (await page.request.get("/api/v1/me")).json()) as { assignments: { id: string; role: string }[] };
  const headers = { "x-assignment-id": me.assignments.find((a) => a.role === "employee")!.id, "x-csrf": "1" };

  const created = await page.request.post("/api/v1/dossiers", { headers, data: { title: `E2E bảo quản ${Date.now()}`, workGroupCode: "U15" } });
  expect(created.status()).toBe(201);
  const id = ((await created.json()) as { id: string }).id;
  const detail = (await (await page.request.get(`/api/v1/dossiers/${id}`, { headers })).json()) as {
    retention: { status: string; label: string | null; legalReference: string | null };
  };
  expect(["confirmed", "proposed", "ambiguous", "none"]).toContain(detail.retention.status);

  await page.goto(`/ho-so/${id}`);
  // Khoanh vào vùng nội dung chính: trang có ranh giới loading nên lúc vừa tải còn một bản ẩn của luồng streaming (strict mode báo 2 phần tử).
  const row = page.locator("#noi-dung dt", { hasText: "Thời hạn bảo quản" }).locator("xpath=following-sibling::dd[1]");
  await expect(row).toBeVisible();
  const expected = { confirmed: detail.retention.label ?? "", proposed: "Chưa xác nhận", ambiguous: "Chưa xác định", none: "Chưa có" }[detail.retention.status]!;
  await expect(row).toContainText(expected);
  if (detail.retention.status === "confirmed" && detail.retention.legalReference) await expect(row).toContainText(detail.retention.legalReference);
  // Hồ sơ mới chưa lưu trữ: chưa có ngày đủ hạn.
  if (detail.retention.status === "confirmed") await expect(row).toContainText("Hạn tính từ ngày hồ sơ được lưu trữ");

  expect(problems, "không có lỗi console hay CSP").toEqual([]);
});
