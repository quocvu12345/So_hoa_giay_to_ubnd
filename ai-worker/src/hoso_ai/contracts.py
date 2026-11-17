"""Kiểu dữ liệu trao đổi giữa worker và PostgreSQL (docs/03-thiet-ke-csdl.md, nhóm F)."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobType(StrEnum):
    READ_CLASSIFY = "read_classify"   # đọc mọi trang rồi gợi ý loại và trường
    REREAD_PAGE = "reread_page"       # đọc lại một số trang của job cũ (options.pages, options.target_job_id)
    RECLASSIFY = "reclassify"         # chỉ gợi ý lại từ trang đã đọc


class Stage(StrEnum):
    PREPARING = "preparing"
    READING_TEXT = "reading_text"
    LOADING_OCR = "loading_ocr"
    OCR = "ocr"
    CLASSIFYING = "classifying"
    QUALITY = "quality"
    DONE = "done"


@dataclass(frozen=True)
class Job:
    id: str
    file_id: str
    document_id: str
    storage_key: str
    sha256: str
    page_count: int
    job_type: JobType = JobType.READ_CLASSIFY
    options: dict = field(default_factory=dict)
    attempt: int = 0   # số lần đã được lấy chạy, tăng khi claim
    worker_id: str | None = None
    priority: int = 5  # số nhỏ chạy trước: 1 làm ngay, 3 tương tác, 7 khay nền (ocr_jobs.priority)
    preempted: int = 0 # số lần đã nhường chỗ; số lần thử THẬT = attempt - preempted

    @property
    def correlation_id(self) -> str | None:
        return self.options.get("correlation_id")

    @property
    def target_job_id(self) -> str:
        """Job giữ kết quả trang. Đọc lại trang thì ghi vào job gốc."""
        return self.options.get("target_job_id", self.id)


@dataclass(frozen=True)
class PageInfo:
    page_no: int
    native_text: str
    has_images: bool

    @property
    def text_layer_is_clean(self) -> bool:
        """Chỉ tin lớp chữ khi đủ dài, ít ký tự lỗi và trang không chứa ảnh (ảnh có thể chứa chữ khác)."""
        text = self.native_text
        return len(text) >= 80 and text.count("�") < len(text) * 0.01 and not self.has_images


@dataclass
class PageResult:
    page_no: int
    method: str                     # pdf_text | ocr | failed
    text: str
    native_text: str = ""
    blocks: list = field(default_factory=list)
    status: str = "completed"       # completed | empty | failed
    elapsed_seconds: float = 0.0
    error: str | None = None


@dataclass(frozen=True)
class FieldSuggestion:
    field_code: str
    label: str
    value: str
    quote: str
    source_pages: tuple[int, ...]
    quote_verified: bool


@dataclass(frozen=True)
class Suggestion:
    model_key: str
    work_group_code: str | None
    document_type_code: str | None
    document_form: str
    title: str
    reason: str
    quote: str
    evidence_verified: bool
    mixed_documents: bool
    fields: tuple[FieldSuggestion, ...] = ()
    warnings: tuple[str, ...] = ()


@dataclass(frozen=True)
class Progress:
    stage: Stage
    processed_pages: int
    page_count: int
    page_no: int | None = None


@dataclass(frozen=True)
class JobOutcome:
    status: JobStatus
    page_count: int
    pages_text: int          # trang lấy chữ trực tiếp từ PDF
    pages_ocr: int           # trang phải OCR trong lần chạy này
    pages_failed: int
    all_pages_read: bool
    classified: bool
    warnings: tuple[str, ...]
    ocr_seconds: float
    elapsed_seconds: float
    model_version: str = ""      # ví dụ "ocr=PaddleOCR-VL-1.6@132c45f classifier=Qwen3-1.7B-4bit@3b1b176/short"
    classify_seconds: float = 0.0  # thời gian bước phân loại và trích trường (không gồm OCR)
