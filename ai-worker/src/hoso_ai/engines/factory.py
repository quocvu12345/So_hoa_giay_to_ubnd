"""Chọn bộ engine theo HOSO_AI_PROFILE."""
from __future__ import annotations

from ..settings import Settings
from .base import Engines
from .pdfium import PdfiumReader
from .quality import PillowQualityChecker


def build_engines(settings: Settings) -> Engines:
    if settings.profile == "fake":
        from .fake import FakeClassifier, FakeOcr

        return Engines(PdfiumReader(), FakeOcr(), FakeClassifier(), PillowQualityChecker())
    if settings.profile == "mac-mlx":
        from .mlx import PaddleVlMlxOcr, QwenMlxClassifier

        return Engines(PdfiumReader(), PaddleVlMlxOcr(settings.work_root / "mlx"), QwenMlxClassifier(), PillowQualityChecker())
    raise NotImplementedError(
        f"Hồ sơ {settings.profile!r} chưa làm (task AI-11): PaddleOCR trên CUDA/CPU, LLM qua máy chủ tương thích OpenAI cục bộ.")
