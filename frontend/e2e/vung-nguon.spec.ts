import { expect, signIn, test, watchConsole } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * FE-22, FE-23 (BE-114): bấm một trường thì trang nguồn mở đúng và khung làm nổi hiện đúng vùng chứa giá trị. Cần stack thật với worker AI đã ghi
 * vùng nguồn: AI giả (scripts/dev-up.sh ai fake) hoặc AI thật qua Ollama/MLX (AI-21, từ 18/11/2026; vùng thật chỉ có khi trường tìm thấy trong khối bố cục
 * hoặc lớp chữ PDF). Trường không có vùng thì không có khung.
 */

type Region = { x: number; y: number; width: number; height: number; page: number };
type RegionField = { label: string; region: Region };

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Tìm một giấy tờ của chuyên viên đang ở hộp tiếp nhận, đã được AI gợi ý và có ít nhất một trường mang vùng nguồn. */
async function documentWithRegion(page: Page): Promise<{ id: string; fields: RegionField[] } | null> {
  const inbox = (await (await page.request.get("/api/v1/intake/inbox?limit=100", { headers: await headers(page) })).json()) as { items: { documentId: string; stage: string }[] };
  for (const item of inbox.items.filter((i) => i.stage === "ready")) {
    const review = (await (await page.request.get(`/api/v1/documents/${item.documentId}/review`, { headers: await headers(page) })).json()) as {
      fields: { label: string; value: string | null; suggestedValue: string | null; sourceRegion: Region | null }[];
    };
    const fields = review.fields.filter((f) => f.sourceRegion && (f.suggestedValue || f.value)).map((f) => ({ label: f.label, region: f.sourceRegion! }));
    if (fields.length > 0) return { id: item.documentId, fields };
  }
  return null;
}

async function headers(page: Page) {
  const me = (await (await page.request.get("/api/v1/me")).json()) as { assignments: { id: string; role: string }[] };
  const mine = me.assignments.find((a) => a.role === "employee");
  return { "x-assignment-id": mine!.id };
}

test("Bấm trường ở màn đối chiếu: khung làm nổi hiện đúng vùng, đổi trường thì khung di chuyển theo @integration", async ({ page }) => {
  const problems = watchConsole(page);
  await signIn(page, "employee");
  await page.goto("/viec-cua-toi");
  const found = await documentWithRegion(page);
  test.skip(!found, "Hộp tiếp nhận chưa có giấy tờ đã đọc xong mang vùng nguồn: chạy `python3 scripts/smoke-ai-flow.py --keep` (giữ lại giấy tờ sau khi đọc)");
  const [first, second] = found!.fields;

  await page.goto(`/tiep-nhan/${found!.id}/doi-chieu`);
  const frame = page.getByRole("img", { name: /^Vùng chứa giá trị/ });
  const input = (label: string) => page.getByLabel(new RegExp(`^${escape(label)}`)).first();
  await expect(input(first.label)).toBeVisible({ timeout: 60_000 });
  await expect(frame).toHaveCount(0);                      // chưa bấm trường nào thì chưa có khung

  const geometry = () =>
    page.evaluate(() => {
      const box = document.querySelector('[role="img"][aria-label^="Vùng chứa"]') as HTMLElement | null;
      // Đổi mức phóng thì ảnh tải lại và khung vắng mặt một lúc: trả null để phép thử lại chờ, không ném lỗi.
      if (!box) return null;
      const image = box.parentElement!.querySelector("img") as HTMLImageElement;
      const f = box.getBoundingClientRect();
      const i = image.getBoundingClientRect();
      return { x: (f.left - i.left) / i.width, y: (f.top - i.top) / i.height, w: f.width / i.width, h: f.height / i.height, label: box.getAttribute("aria-label") };
    });
  const pad = 0.004;      // khung có đệm nhỏ quanh chữ

  await input(first.label).focus();
  await expect(frame).toBeVisible({ timeout: 30_000 });
  await expect(frame).toHaveAttribute("aria-label", new RegExp(`trường ${escape(first.label)}`));
  const a = (await geometry())!;
  expect(a.x).toBeCloseTo(Math.max(0, first.region.x - pad), 2);
  expect(a.y).toBeCloseTo(Math.max(0, first.region.y - pad), 2);
  expect(a.w).toBeCloseTo(first.region.width + 2 * pad, 2);
  expect(a.h).toBeCloseTo(first.region.height + 2 * pad, 2);

  // Trường thứ hai có vùng khác: khung di chuyển tới đó (không để lại khung của trường trước).
  if (second && (Math.abs(second.region.y - first.region.y) > 0.005 || Math.abs(second.region.x - first.region.x) > 0.005)) {
    await input(second.label).focus();
    await expect(frame).toHaveAttribute("aria-label", new RegExp(`trường ${escape(second.label)}`));
    await expect(frame).toHaveCount(1);
    const b = (await geometry())!;
    expect(b.x).toBeCloseTo(Math.max(0, second.region.x - pad), 2);
    expect(b.y).toBeCloseTo(Math.max(0, second.region.y - pad), 2);
  }

  // Phóng to: toạ độ theo phần trăm của ảnh nên khung vẫn đúng chỗ.
  await page.getByRole("button", { name: "Phóng to" }).click();
  await expect.poll(async () => (await geometry())?.x ?? -1, { timeout: 30_000 }).toBeCloseTo(Math.max(0, (second ?? first).region.x - pad), 2);
  expect(problems, "không có lỗi console/CSP").toEqual([]);
});

