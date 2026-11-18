import "server-only";
import type { components } from "@/api/schema";
import { ok, serverApi } from "@/lib/api/server";
import { MAX_DOSSIERS } from "./archive-rules";

export type Submission = components["schemas"]["ArchiveSubmissionDto"];
export type SubmissionItem = components["schemas"]["ArchiveItemDto"];
export type ReadyDossier = components["schemas"]["DossierListItem"];

/** Các đợt nộp lưu của cơ quan, mới nhất trước (BE-84). Lọc theo trạng thái làm ở giao diện (tối đa 200 đợt). */
export async function getSubmissions(): Promise<Submission[]> {
  return ok(await serverApi().GET("/api/v1/archive-submissions", { params: { query: {} } }));
}

export async function getSubmission(id: string): Promise<Submission> {
  return ok(await serverApi().GET("/api/v1/archive-submissions/{id}", { params: { path: { id } } }));
}

/** Hồ sơ đã đạt, đang chờ nộp lưu (trạng thái ready_archive) trong phạm vi: nguồn để gom thành đợt. */
export async function getReadyForArchive(): Promise<ReadyDossier[]> {
  const page = ok(await serverApi().GET("/api/v1/dossiers", { params: { query: { Status: "ready_archive", Sort: "updated", Dir: "desc", Limit: MAX_DOSSIERS } } }));
  return page.items;
}
