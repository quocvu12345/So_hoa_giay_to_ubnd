"""Vòng lặp worker: lấy job → xử lý → ghi kết quả; heartbeat chạy nền; tắt an toàn khi nhận SIGTERM."""
from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable

from . import logging as log
from .contracts import Job, Progress, Stage
from .engines.base import EngineUnavailable, Engines
from .pipeline import DocumentPipeline, JobTimeout, JobYielded, WorkerStopping
from .queue.repository import JobCancelled, JobLost, JobRepository
from .runtime.scheduler import ModelScheduler
from .runtime.watchdog import EXIT_STUCK
from .runtime.windows import BackgroundWindows
from .settings import Settings
from .storage import LocalBlobStorage, StorageError


@dataclass
class WorkerState:
    """Số liệu cho /health và /metrics."""
    started_at: float = field(default_factory=time.time)
    last_loop_at: float = field(default_factory=time.time)
    current_job: str | None = None
    jobs: dict[str, int] = field(default_factory=lambda: {"completed": 0, "failed": 0, "retried": 0, "cancelled": 0, "released": 0, "yielded": 0,
                                                          "engine_unavailable": 0})
    pages: dict[str, int] = field(default_factory=lambda: {"pdf_text": 0, "ocr": 0, "failed": 0})
    ocr_seconds_total: float = 0.0


def should_retry(job: Job, max_attempts: int, error: Exception) -> bool:
    """Lỗi do tệp (hỏng, sai mã băm, quá nhiều trang) thì không thử lại; lỗi máy thì thử lại tới max_attempts (không tính các lần nhường chỗ)."""
    if isinstance(error, (StorageError, ValueError)):
        return False
    return job.attempt - job.preempted < max_attempts


