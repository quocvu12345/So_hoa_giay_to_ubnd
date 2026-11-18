"""Interface của từng công đoạn. Mỗi hồ sơ phần cứng (mac-mlx, linux-cuda, cpu, fake) cung cấp bản cài riêng."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from ..contracts import PageInfo, PageResult, Suggestion
from ..queue.repository import Catalog


class EngineUnavailable(RuntimeError):
    """Máy chạy mô hình không trả lời (mất mạng, máy tắt, thiếu mô hình trên máy đó). Không phải lỗi của tài liệu:
    pipeline không ghi trang lỗi, worker trả job về hàng đợi và đợi một lúc rồi mới lấy việc tiếp."""


class PdfReader(Protocol):
    def inspect(self, pdf: Path, max_pages: int) -> list[PageInfo]:
        """Đếm trang, lấy lớp chữ có sẵn, biết trang nào chứa ảnh."""

    def render(self, pdf: Path, page_no: int, out_dir: Path) -> Path:
        """Xuất một trang thành PNG (cạnh dài tối đa 2400 px) để OCR và kiểm tra ảnh."""


class OcrEngine(Protocol):
    key: str
    approx_gb: float

    def load(self) -> None: ...

    def unload(self) -> None: ...

    def read(self, image: Path, timeout_seconds: int) -> tuple[str, list]:
        """Trả (văn bản, các khối bố cục). Ném lỗi nếu không đọc được trang."""


class Classifier(Protocol):
    key: str
    approx_gb: float

    def load(self) -> None: ...

    def unload(self) -> None: ...

    def suggest(self, pages: list[PageResult], catalog: Catalog, prompt_style: str = "production") -> Suggestion:
        """Gợi ý nhóm, loại, trường. Chỉ trả giá trị có trích dẫn thật trong văn bản. prompt_style: production | short."""


class QualityChecker(Protocol):
    def check(self, image: Path) -> tuple[str, ...]:
        """Cờ chất lượng: blank, blurry, skewed, cropped. Không tự xóa trang."""


@dataclass(frozen=True)
class Engines:
    reader: PdfReader
    ocr: OcrEngine
    classifier: Classifier
    quality: QualityChecker | None
