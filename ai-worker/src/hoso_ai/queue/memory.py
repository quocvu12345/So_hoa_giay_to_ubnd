"""Kho job trong bộ nhớ: dùng cho kiểm thử và lệnh `hoso-ai once` (không cần DB)."""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field, replace

from ..contracts import Job, JobStatus, PageResult, Progress, Suggestion
from .repository import Catalog, JobCancelled, JobLost, WorkerReport


@dataclass
class _Row:
    job: Job
    status: JobStatus = JobStatus.QUEUED
    locked_by: str | None = None
    progress: list[Progress] = field(default_factory=list)
    error: str | None = None
    warnings: tuple[str, ...] = ()
    all_pages_read: bool = False
    model_version: str = ""
    preempted: int = 0
    prioritized_seq: int | None = None      # thứ tự nâng mức (thay cho prioritized_at)


class InMemoryRepository:
    def __init__(self, catalog: Catalog | None = None):
        self.rows: dict[str, _Row] = {}
        self.pages: dict[str, dict[int, PageResult]] = {}
        self.suggestions: dict[str, Suggestion] = {}
        self.quality: dict[tuple[str, int], tuple[str, ...]] = {}
        self._catalog = catalog or Catalog(work_groups={}, document_types={})
        self._lock = threading.Lock()
        self._order: list[str] = []
        self.workers: dict[str, WorkerReport] = {}          # ai_workers: dòng hiện tại của từng worker
        self.worker_changes: list[WorkerReport] = []        # các lần báo đổi trạng thái (NOTIFY ai_worker_status)

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
    def set_priority(self, job_id: str, priority: int) -> None:
        """Như người dùng bấm "Trích xuất ngay": đổi mức và xếp theo lúc nâng."""
        with self._lock:
            row = self.rows[job_id]
            row.job = replace(row.job, priority=priority)
            row.prioritized_seq = len(self._order) + sum(1 for r in self.rows.values() if r.prioritized_seq is not None) + 1

    def _queue_key(self, job_id: str) -> tuple:
        row = self.rows[job_id]
        return (row.job.priority, row.prioritized_seq if row.prioritized_seq is not None else self._order.index(job_id))

    def claim(self, worker_id: str, *, exclude_priority_from: int | None = None) -> Job | None:
        with self._lock:
            eligible = [j for j in self._order if self.rows[j].status is JobStatus.QUEUED
                        and (exclude_priority_from is None or self.rows[j].job.priority < exclude_priority_from)]
            if not eligible:
                return None
            row = self.rows[min(eligible, key=self._queue_key)]
            row.status, row.locked_by = JobStatus.RUNNING, worker_id
            row.job = replace(row.job, attempt=row.job.attempt + 1, worker_id=worker_id)
            return row.job

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

    def complete(self, job: Job, worker_id: str, warnings: tuple[str, ...], all_pages_read: bool, model_version: str = "") -> None:
        row = self.rows[job.id]
        row.status, row.locked_by, row.warnings, row.all_pages_read = JobStatus.COMPLETED, None, warnings, all_pages_read
        row.model_version = model_version or row.model_version

    def fail(self, job: Job, worker_id: str, error: str, retry: bool) -> None:
        row = self.rows[job.id]
        row.error, row.locked_by = error, None
        row.status = JobStatus.QUEUED if retry else JobStatus.FAILED

    def release(self, job: Job, worker_id: str) -> None:
        row = self.rows[job.id]
        if row.status is JobStatus.RUNNING:
            row.status, row.locked_by = JobStatus.QUEUED, None

    def priority_of(self, job: Job) -> int:
        with self._lock:
            return self.rows[job.id].job.priority

    def should_yield(self, job: Job, worker_id: str, background_from: int) -> str | None:
        with self._lock:
            row = self.rows[job.id]
            if row.status is not JobStatus.RUNNING or row.locked_by != worker_id or row.job.priority < background_from:
                return None
            waiting = [j for j in self._order if self.rows[j].status is JobStatus.QUEUED and self.rows[j].job.priority < background_from]
            return min(waiting, key=self._queue_key) if waiting else None

    def yield_job(self, job: Job, worker_id: str) -> None:
        with self._lock:
            row = self.rows[job.id]
            if row.status is JobStatus.RUNNING and row.locked_by == worker_id:
                row.status, row.locked_by, row.preempted = JobStatus.QUEUED, None, row.preempted + 1
                row.job = replace(row.job, preempted=row.job.preempted + 1)

    def catalog(self) -> Catalog:
        return self._catalog

    def wait_for_work(self, timeout_seconds: float) -> None:
        time.sleep(min(timeout_seconds, 0.01))

    def report_worker(self, report: WorkerReport, changed: bool = False) -> None:
        with self._lock:
            self.workers[report.worker_id] = report
            if changed:
                self.worker_changes.append(report)

    def remove_worker(self, worker_id: str) -> None:
        with self._lock:
            self.workers.pop(worker_id, None)

    def worker_ids(self, prefix: str) -> list[str]:
        with self._lock:
            return [w for w in self.workers if w.startswith(prefix)]