class Worker:
    def __init__(self, settings: Settings, repo: JobRepository, engines: Engines, storage: LocalBlobStorage,
                 scheduler: ModelScheduler, state: WorkerState | None = None, stop: threading.Event | None = None,
                 now: Callable[[], datetime] = datetime.now, exit_fn: Callable[[int], None] = os._exit):
        self.settings = settings
        self.exit_fn = exit_fn
        # Vòng lặp rảnh phải quay ít nhất mỗi poll_seconds; quá lâu hơn nhiều là kẹt (xem stuck_reason). Tắt máy êm không được quá 180 giây.
        self.idle_stuck_seconds = max(120.0, settings.poll_seconds * 8)
        self.shutdown_grace_seconds = 180.0
        # Máy chạy mô hình (Ollama ở máy khác) không trả lời: trả job về hàng đợi rồi ngừng lấy việc chừng này giây.
        self.engine_retry_seconds = max(30.0, settings.poll_seconds * 2)
        self._engine_retry_at = 0.0
        self._stop_seen_at: float | None = None
        self.windows = BackgroundWindows.parse(settings.background_windows)
        self.now = now
        self.repo = repo
        self.storage = storage
        self.scheduler = scheduler
        self.state = state or WorkerState()
        self.stop = stop or threading.Event()
        self.pipeline = DocumentPipeline(engines, scheduler, repo, settings, settings.worker_id, self.stop)

    def stuck_reason(self, now_ts: float) -> str | None:
        """Lý do worker coi là KẸT, hoặc None. Phần đang xử lý job đã có Watchdog theo từng thao tác (AI-08); đây là lớp ngoài cùng cho phần còn lại:
        vòng lặp rảnh không quay (nghẽn ở lấy việc, đợi thông báo, ghi log, nạp/bỏ mô hình...) và tắt máy không kết thúc."""
        if self.stop.is_set():
            self._stop_seen_at = self._stop_seen_at or now_ts
            if now_ts - self._stop_seen_at > self.shutdown_grace_seconds:
                return f"tắt máy quá {self.shutdown_grace_seconds:.0f} giây"
            return None
        if self.state.current_job is None and now_ts - self.state.last_loop_at > self.idle_stuck_seconds:
            return f"vòng lặp rảnh không quay {now_ts - self.state.last_loop_at:.0f} giây"
        return None

    def _loop_watchdog(self, interval: float = 5.0) -> None:
        while True:
            time.sleep(interval)
            reason = self.stuck_reason(time.time())
            if reason:
                log.error("worker_loop_stuck", reason=reason, worker=self.settings.worker_id)
                self.exit_fn(EXIT_STUCK)       # launchd/systemd chạy lại; job dở dang được thu hồi sau khi mất nhịp sống
                return

    def run_forever(self) -> None:
        log.info("worker_started", worker=self.settings.worker_id, profile=self.settings.profile,
                 model_budget_gb=self.settings.model_budget_gb)
        threading.Thread(target=self._loop_watchdog, name="loop-watchdog", daemon=True).start()
        try:
            while not self.stop.is_set():
                self.state.last_loop_at = time.time()
                if not self.run_once():
                    self.repo.wait_for_work(self.settings.poll_seconds)
        finally:
            self.scheduler.unload_all()
            log.info("worker_stopped", worker=self.settings.worker_id)

    def run_once(self) -> bool:
        """Xử lý tối đa một job. Trả False khi hàng đợi trống hoặc đang đợi máy chạy mô hình trả lời lại."""
        if time.monotonic() < self._engine_retry_at:
            return False
        # Ngoài khung giờ khay nền chỉ lấy việc có người đang chờ; việc nền để lại cho lúc được phép.
        background_open = self.windows.is_open(self.now())
        job = self.repo.claim(self.settings.worker_id, exclude_priority_from=None if background_open else self.settings.background_from)
        if job is None:
            return False
        self.process(job)
        return True

    def process(self, job: Job) -> None:
        self.state.current_job = job.id
        self.pipeline.last_progress = None
        fields = {"job_id": job.id, "document_id": job.document_id, "job_type": job.job_type.value,
                  "attempt": job.attempt, "correlation_id": job.correlation_id}
        log.info("job_started", **fields)
        beating = threading.Event()
        heartbeat = threading.Thread(target=self._heartbeat_loop, args=(job, beating), daemon=True)
        heartbeat.start()
        try:
            pdf = self.storage.open_verified(job.storage_key, job.sha256)
            outcome = self.pipeline.run(job, pdf)
            self.repo.complete(job, self.settings.worker_id, outcome.warnings, outcome.all_pages_read, outcome.model_version)
            self.state.jobs["completed"] += 1
            self.state.pages["pdf_text"] += outcome.pages_text
            self.state.pages["ocr"] += outcome.pages_ocr
            self.state.pages["failed"] += outcome.pages_failed
            self.state.ocr_seconds_total += outcome.ocr_seconds
            log.info("job_completed", **fields, page_count=outcome.page_count, pages_text=outcome.pages_text,
                     pages_ocr=outcome.pages_ocr, pages_failed=outcome.pages_failed, classified=outcome.classified,
                     ocr_seconds=outcome.ocr_seconds, classify_seconds=outcome.classify_seconds, elapsed_seconds=outcome.elapsed_seconds,
                     warnings_count=len(outcome.warnings))
        except JobCancelled:
            self.state.jobs["cancelled"] += 1
            log.info("job_cancelled", **fields)
        except JobLost:
            log.warning("job_lost", **fields)
        except JobYielded as yielded:
            try:
                self.repo.yield_job(job, self.settings.worker_id)
                self.state.jobs["yielded"] += 1
                log.info("job_yielded", **fields, for_job_id=yielded.for_job_id, priority=job.priority)
            except (JobCancelled, JobLost):
                log.info("job_no_longer_owned", **fields)
        except EngineUnavailable as error:
            # Không tính là một lần thử (như nhường chỗ): máy AI tắt cả buổi thì job vẫn đợi trong hàng, không thành "lỗi" sau 3 lần.
            self._engine_retry_at = time.monotonic() + self.engine_retry_seconds
            try:
                self.repo.yield_job(job, self.settings.worker_id)
                self.state.jobs["engine_unavailable"] += 1
                log.warning("engine_unavailable", **fields, error=str(error), retry_in_seconds=self.engine_retry_seconds)
            except (JobCancelled, JobLost):
                log.info("job_no_longer_owned", **fields)
        except WorkerStopping:
            try:
                self.repo.release(job, self.settings.worker_id)
                self.state.jobs["released"] += 1
                log.info("job_released", **fields)
            except (JobCancelled, JobLost):
                log.info("job_no_longer_owned", **fields)
        except Exception as error:
            retry = should_retry(job, self.settings.max_attempts, error)
            message = str(error) if isinstance(error, (StorageError, ValueError, JobTimeout)) else \
                "Chưa đọc được PDF do lỗi hệ thống; đã ghi nhật ký."
            try:
                self.repo.fail(job, self.settings.worker_id, message, retry)
                self.state.jobs["retried" if retry else "failed"] += 1
                log.error("job_failed", exc_info=True, **fields, error_type=type(error).__name__, retry=retry)
            except (JobCancelled, JobLost):
                log.info("job_no_longer_owned", **fields)
        finally:
            beating.set()
            heartbeat.join(timeout=5)
            self.state.last_loop_at = time.time()       # trước khi bỏ current_job, để watchdog không lấy thời gian của cả job làm thời gian kẹt
            self.state.current_job = None

    def _heartbeat_loop(self, job: Job, done: threading.Event) -> None:
        """Giữ job khỏi bị thu hồi khi một trang OCR chạy lâu hơn chu kỳ heartbeat."""
        while not done.wait(self.settings.heartbeat_seconds):
            progress = self.pipeline.last_progress or Progress(Stage.PREPARING, 0, job.page_count)
            try:
                self.repo.heartbeat(job, self.settings.worker_id, progress)
            except (JobCancelled, JobLost):
                return  # pipeline sẽ tự gặp lại ở lần beat tiếp theo
            except Exception:
                log.warning("heartbeat_failed", job_id=job.id)
