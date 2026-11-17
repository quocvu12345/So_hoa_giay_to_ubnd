"""Ghi nhận tiến trình mô hình khác để không nhầm thời gian có tranh GPU là đo độc lập."""
from datetime import datetime, timezone
import os
from pathlib import Path
import threading

import psutil


def model_process_kind(args):
    """Xét entrypoint, không nhầm tệp đưa cho py_compile/pytest thành inference."""
    if not args:
        return None
    executable = Path(args[0]).name.lower()
    if not executable.startswith("python"):
        return None
    tail = list(args[1:])
    while tail and tail[0] in {"-u", "-B", "-E", "-I", "-s", "-S", "-O", "-OO"}:
        tail.pop(0)
    if not tail or "--help" in tail or "-h" in tail:
        return None
    modules = {"hoso_ai", "document_ai.vlm:app", "mlx_lm.server", "mlx_vlm.server",
               "document_ai.field_extract", "document_ai.convert_ifstruct", "document_ai.convert_qwen", "document_ai.convert_nuextract"}
    if tail[0] == "-m" and len(tail) > 1:
        module = tail[1]
        if module == "hoso_ai":
            return module if len(tail) > 2 and tail[2] in {"run", "once"} else None
        if module == "uvicorn" and "document_ai.vlm:app" in tail[2:]:
            return "document_ai.vlm:app"
        return module if module in modules else None
    script = Path(tail[0]).name
    if script in {"bench_fields.py", "probe_bkee.py"}:
        return script
    if script == "bench_pipeline.py" and len(tail) > 1 and tail[1] in {"llm", "ocr", "coresident"}:
        return script
    return None


def model_processes():
    found = []
    for process in psutil.process_iter(["pid", "cmdline"]):
        if process.pid == os.getpid():
            continue
        args = process.info["cmdline"] or []
        kind = model_process_kind(args)
        if kind:
            # Không ghi toàn bộ dòng lệnh vì model server có thể nhận khóa qua tham số.
            found.append({"pid": process.pid, "kind": kind})
    return found


class ModelActivity:
    def __init__(self, require_idle=False):
        self.require_idle = require_idle
        self.events = {}
        self.errors = []
        self.lock = threading.Lock()
        self.stopped = threading.Event()
        self.thread = None

    def observe(self):
        timestamp = datetime.now(timezone.utc).isoformat()
        found = model_processes()
        with self.lock:
            for row in found:
                key = (row["pid"], row["kind"])
                self.events.setdefault(key, {**row, "first_seen": timestamp})["last_seen"] = timestamp
        return found

    def __enter__(self):
        found = self.observe()
        if self.require_idle and found:
            raise RuntimeError(f"Còn tiến trình mô hình khác; chưa bắt đầu benchmark: {found}")
        def poll():
            while not self.stopped.wait(1):
                try:
                    self.observe()
                except Exception as error:
                    with self.lock:
                        self.errors.append(f"{type(error).__name__}: {error}")
        self.thread = threading.Thread(target=poll, daemon=True)
        self.thread.start()
        return self

    def report(self):
        with self.lock:
            return {"require_idle_at_start": self.require_idle,
                    "other_model_processes_detected": bool(self.events),
                    "events": [dict(v) for v in self.events.values()], "monitoring_errors": list(self.errors)}

    def __exit__(self, *_):
        self.stopped.set()
        if self.thread:
            self.thread.join(timeout=3)
        self.observe()
