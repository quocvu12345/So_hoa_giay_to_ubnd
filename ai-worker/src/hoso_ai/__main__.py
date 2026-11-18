"""Dòng lệnh: hoso-ai run | once --pdf FILE | status"""
from __future__ import annotations

import argparse
import faulthandler
import json
import signal
import sys
import threading
import uuid
from pathlib import Path

from . import logging as log
from .contracts import Job
from .engines.factory import build_engines
from .pipeline import DocumentPipeline
from .queue.memory import InMemoryRepository
from .runtime.scheduler import ModelScheduler
from .settings import Settings, SettingsError
from .storage import LocalBlobStorage
from .worker import Worker, WorkerState


def cmd_run(settings: Settings) -> int:
    from .status_http import start_status_server
    from .queue.postgres import PostgresRepository

    # `kill -USR1 <pid>` ghi vết ngăn xếp của mọi luồng ra nhật ký: cách duy nhất để biết worker đang kẹt ở đâu (không có py-spy trên máy dịch vụ).
    faulthandler.register(signal.SIGUSR1, all_threads=True)
    stop = threading.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: stop.set())
    repo = PostgresRepository(settings.require_database())
    scheduler = ModelScheduler(settings.model_budget_gb)
    state = WorkerState()
    if settings.http_port:
        start_status_server(settings.http_port, state, scheduler, settings)
    try:
        Worker(settings, repo, build_engines(settings), LocalBlobStorage(settings.storage_root), scheduler, state, stop).run_forever()
    finally:
        repo.close()
    return 0


def cmd_once(settings: Settings, pdf: Path, classify: bool, force_ocr: bool, show_text: bool) -> int:
    """Đọc một PDF trên máy, không cần DB hay kho tệp: dùng để thử mô hình và đo tốc độ."""
    catalog = None
    if settings.profile in ("mac-mlx", "fake"):
        from .engines.mlx import catalog_from_pilot     # chỉ đọc tệp danh mục JS, không nạp MLX

        catalog = catalog_from_pilot()
    repo = InMemoryRepository(catalog)
    job = Job(id=uuid.uuid4().hex, file_id="local", document_id="local", storage_key="", sha256="", page_count=0,
              options={"classify": classify, "force_ocr": force_ocr})
    repo.enqueue(job)
    job = repo.claim("once")
    pipeline = DocumentPipeline(build_engines(settings), ModelScheduler(settings.model_budget_gb), repo, settings, "once")
    outcome = pipeline.run(job, pdf.resolve())
    pages = repo.pages.get(job.id, {})
    suggestion = repo.suggestions.get(job.id)
    print(json.dumps({
        "outcome": outcome.__dict__ | {"status": outcome.status.value},
        "pages": [{"page": p.page_no, "method": p.method, "status": p.status, "chars": len(p.text),
                   "seconds": p.elapsed_seconds, **({"text": p.text} if show_text else {})} for p in sorted(pages.values(), key=lambda p: p.page_no)],
        "suggestion": None if suggestion is None else {
            "model": suggestion.model_key, "workGroup": suggestion.work_group_code, "documentType": suggestion.document_type_code,
            "documentForm": suggestion.document_form, "evidenceVerified": suggestion.evidence_verified,
            "fieldsWithValue": sum(1 for f in suggestion.fields if f.value), "warnings": list(suggestion.warnings),
            **({"title": suggestion.title, "reason": suggestion.reason, "mixedDocuments": suggestion.mixed_documents,
                "fields": [{"label": f.label, "value": f.value, "quote": f.quote, "pages": list(f.source_pages),
                            "region": f.source_region, "confidence": f.confidence} for f in suggestion.fields if f.value]}
               if show_text else {})},
        "quality": {str(k[1]): list(v) for k, v in repo.quality.items()},
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_status(settings: Settings) -> int:
    info = {"profile": settings.profile, "worker": settings.worker_id, "modelBudgetGb": settings.model_budget_gb,
            "database": bool(settings.database_url), "storageRoot": str(settings.storage_root)}
    if settings.profile == "mac-mlx":
        from document_ai.config import readiness

        info["models"] = readiness()
    print(json.dumps(info, ensure_ascii=False, indent=2))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="hoso-ai", description="Worker AI cục bộ của Hồ sơ số")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("run", help="Chạy liên tục, lấy job từ PostgreSQL")
    once = sub.add_parser("once", help="Đọc một PDF trên máy, in kết quả tóm tắt")
    once.add_argument("--pdf", type=Path, required=True)
    once.add_argument("--no-classify", action="store_true")
    once.add_argument("--force-ocr", action="store_true")
    once.add_argument("--show-text", action="store_true", help="In cả nội dung đã đọc (chỉ dùng khi thử trên máy)")
    sub.add_parser("status", help="Cấu hình và tình trạng mô hình")
    args = parser.parse_args(argv)

    log.setup()
    try:
        settings = Settings.from_env()
    except SettingsError as error:
        print(f"Cấu hình sai: {error}", file=sys.stderr)
        return 2
    if args.command == "run":
        return cmd_run(settings)
    if args.command == "once":
        return cmd_once(settings, args.pdf, not args.no_classify, args.force_ocr, args.show_text)
    return cmd_status(settings)


if __name__ == "__main__":
    raise SystemExit(main())
