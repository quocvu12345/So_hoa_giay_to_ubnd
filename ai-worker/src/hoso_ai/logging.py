"""Log JSON một dòng ra stdout, cùng định dạng với API và web (docs/06-log-va-giam-sat.md).

Không bao giờ ghi nội dung trang, giá trị trường hay tên tệp gốc: chỉ id, số đếm, thời gian.
"""
from __future__ import annotations

import json
import logging
import os
import re
import sys
from datetime import datetime, timezone

_REDACT = re.compile(r"authorization|cookie|token|password|secret|cccd|cmnd|so_dinh_danh|text|value|quote", re.I)
_MAX = 2000


def _sanitize(value, depth=0):
    if depth > 4:
        return "[…]"
    if isinstance(value, str):
        return value if len(value) <= _MAX else value[:_MAX] + "…"
    if isinstance(value, dict):
        # Khóa nhạy cảm bị ẩn, trừ khi giá trị là số/bool (bộ đếm như pages_text không chứa nội dung giấy tờ).
        return {k: "[đã ẩn]" if _REDACT.search(str(k)) and not isinstance(v, (int, float, bool)) else _sanitize(v, depth + 1) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_sanitize(v, depth + 1) for v in value[:50]]
    return value


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        line = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            "level": record.levelname.lower(),
            "service": "hoso-ai-worker",
            "env": os.environ.get("HOSO_ENV", "development"),
            "event": record.getMessage(),
            **_sanitize(getattr(record, "fields", {})),
        }
        if record.exc_info:
            line["exception"] = self.formatException(record.exc_info)[-4000:]
        return json.dumps(line, ensure_ascii=False, default=str)


def setup(level: str | None = None) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel((level or os.environ.get("HOSO_AI_LOG_LEVEL", "INFO")).upper())
    # Thư viện bên dưới (httpx của PaddleOCR gọi MLX nội bộ) ghi mỗi request; chỉ giữ cảnh báo.
    for noisy in ("httpx", "httpcore", "urllib3", "paddlex", "PIL"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


_log = logging.getLogger("hoso_ai")


def event(level: int, name: str, *, exc_info: bool = False, **fields) -> None:
    """Ghi một sự kiện: info("job_completed", job_id=..., pages=...)."""
    _log.log(level, name, extra={"fields": fields}, exc_info=exc_info)


def info(name: str, **fields) -> None:
    event(logging.INFO, name, **fields)


def warning(name: str, **fields) -> None:
    event(logging.WARNING, name, **fields)


def error(name: str, *, exc_info: bool = False, **fields) -> None:
    event(logging.ERROR, name, exc_info=exc_info, **fields)
