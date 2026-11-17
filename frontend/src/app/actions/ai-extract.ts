"use server";

import { revalidatePath } from "next/cache";
import { ApiError, apiFetch } from "@/lib/api/server";
import type { ExtractResult } from "@/lib/ai-queue";
import { getSession } from "@/lib/auth/session";
import { hasAny } from "@/lib/auth/permissions";
import { serverEnv } from "@/lib/env";
import { log } from "@/lib/log";

export type ExtractActionResult = { ok: true; result: ExtractResult } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * "Trích xuất ngay" (BE-98): đưa giấy tờ hoặc cả hồ sơ lên đầu hàng đợi AI.
 * Không ném lỗi nghiệp vụ ra trình duyệt: trả { ok: false, message } để hiện ngay cạnh nút. API mới là nơi kiểm quyền và phạm vi.
 */
export async function extractNow(input: { scope: "document" | "dossier"; id: string; force?: boolean; documentIds?: string[] }): Promise<ExtractActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Phiên đăng nhập đã hết. Đăng nhập lại rồi thử tiếp." };
  const required = input.scope === "dossier" ? (["dossier.prepare"] as const) : (["intake.upload", "dossier.prepare"] as const);
  if (!hasAny(session.permissions, required)) return { ok: false, message: "Phân công đang dùng không có quyền trích xuất." };
  if (!UUID.test(input.id) && !serverEnv().mock) return { ok: false, message: "Mã không hợp lệ." };
  if (input.documentIds?.some((id) => !UUID.test(id)) && !serverEnv().mock) return { ok: false, message: "Mã giấy tờ không hợp lệ." };

  if (serverEnv().mock) return { ok: true, result: mockResult(input.id, input.scope, Boolean(input.force)) };

  const path = input.scope === "dossier" ? (`/api/v1/dossiers/${input.id}/ai/extract` as const) : (`/api/v1/documents/${input.id}/ai/extract` as const);
  try {
    const result = await apiFetch<ExtractResult>(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ force: Boolean(input.force), ...(input.documentIds?.length ? { documentIds: input.documentIds } : {}) }),
    });
    log.info("ai_extract_requested", { scope: input.scope, id: input.id, items: result.items.length, force: Boolean(input.force) });
    revalidatePath("/tiep-nhan");
    return { ok: true, result };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { ok: false, message: messageFor(error) };
  }
}

function messageFor(error: ApiError): string {
  switch (error.status) {
    case 401:
      return "Phiên đăng nhập đã hết. Đăng nhập lại rồi thử tiếp.";
    case 403:
      return "Phân công đang dùng không có quyền trích xuất.";
    case 404:
      return "Không thấy giấy tờ hoặc hồ sơ này trong phạm vi của bạn.";
    case 400:
    case 409:
    case 422:
      return error.message;
    case 429:
      return "Bấm quá nhanh. Đợi một phút rồi thử lại.";
    default:
      return `Chưa trích xuất được. Mã lỗi: ${error.errorId ?? error.code}.`;
  }
}

/** Dữ liệu giả lập (HOSO_MOCK=1): đủ để thử giao diện, không gọi AI. */
function mockResult(id: string, scope: "document" | "dossier", force: boolean): ExtractResult {
  if (scope === "dossier") {
    const items = [
      { documentId: `${id}-1`, fileId: null, jobId: "mock-1", outcome: "raised" as const, queueKind: "priority" as const, queuePosition: 1, etaSeconds: 25, message: null },
      { documentId: `${id}-2`, fileId: null, jobId: "mock-2", outcome: "running" as const, queueKind: "priority" as const, queuePosition: null, etaSeconds: 10, message: null },
      { documentId: `${id}-3`, fileId: null, jobId: "mock-3", outcome: force ? ("created" as const) : ("alreadyDone" as const), queueKind: force ? ("priority" as const) : null, queuePosition: force ? 2 : null, etaSeconds: null, message: null },
    ];
    return { items, raised: 1, running: 1, alreadyDone: force ? 0 : 1, created: force ? 1 : 0, skipped: 0 };
  }
  const outcome = id === "doc-26kh" && !force ? ("alreadyDone" as const) : ("raised" as const);
  const item = { documentId: id, fileId: null, jobId: `mock-${id}`, outcome, queueKind: outcome === "raised" ? ("priority" as const) : null, queuePosition: outcome === "raised" ? 1 : null, etaSeconds: outcome === "raised" ? 25 : null, message: null };
  return { items: [item], raised: outcome === "raised" ? 1 : 0, running: 0, alreadyDone: outcome === "alreadyDone" ? 1 : 0, created: 0, skipped: 0 };
}
