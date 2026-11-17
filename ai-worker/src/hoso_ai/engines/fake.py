"""Mô hình GIẢ cho HOSO_AI_PROFILE=fake: chạy đủ luồng tiếp nhận khi không có máy AI.

Kết quả luôn ghi rõ là giả lập; không bao giờ dùng ở production.
"""
from __future__ import annotations

from pathlib import Path

from ..contracts import FieldSuggestion, PageResult, Suggestion
from ..queue.repository import Catalog


# Khóa trong bảng ai_models (migration 013); active=false nên giao diện luôn gắn nhãn giả lập.
MODEL_KEY = "fake"


class FakeOcr:
    key = "fake-ocr"
    approx_gb = 0.1

    def __init__(self, fail_pages: set[int] | None = None):
        self.fail_pages = fail_pages or set()
        self.loaded = False
        self.calls: list[str] = []

    def load(self) -> None:
        self.loaded = True

    def unload(self) -> None:
        self.loaded = False

    def read(self, image: Path, timeout_seconds: int) -> tuple[str, list]:
        self.calls.append(image.name)
        page = int(image.stem.split("-")[-1])
        if page in self.fail_pages:
            raise RuntimeError(f"OCR giả lỗi ở trang {page}")
        return f"[GIẢ LẬP] Nội dung OCR trang {page}", []


class FakeClassifier:
    key = "fake-classifier"
    approx_gb = 0.1

    def __init__(self):
        self.loaded = False

    def load(self) -> None:
        self.loaded = True

    def unload(self) -> None:
        self.loaded = False

    def suggest(self, pages: list[PageResult], catalog: Catalog, prompt_style: str = "production") -> Suggestion:
        doc_type = next(iter(catalog.document_types.values()), None)
        fields = tuple(
            FieldSuggestion(f.code, f.label, "", "", (), False) for f in (doc_type.fields if doc_type else ())
        )
        return Suggestion(
            model_key=MODEL_KEY,
            work_group_code=doc_type.work_group_code if doc_type else None,
            document_type_code=doc_type.code if doc_type else None,
            document_form="Chưa xác định",
            title="[GIẢ LẬP] Gợi ý thử, không phải kết quả AI",
            reason="Chế độ HOSO_AI_PROFILE=fake",
            quote="",
            evidence_verified=False,
            mixed_documents=False,
            fields=fields,
        )
