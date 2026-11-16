"""Kiểm tra ảnh trang bằng Pillow (không cần OpenCV). Ngưỡng cần hiệu chỉnh trên bản quét thật (AI-07)."""
from __future__ import annotations

from pathlib import Path


class PillowQualityChecker:
    def __init__(self, blank_ink_ratio: float = 0.002, blur_edge_variance: float = 40.0):
        self.blank_ink_ratio = blank_ink_ratio
        self.blur_edge_variance = blur_edge_variance

    def check(self, image: Path) -> tuple[str, ...]:
        from PIL import Image, ImageFilter, ImageStat

        flags: list[str] = []
        with Image.open(image) as source:
            gray = source.convert("L")
            gray.thumbnail((1200, 1200))
            histogram = gray.histogram()
            dark = sum(histogram[:160])
            ink_ratio = dark / max(1, gray.width * gray.height)
            if ink_ratio < self.blank_ink_ratio:
                flags.append("blank")
            else:
                edges = gray.filter(ImageFilter.FIND_EDGES)
                if ImageStat.Stat(edges).var[0] < self.blur_edge_variance:
                    flags.append("blurry")
        return tuple(flags)
