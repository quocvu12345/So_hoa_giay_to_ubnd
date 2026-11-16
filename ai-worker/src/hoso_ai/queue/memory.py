"""Kho job trong bộ nhớ: dùng cho kiểm thử và lệnh `hoso-ai once` (không cần DB)."""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field, replace

from ..contracts import Job, JobStatus, PageResult, Progress, Suggestion
from .repository import Catalog, JobCancelled, JobLost


@dataclass
class _Row:
    job: Job
    status: JobStatus = JobStatus.QUEUED
    locked_by: str | None = None
    progress: list[Progress] = field(default_factory=list)
    error: str | None = None
    warnings: tuple[str, ...] = ()
    all_pages_read: bool = False


class InMemoryRepository:
    def __init__(self, catalog: Catalog | None = None):
        self.rows: dict[str, _Row] = {}
        self.pages: dict[str, dict[int, PageResult]] = {}
        self.suggestions: dict[str, Suggestion] = {}
        self.quality: dict[tuple[str, int], tuple[str, ...]] = {}
        self._catalog = catalog or Catalog(work_groups={}, document_types={})
        self._lock = threading.Lock()
        self._order: list[str] = []

    # --- tiện ích kiểm thử -------------------------------------------------
    def enqueue(self, job: Job) -> None:
        with self._lock:
            self.rows[job.id] = _Row(job)
            self._order.append(job.id)

    def cancel(self, job_id: str) -> None:
        with self._lock:
            self.rows[job_id].status = JobStatus.CANCELLED

    def status(self, job_id: str) -> JobStatus:
        return self.rows[job_id].status

    # --- JobRepository -----------------------------------------------------
    def claim(self, worker_id: str) -> Job | None:
        with self._lock:
            for job_id in self._order:
                row = self.rows[job_id]
                if row.status is JobStatus.QUEUED:
                    row.status, row.locked_by = JobStatus.RUNNING, worker_id
                    row.job = replace(row.job, attempt=row.job.attempt + 1)
                    return row.job
        return None

    def heartbeat(self, job: Job, worker_id: str, progress: Progress) -> None:
        with self._lock:
            row = self.rows[job.id]
            if row.status is JobStatus.CANCELLED:
                raise JobCancelled(job.id)
            if row.locked_by != worker_id or row.status is not JobStatus.RUNNING:
                raise JobLost(job.id)
            row.progress.append(progress)

    def completed_pages(self, job: Job) -> dict[int, PageResult]:
        pages = self.pages.get(job.target_job_id, {})
        return {n: p for n, p in pages.items() if p.status == "completed"}

    def save_page(self, job: Job, page: PageResult) -> None:
        self.pages.setdefault(job.target_job_id, {})[page.page_no] = page

    def save_suggestion(self, job: Job, suggestion: Suggestion) -> None:
        self.suggestions[job.target_job_id] = suggestion

    def save_quality(self, job: Job, page_no: int, flags: tuple[str, ...]) -> None:
        self.quality[(job.file_id, page_no)] = flags

    def complete(self, job: Job, worker_id: str, warnings: tuple[str, ...], all_pages_read: bool) -> None:
        row = self.rows[job.id]
        row.status, row.locked_by, row.warnings, row.all_pages_read = JobStatus.COMPLETED, None, warnings, all_pages_read

    def fail(self, job: Job, worker_id: str, error: str, retry: bool) -> None:
        row = self.rows[job.id]
        row.error, row.locked_by = error, None
        row.status = JobStatus.QUEUED if retry else JobStatus.FAILED

    def release(self, job: Job, worker_id: str) -> None:
        row = self.rows[job.id]
        if row.status is JobStatus.RUNNING:
            row.status, row.locked_by = JobStatus.QUEUED, None

    def catalog(self) -> Catalog:
        return self._catalog

    def wait_for_work(self, timeout_seconds: float) -> None:
        time.sleep(min(timeout_seconds, 0.01))
