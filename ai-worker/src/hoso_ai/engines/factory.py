"""Chọn bộ engine theo HOSO_AI_PROFILE."""
from __future__ import annotations

from ..settings import Settings
from .base import Engines
from .pdfium import PdfiumReader
from .quality import PillowQualityChecker


def build_engines(settings: Settings) -> Engines:
    if settings.profile == "fake":
        from .fake import FakeClassifier, FakeOcr

        return Engines(PdfiumReader(),
                       FakeOcr(page_seconds=settings.fake_page_seconds, fail_rate=settings.fake_fail_rate),
                       FakeClassifier(seconds=settings.fake_classify_seconds, mixed_from_pages=settings.fake_mixed_from_pages),
                       PillowQualityChecker())
    if settings.profile == "mac-mlx":
        from ..settings import SettingsError
        from .mlx import PaddleVlMlxOcr, QwenMlxClassifier

        try:
            classifier = QwenMlxClassifier(settings.classifier_model)
        except (FileNotFoundError, ValueError) as error:
            raise SettingsError(str(error)) from error
        return Engines(PdfiumReader(), PaddleVlMlxOcr(settings.work_root / "mlx"), classifier, PillowQualityChecker())
    raise NotImplementedError(
        f"Hồ sơ {settings.profile!r} chưa làm (task AI-11): PaddleOCR trên CUDA/CPU, LLM qua máy chủ tương thích OpenAI cục bộ.")
