"""Giữ mô hình trong bộ nhớ theo ngân sách RAM/VRAM.

Mac M4 16 GB: ngân sách mặc định 6 GB nên chỉ một mô hình lớn mỗi lúc (OCR rồi mới phân loại).
Máy chủ GPU lớn: đặt ngân sách cao để giữ cả hai, không phải nạp lại giữa các job.
Mô hình được nạp một lần và giữ lại giữa các job (khác bản thí điểm: nạp lại mỗi PDF).
"""
from __future__ import annotations

import threading
import time
from contextlib import contextmanager
from typing import Iterator, Protocol

from .. import logging as log


class Loadable(Protocol):
    key: str
    approx_gb: float

    def load(self) -> None: ...

    def unload(self) -> None: ...


class ModelScheduler:
    def __init__(self, budget_gb: float):
        self.budget_gb = budget_gb
        self._loaded: dict[str, Loadable] = {}
        self._last_used: dict[str, float] = {}
        self._lock = threading.Lock()

    @property
    def loaded(self) -> tuple[str, ...]:
        return tuple(self._loaded)

    @contextmanager
    def use(self, model: Loadable) -> Iterator[Loadable]:
        with self._lock:
            if model.key not in self._loaded:
                self._make_room(model)
                started = time.monotonic()
                model.load()
                self._loaded[model.key] = model
                log.info("model_loaded", model=model.key, seconds=round(time.monotonic() - started, 2))
            self._last_used[model.key] = time.monotonic()
        yield model

    def _make_room(self, incoming: Loadable) -> None:
        used = sum(m.approx_gb for m in self._loaded.values())
        # Bỏ mô hình dùng lâu nhất trước cho tới khi đủ chỗ (luôn cho phép ít nhất một mô hình).
        for key in sorted(self._loaded, key=lambda k: self._last_used.get(k, 0)):
            if used + incoming.approx_gb <= self.budget_gb:
                break
            victim = self._loaded.pop(key)
            victim.unload()
            used -= victim.approx_gb
            log.info("model_unloaded", model=key, reason="budget")

    def unload_all(self) -> None:
        with self._lock:
            for key, model in list(self._loaded.items()):
                model.unload()
                self._loaded.pop(key)
