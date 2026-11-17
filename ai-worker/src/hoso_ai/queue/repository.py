"""Giao kèo giữa worker và nơi lưu job. Bản thật: PostgreSQL; bản kiểm thử: bộ nhớ."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from ..contracts import Job, PageResult, Progress, Suggestion


class JobCancelled(Exception):
    """Người dùng hủy job (API đặt status='cancelled'); dừng sau trang đang đọc."""


class JobLost(Exception):
    """Job không còn thuộc worker này (bị thu hồi vì heartbeat quá hạn); dừng ngay, không ghi tiếp."""


@dataclass(frozen=True)
class FieldDef:
    code: str
    label: str
    value_type: str
    is_key_field: bool = False


@dataclass(frozen=True)
class DocumentTypeDef:
    code: str
    name: str
    work_group_code: str
    fields: tuple[FieldDef, ...]


@dataclass(frozen=True)
class Catalog:
    """Danh mục lấy từ DB (work_groups, document_types, field_definitions), không đọc tệp JS của bản thí điểm."""
    work_groups: dict[str, str]                    # code → title
    document_types: dict[str, DocumentTypeDef]     # code → định nghĩa


class JobRepository(Protocol):
    def claim(self, worker_id: str, *, exclude_priority_from: int | None = None) -> Job | None:
        """Lấy một job queued (mức ưu tiên nhỏ trước, rồi lúc nâng mức hoặc lúc tạo) và đánh dấu running cho worker này.
        exclude_priority_from: bỏ qua việc có mức từ giá trị này trở lên (khay nền ngoài khung giờ); None: lấy mọi việc."""

    def priority_of(self, job: Job) -> int:
        """Mức ưu tiên HIỆN TẠI của job (người dùng có thể nâng mức khi job đang chạy, lúc đó job nên dùng lời nhắc nhanh)."""

    def should_yield(self, job: Job, worker_id: str, background_from: int) -> str | None:
        """Job nền đang chạy có nên nhường chỗ không: trả mã job ưu tiên đang chờ, hoặc None. Job đã được nâng mức thì không nhường."""

    def yield_job(self, job: Job, worker_id: str) -> None:
        """Trả job nền về hàng đợi để nhường chỗ: giữ các trang đã đọc, KHÔNG tính vào số lần thử lại (tăng preempted_count; attempt vẫn tăng đều làm mã chống nhầm chủ)."""

    def heartbeat(self, job: Job, worker_id: str, progress: Progress) -> None:
        """Cập nhật tiến độ + heartbeat và NOTIFY. Ném JobCancelled hoặc JobLost khi cần dừng."""

    def completed_pages(self, job: Job) -> dict[int, PageResult]:
        """Trang đã đọc xong của job đích, để chạy tiếp mà không đọc lại."""

    def save_page(self, job: Job, page: PageResult) -> None: ...

    def save_suggestion(self, job: Job, suggestion: Suggestion) -> None: ...

    def save_quality(self, job: Job, page_no: int, flags: tuple[str, ...]) -> None: ...

    def complete(self, job: Job, worker_id: str, warnings: tuple[str, ...], all_pages_read: bool, model_version: str = "") -> None:
        """model_version: mô hình đã dùng cho job này (ghi vào ocr_jobs.model_version); rỗng thì giữ giá trị cũ."""

    def fail(self, job: Job, worker_id: str, error: str, retry: bool) -> None:
        """retry=True: trả về queued để chạy lại; False: failed."""

    def release(self, job: Job, worker_id: str) -> None:
        """Worker tắt giữa chừng: trả job về queued, giữ các trang đã đọc."""

    def catalog(self) -> Catalog: ...

    def wait_for_work(self, timeout_seconds: float) -> None:
        """Ngủ tới khi có NOTIFY job_queued hoặc hết thời gian."""
