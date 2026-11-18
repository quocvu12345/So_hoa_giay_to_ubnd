"use server";

import { revalidatePath } from "next/cache";
import { UUID } from "@/features/dossier/dossier-data";
import type { SplitResult } from "@/features/split/split-data";
import { cutsToSegments, validateSplit, validateTitle } from "@/features/split/split-rules";
import type { ActionResult } from "@/lib/action-result";
import { ok, serverApi } from "@/lib/api/server";
import { runAction } from "@/lib/actions";
import { log } from "@/lib/log";

/**
 * Tách một PDF nhiều văn bản (BE-51): đề xuất dải trang từ các điểm tách rồi xác nhận ngay. Dải trang dẫn xuất từ điểm tách nên luôn phủ kín, không chồng, không hở;
 * API kiểm lại. Tệp gốc không bao giờ bị sửa: mỗi phần thành một tệp mới vào hộp tiếp nhận và được AI đọc riêng; văn bản nguồn chuyển "đã tách".
 * `titles[i]` là tên phần thứ i (rỗng: API đặt tên mặc định).
 */
export async function splitDocument(documentId: string, pageCount: number, cuts: number[], titles: string[]): Promise<ActionResult<SplitResult>> {
  return runAction("document_split", async () => {
    if (!UUID.test(documentId)) throw new TypeError("Mã không hợp lệ.");
    if (validateSplit(cuts, pageCount) || titles.some((t) => validateTitle(t))) throw new TypeError("Điểm tách hoặc tên phần chưa hợp lệ.");
    const segments = cutsToSegments(cuts, pageCount);
    if (titles.length !== segments.length) throw new TypeError("Số tên phần không khớp số phần.");

    const proposed = ok(await serverApi().POST("/api/v1/documents/{id}/segments", { params: { path: { id: documentId } }, body: { segments: segments.map((s) => ({ pageFrom: s.from, pageTo: s.to })) } }));
    const mine = proposed.segments.filter((p) => p.status === "proposed").sort((a, b) => Number(a.pageFrom) - Number(b.pageFrom));
    if (mine.length !== segments.length) throw new TypeError("Không dựng được đề xuất tách khớp với các điểm tách.");
    const named: Record<string, string> = {};
    mine.forEach((p, i) => { if (titles[i].trim()) named[p.id] = titles[i].trim(); });
    const result = ok(await serverApi().POST("/api/v1/segments/{id}/confirm", { params: { path: { id: mine[0].id } }, body: { titles: named } }));
    log.info("document_split", { documentId, parts: result.children.length });
    revalidatePath("/tiep-nhan");
    return result;
  });
}
