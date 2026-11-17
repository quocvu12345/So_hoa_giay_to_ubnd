import { expect, signIn, test } from "./fixtures";

/**
 * FE-46. Phiên đăng nhập không được kẹt vòng khi cookie phân công không còn dùng được,
 * và phân công cần xác thực hai lớp phải nói rõ cách đăng nhập lại. Cần stack thật (API dev-login).
 */
test("Cookie phân công cũ: vẫn vào được, quay về phân công mặc định và xóa cookie @integration", async ({ page, context }) => {
  await signIn(page, "employee");
  await context.addCookies([{ name: "hoso_assignment", value: "00000000-0000-0000-0000-000000000001", url: "http://localhost:3000" }]);
  await page.goto("/viec-cua-toi");
  await expect(page).toHaveURL(/\/viec-cua-toi$/);
  await expect(page.getByText(/Phân công bạn chọn trước đó không còn hiệu lực/)).toBeVisible();
  await expect.poll(async () => (await context.cookies()).some((c) => c.name === "hoso_assignment")).toBe(false);
});

test("Đăng xuất xóa cookie phân công @integration", async ({ page, context }) => {
  await signIn(page, "employee");
  await page.goto("/viec-cua-toi");
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/dang-nhap/);
  expect((await context.cookies()).some((c) => c.name === "hoso_assignment")).toBe(false);
});

test("Phân công cần xác thực hai lớp: có thanh báo và liên kết đăng nhập lại @integration", async ({ page }) => {
  const login = await page.request.get("/api/v1/auth/dev-login?username=dev_admin&returnUrl=/&mfa=false");
  expect(login.ok()).toBeTruthy();
  await page.goto("/viec-cua-toi");
  await expect(page.getByRole("alert").filter({ hasText: "cần xác thực hai lớp" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng nhập lại có xác thực hai lớp" })).toHaveAttribute("href", /\/api\/v1\/auth\/login\?mfa=true/);
});
