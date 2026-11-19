"""Vòng lặp worker: lấy job → xử lý → ghi kết quả; heartbeat chạy nền; tắt an toàn khi nhận SIGTERM."""
from __future__ import annotations

import os
import socket
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable

from . import logging as log
from .contracts import Job, Progress, Stage
from .engines.base import EngineUnavailable, Engines
from .pipeline import DocumentPipeline, JobTimeout, JobYielded, WorkerStopping
from .queue.repository import JobCancelled, JobLost, JobRepository, WorkerReport
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
    # Máy chạy mô hình (Ollama ở máy khác) có đang trả lời không (AI-24). Mô hình nằm trong worker thì chỉ đổi khi job gặp EngineUnavailable.
    engine_ok: bool = True
    engine_error: str | None = None
    engine_down_since: float | None = None


def _process_alive(pid: int) -> bool:
    """Tiến trình pid còn trên máy này không (tín hiệu 0 chỉ kiểm, không gửi gì). Không có quyền gửi tín hiệu nghĩa là vẫn còn."""
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


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
        # AI-24. Ghi trạng thái vào ai_workers mỗi chừng này giây (API coi worker im lặng quá 2 phút là đã dừng).
        # Thăm dò máy chạy mô hình lúc rảnh: thưa khi nó đang trả lời, dày khi nó đang hỏng để nhận việc lại sớm khi nó trở lại.
        self.report_seconds = 30.0
        self.probe_ok_seconds = 60.0
        self.probe_down_seconds = 10.0
        self._last_report = float("-inf")
        self._last_probe = float("-inf")
        self.engines = engines
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
        self._probe_engine(force=True)          # biết máy AI có trả lời không trước khi nhận việc đầu tiên
        self._report(changed=True)              # có mặt trên trang vận hành ngay khi khởi động
        self._prune_dead_siblings()
        try:
            while not self.stop.is_set():
                self.state.last_loop_at = time.time()
                if not self.run_once():
                    self.idle_tick()
                    wait = self.settings.poll_seconds if self.state.engine_ok else min(self.settings.poll_seconds, self.probe_down_seconds)
                    self.repo.wait_for_work(wait)
        finally:
            self.scheduler.unload_all()
            try:
                self.repo.remove_worker(self.settings.worker_id)
            except Exception:
                log.warning("worker_remove_failed", exc_info=True, worker=self.settings.worker_id)
            log.info("worker_stopped", worker=self.settings.worker_id)

    def idle_tick(self) -> None:
        """Lúc rảnh: thăm dò máy chạy mô hình (nếu ở nơi khác) và ghi trạng thái định kỳ vào ai_workers."""
        self._probe_engine()
        self._report()

    def run_once(self) -> bool:
        """Xử lý tối đa một job. Trả False khi hàng đợi trống hoặc đang đợi máy chạy mô hình trả lời lại."""
        if self.engines.probe is not None and not self.state.engine_ok:
            # Máy AI đang hỏng: để việc nằm yên trong hàng (không nhận rồi trả lại mỗi 30 giây làm trạng thái nhảy qua lại),
            # idle_tick thăm dò tới khi nó trở lại.
            return False
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
            self._engine_up()       # đọc xong một job là máy chạy mô hình đang trả lời
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
            self._engine_down(str(error))
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
            self._report()      # job dài (nhiều trang) không làm worker trông như đã im lặng trên trang vận hành
            try:
                self.repo.heartbeat(job, self.settings.worker_id, progress)
            except (JobCancelled, JobLost):
                return  # pipeline sẽ tự gặp lại ở lần beat tiếp theo
            except Exception:
                log.warning("heartbeat_failed", job_id=job.id)

    # --- AI-24: trạng thái máy chạy mô hình và dòng ai_workers ---------------------------------

    def _probe_engine(self, force: bool = False) -> None:
        if self.engines.probe is None:
            return
        interval = self.probe_ok_seconds if self.state.engine_ok else self.probe_down_seconds
        if not force and time.monotonic() - self._last_probe < interval:
            return
        self._last_probe = time.monotonic()
        try:
            self.engines.probe()
        except Exception as error:      # EngineUnavailable hay lỗi lạ khi hỏi máy kia: đều là "chưa dùng được", worker không được chết vì nó
            self._engine_down(str(error) if isinstance(error, EngineUnavailable) else f"{type(error).__name__}: {error}")
            return
        self._engine_up()

    def _engine_down(self, error: str) -> None:
        state, was_ok = self.state, self.state.engine_ok
        state.engine_ok, state.engine_error = False, error[:1000]
        if was_ok:
            state.engine_down_since = time.time()
            log.warning("engine_down", worker=self.settings.worker_id, engine=self.engines.engine, error=state.engine_error)
        self._report(changed=was_ok)

    def _engine_up(self) -> None:
        state = self.state
        if state.engine_ok:
            return
        down_seconds = round(time.time() - (state.engine_down_since or time.time()))
        state.engine_ok, state.engine_error, state.engine_down_since = True, None, None
        self._engine_retry_at = 0.0         # nhận việc lại ngay, không đợi hết khoảng chờ
        log.info("engine_back", worker=self.settings.worker_id, engine=self.engines.engine, down_seconds=down_seconds)
        self._report(changed=True)

    def _prune_dead_siblings(self) -> None:
        """Worker bị giết (kill -9, máy treo) không kịp xóa dòng của mình; supervise.sh/launchd chạy lại nó với pid mới, nên trang vận hành
        đọng thêm một dòng "im lặng". Lúc khởi động, xóa dòng của worker CÙNG MÁY (mã "<tên máy>-<pid>") mà tiến trình pid đó không còn.
        Mã đặt tay (HOSO_AI_WORKER_ID) thì chạy lại vẫn ghi đè đúng dòng cũ, không cần dọn."""
        prefix = f"{socket.gethostname()}-"
        if not self.settings.worker_id.startswith(prefix):
            return
        try:
            for other in self.repo.worker_ids(prefix):
                pid = other[len(prefix):]
                if other != self.settings.worker_id and pid.isdigit() and not _process_alive(int(pid)):
                    self.repo.remove_worker(other)
                    log.info("dead_worker_pruned", worker=self.settings.worker_id, removed=other)
        except Exception:
            log.warning("dead_worker_prune_failed", exc_info=True, worker=self.settings.worker_id)

    def _report(self, changed: bool = False) -> None:
        now = time.monotonic()
        if not changed and now - self._last_report < self.report_seconds:
            return
        self._last_report = now
        s = self.state
        try:
            self.repo.report_worker(WorkerReport(self.settings.worker_id, self.settings.profile, self.engines.engine, s.engine_ok,
                                                 s.engine_error, s.engine_down_since, s.current_job), changed)
        except Exception:      # mất CSDL thì vòng chính cũng sẽ gặp; ở đây chỉ không được làm hỏng việc đang làm
            log.warning("worker_report_failed", exc_info=True, worker=self.settings.worker_id)
