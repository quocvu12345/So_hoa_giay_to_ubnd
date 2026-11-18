import { expect, samplePdf, signIn, test, watchConsole } from "./fixtures";

/**
 * FE-27, FE-24, FE-29 (BE-61, BE-62, BE-64): hồ sơ làm theo thủ tục.
 *  - tạo hồ sơ: chọn thủ tục ngay trong form (tìm, chọn, thấy các thành phần);
 *  - tab Giấy tờ: gán giấy tờ vào thành phần rồi bỏ gán;
 *  - bước xếp hồ sơ: chọn thành phần mà giấy tờ đáp ứng khi xếp vào hồ sơ.
 * Mọi kết luận đối chiếu với `GET /dossiers/{id}/checklist` của API, không chỉ với giao diện. Dữ liệu thử có tên "E2E".
 */

type Procedure = { id: string; name: string; lifecycleStatus: string; componentCount: number };
type Checklist = { components: { componentId: string; name: string; documentIds: string[] }[] | null };

test("Hồ sơ theo thủ tục: chọn thủ tục khi tạo, gán thành phần ở tab Giấy tờ và khi xếp hồ sơ @integration", async ({ page }) => {
  const problems = watchConsole(page);
  const tag = `${Date.now()}`;
  await signIn(page, "employee");
  const me = (await (await page.request.get("/api/v1/me")).json()) as { assignments: { id: string; role: string }[] };
  const headers = { "x-assignment-id": me.assignments.find((a) => a.role === "employee")!.id, "x-csrf": "1" };
  const api = {
    get: async <T,>(url: string) => (await (await page.request.get(url, { headers })).json()) as T,
    checklist: (id: string) => api.get<Checklist>(`/api/v1/dossiers/${id}/checklist`),
  };

  // Một thủ tục đang hiệu lực có từ 2 thành phần (để thử gán hai giấy tờ vào hai thành phần).
  const found = await api.get<{ items: Procedure[] }>("/api/v1/procedures?q=khai%20sinh&status=active&pageSize=25");
  const procedure = found.items.find((p) => p.lifecycleStatus === "active" && p.componentCount >= 2);
  test.skip(!procedure, "CSDL dev chưa có thủ tục đang hiệu lực nào có từ 2 thành phần (nạp bằng backend/scripts/import_procedures.py)");

  // ---- FE-27: tạo hồ sơ, chọn thủ tục ngay trong form ----
  await page.goto("/ho-so/tao-moi");
  const title = `E2E thành phần ${tag}`;
  await page.getByLabel(/Tên hồ sơ/).fill(title);
  const group = page.getByLabel(/Nhóm hồ sơ/);
  const groups = await group.locator("option").evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
  expect(groups.length, "chuyên viên phải có ít nhất một nhóm hồ sơ để tạo").toBeGreaterThan(0);
  await group.selectOption(groups[0]);
  const picker = page.getByRole("combobox", { name: /Thủ tục hành chính/ });
  await picker.fill("khai sinh");
  const option = page.getByRole("option", { name: procedure!.name.replace(/\s+/g, " ") }).first();
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  await expect(page.getByText(/Hồ sơ theo thủ tục này có \d+ thành phần/)).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /^Tạo hồ sơ$/ }).click();
  await expect(page).toHaveURL(/\/ho-so\/[0-9a-f-]{36}\/giay-to/, { timeout: 30_000 });
  const dossierId = /\/ho-so\/([0-9a-f-]{36})\//.exec(page.url())![1];
  const detail = await api.get<{ procedureId: string | null }>(`/api/v1/dossiers/${dossierId}`);
  expect(detail.procedureId, "hồ sơ ghi đúng thủ tục đã chọn").toBe(procedure!.id);
  const components = (await api.checklist(dossierId)).components ?? [];
  expect(components.length).toBeGreaterThanOrEqual(2);

  const upload = async (sample: string) => {
    const response = await page.request.post("/api/v1/intake/files", { headers, multipart: { file: samplePdf(sample, tag) } });
    expect(response.status()).toBe(201);
    return ((await response.json()) as { documentId: string }).documentId;
  };

  // ---- FE-29: giấy tờ đã nằm trong hồ sơ, gán rồi bỏ gán thành phần ở tab Giấy tờ ----
  const first = await upload("filled-u15-d07");
  expect((await page.request.post(`/api/v1/dossiers/${dossierId}/documents`, { headers, data: { documentId: first, direction: "incoming" } })).ok()).toBe(true);
  await page.goto(`/ho-so/${dossierId}/giay-to`);
  const assign = page.getByLabel(/Thành phần của thủ tục mà .* đáp ứng/).first();
  await expect(assign).toBeVisible();
  await assign.selectOption(components[0].componentId);
  await expect.poll(async () => (await api.checklist(dossierId)).components!.find((c) => c.componentId === components[0].componentId)!.documentIds, { timeout: 30_000 }).toContain(first);
  await assign.selectOption("");
  await expect.poll(async () => (await api.checklist(dossierId)).components!.find((c) => c.componentId === components[0].componentId)!.documentIds, { timeout: 30_000 }).not.toContain(first);

  // ---- FE-24: xếp một giấy tờ mới vào hồ sơ và chọn thành phần ngay lúc xếp ----
  const second = await upload("filled-u02-d01");
  await page.goto(`/tiep-nhan/${second}/xep-ho-so`);
  await page.getByLabel("Tìm hồ sơ khác theo mã hoặc tên").fill(title);
  await page.getByRole("radio").first().check({ timeout: 30_000 });
  const pick = page.getByLabel(/Thành phần của thủ tục “/);
  await expect(pick).toBeVisible({ timeout: 30_000 });
  await pick.selectOption(components[1].componentId);
  await page.getByRole("button", { name: /^Lưu$/ }).click();
  await expect(page).toHaveURL(/\/tiep-nhan(\?|$)/, { timeout: 30_000 });
  expect((await api.checklist(dossierId)).components!.find((c) => c.componentId === components[1].componentId)!.documentIds).toContain(second);

  expect(problems, "không có lỗi console hay CSP").toEqual([]);
});
