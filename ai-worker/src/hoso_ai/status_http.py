"""Cổng nội bộ cho giám sát: /health và /metrics (định dạng Prometheus).

Chỉ nghe 127.0.0.1; không có endpoint nhận job hay tài liệu (job đi qua PostgreSQL, ADR-04).
"""
from __future__ import annotations

import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .runtime.scheduler import ModelScheduler
from .settings import Settings
from .worker import WorkerState


def render_metrics(state: WorkerState, scheduler: ModelScheduler) -> str:
    lines = [
        "# HELP hoso_ai_jobs_total Số job theo kết quả.",
        "# TYPE hoso_ai_jobs_total counter",
        *[f'hoso_ai_jobs_total{{result="{k}"}} {v}' for k, v in state.jobs.items()],
        "# HELP hoso_ai_pages_total Số trang theo cách đọc.",
        "# TYPE hoso_ai_pages_total counter",
        *[f'hoso_ai_pages_total{{method="{k}"}} {v}' for k, v in state.pages.items()],
        "# HELP hoso_ai_ocr_seconds_total Tổng thời gian OCR.",
        "# TYPE hoso_ai_ocr_seconds_total counter",
        f"hoso_ai_ocr_seconds_total {state.ocr_seconds_total:.2f}",
        "# HELP hoso_ai_busy 1 khi đang xử lý job.",
        "# TYPE hoso_ai_busy gauge",
        f"hoso_ai_busy {1 if state.current_job else 0}",
        "# HELP hoso_ai_model_loaded Mô hình đang nằm trong bộ nhớ.",
        "# TYPE hoso_ai_model_loaded gauge",
        *[f'hoso_ai_model_loaded{{model="{m}"}} 1' for m in scheduler.loaded],
        "# HELP hoso_ai_last_loop_age_seconds Thời gian từ vòng lặp gần nhất.",
        "# TYPE hoso_ai_last_loop_age_seconds gauge",
        f"hoso_ai_last_loop_age_seconds {time.time() - state.last_loop_at:.1f}",
    ]
    return "\n".join(lines) + "\n"


def health(state: WorkerState, scheduler: ModelScheduler, settings: Settings) -> tuple[int, dict]:
    age = time.time() - state.last_loop_at
    stale = state.current_job is None and age > settings.poll_seconds * 4
    body = {
        "status": "stale" if stale else "ok",
        "worker": settings.worker_id,
        "profile": settings.profile,
        "currentJob": state.current_job,
        "loadedModels": list(scheduler.loaded),
        "lastLoopSecondsAgo": round(age, 1),
    }
    return (503 if stale else 200), body


def start_status_server(port: int, state: WorkerState, scheduler: ModelScheduler, settings: Settings) -> ThreadingHTTPServer:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802 (tên do http.server quy định)
            if self.path == "/health":
                status, body = health(state, scheduler, settings)
                payload, content_type = json.dumps(body, ensure_ascii=False).encode(), "application/json; charset=utf-8"
            elif self.path == "/metrics":
                status, payload, content_type = 200, render_metrics(state, scheduler).encode(), "text/plain; version=0.0.4"
            else:
                status, payload, content_type = 404, b"", "text/plain"
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *args):  # không ghi log truy cập của cổng giám sát
            pass

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    threading.Thread(target=server.serve_forever, daemon=True, name="status-http").start()
    return server
