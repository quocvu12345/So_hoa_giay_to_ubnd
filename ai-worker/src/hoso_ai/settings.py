"""Cấu hình đọc từ biến môi trường HOSO_AI_*; sai thì dừng ngay với thông báo rõ."""
from __future__ import annotations

import os
import socket
from dataclasses import dataclass
from pathlib import Path

# mac-mlx: Mac Apple Silicon (MLX). linux-cuda, cpu: máy chủ Linux (task AI-11).
# fake: mô hình giả, cho đội backend/frontend chạy đủ luồng khi không có máy AI.
PROFILES = ("mac-mlx", "linux-cuda", "cpu", "fake")


class SettingsError(ValueError):
    pass


@dataclass(frozen=True)
class Settings:
    profile: str
    database_url: str | None
    storage_root: Path
    work_root: Path
    worker_id: str
    model_budget_gb: float
    poll_seconds: float
    heartbeat_seconds: float
    max_attempts: int
    max_pages: int
    page_timeout_seconds: int
    http_port: int | None
    document_ai_home: Path
    classifier_model: str | None = None     # tên thư mục mô hình phân loại (None: mặc định của document_ai)
    background_from: int = 7                # job có ocr_jobs.priority từ mức này trở lên là khay nền
    prompt_interactive: str = "short"        # kiểu lời nhắc trích trường cho việc có người đang chờ (production | short)
    prompt_background: str = "production"   # ... cho việc khay nền
    background_windows: str = ""             # khung giờ khay nền được chạy (runtime/windows.py); rỗng: bất cứ lúc nào rảnh

    @classmethod
    def from_env(cls, env: dict[str, str] | None = None) -> "Settings":
        env = dict(os.environ if env is None else env)
        profile = env.get("HOSO_AI_PROFILE", "fake")
        if profile not in PROFILES:
            raise SettingsError(f"HOSO_AI_PROFILE không hợp lệ: {profile!r}. Dùng một trong {', '.join(PROFILES)}.")

        def number(name: str, default: float, minimum: float) -> float:
            raw = env.get(name)
            try:
                value = float(raw) if raw not in (None, "") else default
            except ValueError as error:
                raise SettingsError(f"{name} phải là số, đang là {raw!r}.") from error
            if value < minimum:
                raise SettingsError(f"{name} phải ≥ {minimum}.")
            return value

        def style(name: str, default: str) -> str:
            value = env.get(name) or default
            if value not in ("production", "short"):
                raise SettingsError(f"{name} phải là production hoặc short, đang là {value!r}.")
            return value

        def windows() -> str:
            from .runtime.windows import BackgroundWindows

            text = env.get("HOSO_AI_BACKGROUND_WINDOWS", "")
            try:
                BackgroundWindows.parse(text)
            except ValueError as error:
                raise SettingsError(f"HOSO_AI_BACKGROUND_WINDOWS: {error}") from error
            return text

        port = env.get("HOSO_AI_HTTP_PORT", "9108")
        return cls(
            profile=profile,
            database_url=env.get("HOSO_AI_DATABASE_URL") or None,
            storage_root=Path(env.get("HOSO_AI_STORAGE_ROOT", "data/blobs")).resolve(),
            work_root=Path(env.get("HOSO_AI_WORK_ROOT", "data/ai-work")).resolve(),
            worker_id=env.get("HOSO_AI_WORKER_ID") or f"{socket.gethostname()}-{os.getpid()}",
            # Mac 16 GB: chừa RAM cho hệ điều hành. 7 GB đủ giữ cùng lúc OCR (ước 4,5 GB) và Qwen3-1.7B (ước 2 GB) để không nạp lại OCR mỗi job.
            # Dùng mô hình phân loại lớn hơn (ví dụ Qwen3-4B, 3 GB) thì đặt 8 trở lên hoặc chấp nhận nạp lại OCR giữa các job.
            model_budget_gb=number("HOSO_AI_MODEL_BUDGET_GB", 7, 1),
            poll_seconds=number("HOSO_AI_POLL_SECONDS", 15, 1),
            heartbeat_seconds=number("HOSO_AI_HEARTBEAT_SECONDS", 30, 5),
            max_attempts=int(number("HOSO_AI_MAX_ATTEMPTS", 3, 1)),
            max_pages=int(number("HOSO_AI_MAX_PAGES", 500, 1)),
            page_timeout_seconds=int(number("HOSO_AI_PAGE_TIMEOUT_SECONDS", 300, 10)),
            http_port=int(port) if port and port != "0" else None,
            document_ai_home=Path(env.get("DOCUMENT_AI_HOME", "/Volumes/quocDisk/AI/paddleocr")),
            classifier_model=env.get("HOSO_AI_CLASSIFIER_MODEL") or None,
            background_from=int(number("HOSO_AI_BACKGROUND_FROM", 7, 2)),
            prompt_interactive=style("HOSO_AI_PROMPT_INTERACTIVE", "short"),
            prompt_background=style("HOSO_AI_PROMPT_BACKGROUND", "production"),
            background_windows=windows(),
        )

    def require_database(self) -> str:
        if not self.database_url:
            raise SettingsError("Thiếu HOSO_AI_DATABASE_URL (role hoso_ai_worker). Lệnh 'once' không cần DB.")
        return self.database_url
