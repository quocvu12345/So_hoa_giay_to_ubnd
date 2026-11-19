"""Kho job PostgreSQL (ADR-04). Chạy bằng role hoso_ai_worker: chỉ ghi các bảng nhóm F.

Hai kết nối: một cho công việc chính, một cho heartbeat/LISTEN, để heartbeat không bị
chặn khi đang ghi kết quả trang.
"""
from __future__ import annotations

import json
import threading
from contextlib import contextmanager

from ..contracts import Job, JobType, PageResult, Progress, Suggestion
from .repository import Catalog, DocumentTypeDef, FieldDef, JobCancelled, JobLost, WorkerReport

REPORT_WORKER_SQL = """
INSERT INTO hoso.ai_workers (worker_id, profile, engine, engine_ok, engine_error, engine_down_since, current_job_id, last_seen_at)
VALUES (%(worker)s, %(profile)s, %(engine)s, %(ok)s, %(error)s, to_timestamp(%(since)s), %(job)s::uuid, now())
ON CONFLICT (worker_id) DO UPDATE
SET profile = EXCLUDED.profile, engine = EXCLUDED.engine, engine_ok = EXCLUDED.engine_ok, engine_error = EXCLUDED.engine_error,
    engine_down_since = EXCLUDED.engine_down_since, current_job_id = EXCLUDED.current_job_id, last_seen_at = now()
"""

CLAIM_SQL = """
WITH next AS (
  SELECT id FROM hoso.ocr_jobs
  WHERE status = 'queued' AND (%(exclude_from)s::int IS NULL OR priority < %(exclude_from)s::int)
  ORDER BY priority, coalesce(prioritized_at, created_at)
  FOR UPDATE SKIP LOCKED
  LIMIT 1
), claimed AS (
  UPDATE hoso.ocr_jobs j
  SET status = 'running', locked_by = %(worker)s, attempt = j.attempt + 1,
      started_at = coalesce(j.started_at, now()), heartbeat_at = now(), stage = 'preparing'
  FROM next WHERE j.id = next.id
  RETURNING j.id, j.file_id, j.job_type, j.options, j.attempt, j.priority, j.preempted_count
)
SELECT c.id::text, c.file_id::text, f.document_id::text, f.storage_key, f.sha256, coalesce(f.page_count, 0),
       c.job_type, c.options, c.attempt, c.priority, c.preempted_count
FROM claimed c JOIN hoso.files f ON f.id = c.file_id
"""

YIELD_CHECK_SQL = """
SELECT q.id::text FROM hoso.ocr_jobs j, hoso.ocr_jobs q
WHERE j.id = %(job)s AND j.status = 'running' AND j.locked_by = %(worker)s AND j.attempt = %(attempt)s
  AND j.priority >= %(bg)s          -- đã được nâng mức thì không còn là việc nền, không nhường
  AND q.status = 'queued' AND q.priority < %(bg)s
ORDER BY q.priority, coalesce(q.prioritized_at, q.created_at)
LIMIT 1
"""

YIELD_SQL = """
UPDATE hoso.ocr_jobs
SET status = 'queued', locked_by = NULL, stage = 'preparing', preempted_count = preempted_count + 1
WHERE id = %(job)s AND locked_by = %(worker)s AND attempt = %(attempt)s AND status = 'running'
"""

HEARTBEAT_SQL = """
UPDATE hoso.ocr_jobs
SET heartbeat_at = now(), stage = %(stage)s, processed_pages = %(processed)s, page_count = nullif(%(page_count)s, 0)
WHERE id = %(job)s AND locked_by = %(worker)s AND attempt = %(attempt)s AND status = 'running'
RETURNING status
"""

SAVE_PAGE_SQL = """
INSERT INTO hoso.ocr_pages (job_id, page_no, method, text, native_text, blocks, status, elapsed_seconds)
VALUES (%(job)s, %(page)s, %(method)s, %(text)s, %(native)s, %(blocks)s::jsonb, %(status)s, %(elapsed)s)
ON CONFLICT (job_id, page_no) DO UPDATE
SET method = EXCLUDED.method, text = EXCLUDED.text, native_text = EXCLUDED.native_text,
    blocks = EXCLUDED.blocks, status = EXCLUDED.status, elapsed_seconds = EXCLUDED.elapsed_seconds
"""

FINISH_SQL = """
UPDATE hoso.ocr_jobs
SET status = %(status)s, finished_at = CASE WHEN %(status)s = 'queued' THEN NULL ELSE now() END,
    locked_by = NULL, warnings = %(warnings)s::jsonb, error_message = %(error)s, stage = %(stage)s,
    model_version = coalesce(nullif(%(model_version)s, ''), model_version)
WHERE id = %(job)s AND locked_by = %(worker)s AND attempt = %(attempt)s AND status = 'running'
"""


