"""Xử lý một job: lớp chữ PDF → OCR các trang còn lại → gợi ý loại và trường → kiểm tra ảnh.

- Lưu kết quả từng trang ngay khi xong: tắt máy giữa chừng thì lần sau chỉ đọc trang còn thiếu.
- Mỗi trang xong gửi heartbeat; người dùng hủy thì dừng sau trang đang đọc.
- Một trang lỗi không làm hỏng cả job: trang đó ghi "failed", job vẫn hoàn tất kèm cảnh báo.
- Ảnh trang xuất ra chỉ là tệp tạm, xóa khi job kết thúc.
"""
from __future__ import annotations

import shutil
import threading
import time
from pathlib import Path

from . import logging as log
from .contracts import Job, JobOutcome, JobStatus, JobType, PageResult, Progress, Stage
from .engines.base import Engines
from .queue.repository import JobCancelled, JobLost, JobRepository
from .runtime.scheduler import ModelScheduler
from .runtime.watchdog import Watchdog
from .settings import Settings


class WorkerStopping(Exception):
    """Worker đang tắt: trả job về hàng đợi, giữ các trang đã đọc."""


class JobYielded(Exception):
    """Job nền nhường chỗ cho việc ưu tiên đang chờ: trả về hàng đợi, giữ các trang đã đọc, không tính là một lần thử (AI-15)."""

    def __init__(self, job_id: str, for_job_id: str):
        super().__init__(job_id)
        self.for_job_id = for_job_id


class JobTimeout(Exception):
    pass