test("Chi tiết giấy tờ: liên kết 'chỉ vùng' của trường mở đúng trang và làm nổi vùng; ?vung= sai thì bỏ qua @integration", async ({ page }) => {
  const problems = watchConsole(page);
  await signIn(page, "employee");
  await page.goto("/viec-cua-toi");
  const found = await documentWithRegion(page);
  test.skip(!found, "Chưa có giấy tờ có vùng nguồn (xem ghi chú ở ca trên)");
  // Xác nhận loại giấy tờ theo đúng gợi ý (nếu chưa) để các trường kèm vùng được sao sang bảng chính; chỉ khi chấp nhận ĐÚNG gợi ý thì vùng mới đi theo.
  const auth = { ...(await headers(page)), "x-csrf": "1" };
  const review = (await (await page.request.get(`/api/v1/documents/${found!.id}/review`, { headers: auth })).json()) as {
    document: { classification: unknown };
    suggestion: { workGroupCode: string | null; documentTypeCode: string | null } | null;
  };
  if (!review.document.classification) {
    const suggestion = review.suggestion;
    test.skip(!suggestion?.workGroupCode || !suggestion.documentTypeCode, "AI chưa gợi ý được loại giấy tờ");
    const accepted = await page.request.put(`/api/v1/documents/${found!.id}/classification`, {
      headers: auth,
      data: { workGroupCode: suggestion!.workGroupCode, documentTypeCode: suggestion!.documentTypeCode },
    });
    expect(accepted.ok(), "chấp nhận đúng gợi ý của AI").toBeTruthy();
  }

  await page.goto(`/giay-to/${found!.id}`);
  const link = page.getByRole("link", { name: /chỉ vùng/ }).first();
  await expect(link).toBeVisible({ timeout: 30_000 });
  await link.click();
  await expect(page).toHaveURL(/vung=/);
  await expect(page.getByRole("img", { name: /^Vùng chứa giá trị/ })).toBeVisible({ timeout: 30_000 });

  // Tham số hỏng: không dựng khung.
  await page.goto(`/giay-to/${found!.id}?trang=1&vung=abc,1,2`);
  await expect(page.getByRole("img", { name: "Trang 1 của bản gốc" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("img", { name: /^Vùng chứa giá trị/ })).toHaveCount(0);
  expect(problems, "không có lỗi console/CSP").toEqual([]);
});