class PostgresRepository:
    def __init__(self, database_url: str):
        import psycopg  # nạp muộn để kiểm thử không cần thư viện này

        self._psycopg = psycopg
        self._main = psycopg.connect(database_url, autocommit=True, application_name="hoso-ai-worker")
        self._side = psycopg.connect(database_url, autocommit=True, application_name="hoso-ai-worker-heartbeat")
        self._side_lock = threading.Lock()
        self._listening = False

    def close(self) -> None:
        self._main.close()
        self._side.close()

    def _notify(self, conn, channel: str, payload: str) -> None:
        conn.execute("SELECT pg_notify(%s, %s)", (channel, payload))

    def claim(self, worker_id: str, *, exclude_priority_from: int | None = None) -> Job | None:
        row = self._main.execute(CLAIM_SQL, {"worker": worker_id, "exclude_from": exclude_priority_from}).fetchone()
        if row is None:
            return None
        job_id, file_id, document_id, storage_key, sha256, page_count, job_type, options, attempt, priority, preempted = row
        return Job(job_id, file_id, document_id, storage_key, sha256, page_count,
                   JobType(job_type or JobType.READ_CLASSIFY), options or {}, attempt, worker_id, int(priority), int(preempted))

    @contextmanager
    def _owned_job(self, job: Job, worker_id: str | None = None):
        # Khóa hàng tới khi ghi xong: hủy/thu hồi job không thể xen giữa kiểm tra và ghi.
        with self._main.transaction():
            row = self._main.execute(
                "SELECT status, locked_by, attempt FROM hoso.ocr_jobs WHERE id = %s FOR UPDATE", (job.id,)).fetchone()
            if row is not None and row[0] == "cancelled":
                raise JobCancelled(job.id)
            if row != ("running", worker_id or job.worker_id, job.attempt):
                raise JobLost(job.id)
            yield

    def heartbeat(self, job: Job, worker_id: str, progress: Progress) -> None:
        with self._side_lock:
            row = self._side.execute(HEARTBEAT_SQL, {
                "stage": progress.stage.value, "processed": progress.processed_pages,
                "page_count": progress.page_count, "job": job.id, "worker": worker_id, "attempt": job.attempt,
            }).fetchone()
            if row is None:
                state = self._side.execute("SELECT status FROM hoso.ocr_jobs WHERE id = %s", (job.id,)).fetchone()
                if state == ("cancelled",) and worker_id == job.worker_id:
                    raise JobCancelled(job.id)
                raise JobLost(job.id)
            self._notify(self._side, "job_progress", json.dumps({
                "jobId": job.id, "documentId": job.document_id, "stage": progress.stage.value,
                "processed": progress.processed_pages, "pageCount": progress.page_count,
            }))

    def completed_pages(self, job: Job) -> dict[int, PageResult]:
        rows = self._main.execute(
            "SELECT page_no, method, text, native_text, blocks, status, elapsed_seconds FROM hoso.ocr_pages "
            "WHERE job_id = %s AND status = 'completed'", (job.target_job_id,)).fetchall()
        return {r[0]: PageResult(r[0], r[1], r[2], r[3] or "", r[4] or [], r[5], float(r[6] or 0)) for r in rows}

    def save_page(self, job: Job, page: PageResult) -> None:
        with self._owned_job(job):
            self._main.execute(SAVE_PAGE_SQL, {
                "job": job.target_job_id, "page": page.page_no, "method": page.method, "text": page.text,
                "native": page.native_text, "blocks": json.dumps(page.blocks, ensure_ascii=False),
                "status": page.status, "elapsed": page.elapsed_seconds,
            })

    def save_suggestion(self, job: Job, suggestion: Suggestion) -> None:
        with self._owned_job(job):
            suggestion_id = self._main.execute(
                "INSERT INTO hoso.ai_suggestions (job_id, document_id, work_group_code, document_type_code, document_form, "
                "title, reason, quote, evidence_verified, mixed_documents, model_key) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                (job.target_job_id, job.document_id, suggestion.work_group_code, suggestion.document_type_code,
                 suggestion.document_form, suggestion.title, suggestion.reason, suggestion.quote,
                 suggestion.evidence_verified, suggestion.mixed_documents, suggestion.model_key)).fetchone()[0]
            for f in suggestion.fields:
                self._main.execute(
                    "INSERT INTO hoso.ai_field_suggestions (suggestion_id, field_definition_code, value, quote, "
                    "source_pages, quote_verified, source_region, confidence) VALUES (%s,%s,%s,%s,%s,%s,%s::jsonb,%s)",
                    (suggestion_id, f.field_code, f.value, f.quote, list(f.source_pages), f.quote_verified,
                     None if f.source_region is None else json.dumps(f.source_region, ensure_ascii=False),
                     None if f.confidence is None else round(min(1.0, max(0.0, f.confidence)), 4)))

    def save_quality(self, job: Job, page_no: int, flags: tuple[str, ...]) -> None:
        status = "suspect" if flags else "ok"
        with self._owned_job(job):
            self._main.execute(
                "INSERT INTO hoso.page_images (file_id, page_no, quality_flags, quality_status) VALUES (%s,%s,%s,%s) "
                "ON CONFLICT (file_id, page_no) DO UPDATE SET quality_flags = EXCLUDED.quality_flags, "
                "quality_status = CASE WHEN hoso.page_images.quality_status IN ('rescan_required','rescanned') "
                "THEN hoso.page_images.quality_status ELSE EXCLUDED.quality_status END",
                (job.file_id, page_no, list(flags), status))

    def _finish(self, job: Job, worker_id: str, status: str, stage: str, warnings=(), error=None, model_version: str = "") -> None:
        with self._owned_job(job, worker_id):
            self._main.execute(FINISH_SQL, {"status": status, "warnings": json.dumps(list(warnings), ensure_ascii=False),
                                           "error": error, "stage": stage, "job": job.id, "worker": worker_id,
                                           "attempt": job.attempt, "model_version": model_version})
            self._notify(self._main, "job_progress", json.dumps({"jobId": job.id, "documentId": job.document_id, "status": status}))

    def complete(self, job: Job, worker_id: str, warnings: tuple[str, ...], all_pages_read: bool, model_version: str = "") -> None:
        self._finish(job, worker_id, "completed", "done", warnings, model_version=model_version)

    def fail(self, job: Job, worker_id: str, error: str, retry: bool) -> None:
        self._finish(job, worker_id, "queued" if retry else "failed", "preparing" if retry else "failed", error=error[:1500])

    def release(self, job: Job, worker_id: str) -> None:
        self._finish(job, worker_id, "queued", "preparing")

    def priority_of(self, job: Job) -> int:
        with self._side_lock:
            row = self._side.execute("SELECT priority FROM hoso.ocr_jobs WHERE id = %s", (job.id,)).fetchone()
        return int(row[0]) if row else job.priority

    def should_yield(self, job: Job, worker_id: str, background_from: int) -> str | None:
        with self._side_lock:
            row = self._side.execute(YIELD_CHECK_SQL, {"job": job.id, "worker": worker_id, "attempt": job.attempt, "bg": background_from}).fetchone()
        return row[0] if row else None

    def yield_job(self, job: Job, worker_id: str) -> None:
        with self._owned_job(job, worker_id):
            self._main.execute(YIELD_SQL, {"job": job.id, "worker": worker_id, "attempt": job.attempt})
            self._notify(self._main, "job_progress", json.dumps({"jobId": job.id, "documentId": job.document_id, "status": "queued"}))

    def catalog(self) -> Catalog:
        groups = dict(self._main.execute("SELECT code, title FROM hoso.work_groups WHERE active").fetchall())
        rows = self._main.execute(
            "SELECT t.code, t.name, t.work_group_code, f.code, f.label, f.value_type, f.is_key_field "
            "FROM hoso.document_types t LEFT JOIN hoso.field_definitions f ON f.document_type_code = t.code "
            "WHERE t.active AND t.work_group_code IN (SELECT code FROM hoso.work_groups WHERE active) ORDER BY t.code, f.position").fetchall()
        types: dict[str, DocumentTypeDef] = {}
        for code, name, group, f_code, label, value_type, key in rows:
            current = types.get(code) or DocumentTypeDef(code, name, group, ())
            fields = current.fields + (FieldDef(f_code, label, value_type, key),) if f_code else current.fields
            types[code] = DocumentTypeDef(code, name, group, fields)
        return Catalog(groups, types)

    def wait_for_work(self, timeout_seconds: float) -> None:
        with self._side_lock:
            if not self._listening:
                self._side.execute("LISTEN job_queued")
                self._listening = True
        for _ in self._side.notifies(timeout=timeout_seconds, stop_after=1):
            break

    def report_worker(self, report: WorkerReport, changed: bool = False) -> None:
        # Kết nối phụ: vòng chính (lúc rảnh) và luồng heartbeat (lúc đang đọc) cùng gọi; vòng chính đang giữ _main cho job.
        with self._side_lock:
            with self._side.transaction():
                self._side.execute(REPORT_WORKER_SQL, {
                    "worker": report.worker_id, "profile": report.profile, "engine": report.engine, "ok": report.engine_ok,
                    "error": None if report.engine_error is None else report.engine_error[:1000],
                    "since": report.engine_down_since, "job": report.current_job_id,
                })
                if changed:
                    # Dòng của worker đã chết từ lâu (tắt không êm, đổi tên máy) không còn ích gì cho trang vận hành.
                    self._side.execute("DELETE FROM hoso.ai_workers WHERE last_seen_at < now() - interval '7 days'")
                    self._notify(self._side, "ai_worker_status", json.dumps({"workerId": report.worker_id, "engineOk": report.engine_ok}))

    def remove_worker(self, worker_id: str) -> None:
        with self._side_lock:
            self._side.execute("DELETE FROM hoso.ai_workers WHERE worker_id = %s", (worker_id,))
            self._notify(self._side, "ai_worker_status", json.dumps({"workerId": worker_id, "stopped": True}))

    def worker_ids(self, prefix: str) -> list[str]:
        with self._side_lock:
            # left() thay cho LIKE: tên máy có thể chứa '_' (ký tự đại diện của LIKE).
            rows = self._side.execute("SELECT worker_id FROM hoso.ai_workers WHERE left(worker_id, length(%(p)s)) = %(p)s", {"p": prefix}).fetchall()
        return [r[0] for r in rows]