class DocumentPipeline:
    def __init__(self, engines: Engines, scheduler: ModelScheduler, repo: JobRepository,
                 settings: Settings, worker_id: str, stop: threading.Event | None = None, watchdog: Watchdog | None = None):
        self.engines = engines
        self.scheduler = scheduler
        self.repo = repo
        self.settings = settings
        self.worker_id = worker_id
        self.stop = stop or threading.Event()
        self.watchdog = watchdog or Watchdog()
        self.last_progress: Progress | None = None

    def run(self, job: Job, pdf: Path) -> JobOutcome:
        started = time.monotonic()
        workdir = self.settings.work_root / job.id
        workdir.mkdir(parents=True, exist_ok=True)
        warnings: list[str] = []
        try:
            with self.watchdog.guard(max(60, self.settings.page_timeout_seconds), "inspect"):
                infos = self.engines.reader.inspect(pdf, self.settings.max_pages)
            page_count = len(infos)
            deadline = started + max(600, page_count * self.settings.page_timeout_seconds)
            done = self.repo.completed_pages(job)
            self._beat(job, Stage.READING_TEXT, len(done), page_count, deadline=deadline)

            wanted = self._wanted_pages(job, page_count)
            force_ocr = bool(job.options.get("force_ocr")) or job.job_type is JobType.REREAD_PAGE
            pages_text = 0
            to_ocr = []
            for info in infos:
                if info.page_no not in wanted:
                    continue
                if info.page_no in done and job.job_type is not JobType.REREAD_PAGE:
                    continue
                if info.text_layer_is_clean and not force_ocr:
                    self.repo.save_page(job, PageResult(info.page_no, "pdf_text", info.native_text, info.native_text))
                    pages_text += 1
                else:
                    to_ocr.append(info)

            processed = len(self.repo.completed_pages(job))
            pages_ocr = pages_failed = 0
            ocr_seconds = 0.0
            if to_ocr:
                self._beat(job, Stage.LOADING_OCR, processed, page_count, deadline=deadline)
                with self.scheduler.use(self.engines.ocr) as ocr:
                    for info in to_ocr:
                        with self.watchdog.guard(self.settings.page_timeout_seconds, "render"):
                            image = self.engines.reader.render(pdf, info.page_no, workdir)
                        if self.engines.quality is not None:
                            self.repo.save_quality(job, info.page_no, self.engines.quality.check(image))
                        page_started = time.monotonic()
                        try:
                            with self.watchdog.guard(self.settings.page_timeout_seconds, "ocr"):     # AI-08: cưỡng chế thật (thoát tiến trình), không chỉ truyền tham số
                                text, blocks = ocr.read(image, self.settings.page_timeout_seconds)
                            elapsed = round(time.monotonic() - page_started, 2)
                            status = "completed" if text.strip() else "empty"
                            page = PageResult(info.page_no, "ocr", text, info.native_text, blocks, status, elapsed)
                            if status == "empty":
                                warnings.append(f"Trang {info.page_no}: không đọc được chữ; cần xem bản gốc.")
                        except Exception as error:  # một trang lỗi không dừng cả job
                            elapsed = round(time.monotonic() - page_started, 2)
                            page = PageResult(info.page_no, "failed", info.native_text, info.native_text, [], "failed",
                                              elapsed, f"{type(error).__name__}: {error}"[:1000])
                            warnings.append(f"Trang {info.page_no}: OCR lỗi, có thể đọc lại riêng trang này.")
                            pages_failed += 1
                            log.warning("page_failed", job_id=job.id, page=info.page_no, error_type=type(error).__name__)
                        ocr_seconds += elapsed
                        pages_ocr += 1
                        self.repo.save_page(job, page)
                        image.unlink(missing_ok=True)
                        processed = len(self.repo.completed_pages(job))
                        self._beat(job, Stage.OCR, processed, page_count, page_no=info.page_no, deadline=deadline)
                        self._yield_if_needed(job)     # chỉ nhường ở ranh giới trang: trang vừa đọc đã được lưu

            completed = self.repo.completed_pages(job)
            all_read = len(completed) == page_count
            classified = False
            classify_seconds = 0.0
            # Việc có người đang chờ dùng lời nhắc nhanh; khay nền không ai chờ nên dùng lời nhắc chính xác hơn (cấu hình HOSO_AI_PROMPT_*).
            # Mức hiện tại, không phải mức lúc lấy việc: bấm "Trích xuất ngay" khi job đang chạy thì phần phân loại còn lại dùng lời nhắc nhanh.
            prompt_style = self.settings.prompt_background if self.repo.priority_of(job) >= self.settings.background_from else self.settings.prompt_interactive
            if job.options.get("classify", True):
                self._yield_if_needed(job)
                self._beat(job, Stage.CLASSIFYING, len(completed), page_count, deadline=deadline)
                readable = [completed[n] for n in sorted(completed) if completed[n].text.strip()]
                if readable:
                    with self.scheduler.use(self.engines.classifier) as classifier:
                        classify_started = time.monotonic()
                        try:
                            with self.watchdog.guard(self.settings.page_timeout_seconds * 2, "classify"):
                                suggestion = classifier.suggest(readable, self.repo.catalog(), prompt_style=prompt_style)
                            self.repo.save_suggestion(job, suggestion)
                            warnings.extend(suggestion.warnings)
                            classified = True
                            classify_seconds = round(time.monotonic() - classify_started, 2)
                        except (JobCancelled, JobLost):
                            raise
                        except Exception as error:
                            warnings.append("Chưa gợi ý được loại hồ sơ; cán bộ chọn tay.")
                            log.warning("classify_failed", job_id=job.id, error_type=type(error).__name__)
                else:
                    warnings.append("Không có nội dung đọc được để gợi ý loại hồ sơ.")

            self._beat(job, Stage.DONE, len(completed), page_count, deadline=deadline)
            return JobOutcome(JobStatus.COMPLETED, page_count, pages_text, pages_ocr, pages_failed, all_read,
                              classified, tuple(warnings), round(ocr_seconds, 2), round(time.monotonic() - started, 2),
                              self._model_version(pages_ocr > 0 or any(p.method == "ocr" for p in completed.values()), classified, prompt_style), classify_seconds)
        finally:
            shutil.rmtree(workdir, ignore_errors=True)

    def _yield_if_needed(self, job: Job) -> None:
        if job.priority < self.settings.background_from:
            return      # việc có người chờ không bao giờ nhường
        other = self.repo.should_yield(job, self.worker_id, self.settings.background_from)
        if other:
            raise JobYielded(job.id, other)

    def _model_version(self, used_ocr: bool, used_classifier: bool, prompt_style: str) -> str:
        """Mô hình thật sự đã dùng cho job này (không ghi OCR nếu mọi trang lấy từ lớp chữ PDF). Trang đã OCR ở lần chạy trước (job từng nhường chỗ hoặc bị ngắt) vẫn tính."""
        parts = []
        if used_ocr:
            parts.append(f"ocr={getattr(self.engines.ocr, 'version', self.engines.ocr.key)}")
        if used_classifier:
            parts.append(f"classifier={getattr(self.engines.classifier, 'version', self.engines.classifier.key)}/{prompt_style}")
        return " ".join(parts)

    @staticmethod
    def _wanted_pages(job: Job, page_count: int) -> set[int]:
        if job.job_type is JobType.RECLASSIFY:
            return set()
        if job.job_type is JobType.REREAD_PAGE:
            return {int(p) for p in job.options.get("pages", []) if 1 <= int(p) <= page_count}
        return set(range(1, page_count + 1))

    def _beat(self, job: Job, stage: Stage, processed: int, page_count: int, *, deadline: float, page_no: int | None = None) -> None:
        if self.stop.is_set():
            raise WorkerStopping(job.id)
        if time.monotonic() > deadline:
            raise JobTimeout(f"Quá thời gian xử lý job ({page_count} trang). Các trang đã đọc vẫn được giữ.")
        self.last_progress = Progress(stage, processed, page_count, page_no)
        self.repo.heartbeat(job, self.worker_id, self.last_progress)
