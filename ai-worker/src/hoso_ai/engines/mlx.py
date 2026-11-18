"""Mac Apple Silicon: dùng lại đúng mã đã kiểm thử của document_ai/ (PaddleOCR-VL 1.6 + Qwen3 qua MLX).

Khác bản thí điểm: mô hình được nạp một lần và giữ lại giữa các job (ModelScheduler quyết định khi nào bỏ).
TODO(AI-01): chuyển mã từ document_ai/ vào gói này khi bỏ bản thí điểm; hiện import để chỉ có một nguồn.
"""
from __future__ import annotations

import gc
from contextlib import ExitStack
from pathlib import Path

from ..contracts import PageResult, Suggestion
from ..regions import blocks_with_regions
from ..queue.repository import Catalog, DocumentTypeDef, FieldDef


def catalog_from_pilot() -> Catalog:
    """Danh mục từ assets/danh-muc-ho-so.js của bản thí điểm, chỉ cho lệnh `once` khi chưa có DB.
    Mã trường dùng nhãn vì tệp JS không có mã trường."""
    from document_ai.classify import catalog

    groups, types = {}, {}
    for category in catalog():
        groups[category["code"]] = category["title"]
        for t in category["documentTypes"]:
            fields = tuple(FieldDef(label, label, "text") for label in t.get("fields", []))
            types[t["id"]] = DocumentTypeDef(t["id"], t["name"], category["code"], fields)
    return Catalog(groups, types)


class PaddleVlMlxOcr:
    key = "ocr"
    approx_gb = 4.5   # PaddleOCR-VL-1.6 (MLX) + PP-DocLayoutV3 + PP-LCNet, đo lại ở AI-12
    version = "PaddleOCR-VL-1.6@132c45f"

    def __init__(self, work_dir: Path):
        self.work_dir = work_dir
        self._stack: ExitStack | None = None
        self._pipeline = None

    def load(self) -> None:
        import os

        import document_ai
        from document_ai.config import local_environment, model_path
        from document_ai.worker import vlm_server

        # Máy chủ MLX là tiến trình con (`uvicorn document_ai.vlm:app`): nó phải tìm thấy gói document_ai
        # dù worker được chạy từ thư mục nào (launchd, systemd, script huấn luyện).
        package_root = str(Path(document_ai.__file__).resolve().parents[1])
        existing = os.environ.get("PYTHONPATH", "")
        if package_root not in existing.split(os.pathsep):
            os.environ["PYTHONPATH"] = package_root + (os.pathsep + existing if existing else "")
        os.environ.update(local_environment())
        self.work_dir.mkdir(parents=True, exist_ok=True)
        self._stack = ExitStack()
        server_url = self._stack.enter_context(vlm_server(self.work_dir))
        from paddleocr import PaddleOCRVL

        self._pipeline = PaddleOCRVL(
            pipeline_version="v1.6", device="cpu", cpu_threads=4,
            layout_detection_model_dir=str(model_path("layout")),
            doc_orientation_classify_model_dir=str(model_path("orientation")),
            use_doc_orientation_classify=True, use_doc_unwarping=False,
            vl_rec_backend="mlx-vlm-server", vl_rec_server_url=server_url + "/v1",
            vl_rec_api_model_name=str(model_path("ocr")), vl_rec_max_concurrency=1,
            use_queues=False, use_seal_recognition=True, use_ocr_for_image_block=True,
            markdown_ignore_labels=[],
        )

    def unload(self) -> None:
        self._pipeline = None
        if self._stack is not None:
            self._stack.close()
            self._stack = None
        gc.collect()

    def read(self, image: Path, timeout_seconds: int) -> tuple[str, list]:
        # Hạn thời gian do pipeline cưỡng chế bằng Watchdog (runtime/watchdog.py): quá hạn thì tiến trình thoát và job được thu hồi.
        result = next(iter(self._pipeline.predict(str(image), max_new_tokens=4096)))
        data = result.json.get("res", result.json)
        blocks = blocks_with_regions(data)      # AI-21: kèm vùng theo tỉ lệ trang để sau này tìm vùng nguồn của trường
        text = "\n\n".join(str(b.get("block_content", "")) for b in blocks).strip()
        return text, blocks


class QwenMlxClassifier:
    """Phân loại và trích trường bằng Qwen (MLX). Mô hình chọn bằng HOSO_AI_CLASSIFIER_MODEL (tên thư mục trong models/), nạp MỘT lần và giữ giữa các job."""
    key = "classifier"

    def __init__(self, model_name: str | None = None):
        from document_ai.config import check_classifier, classifier_approx_gb, classifier_name, model_version

        self.model_name = model_name or classifier_name()
        self.approx_gb = classifier_approx_gb(self.model_name)
        self.version = model_version(check_classifier(self.model_name))    # thiếu mô hình thì dừng ngay lúc khởi động, không đợi job đầu tiên
        self._llm = None

    def load(self) -> None:
        # Áp dụng cả khi PDF có lớp chữ và không cần nạp OCR trước đó.
        import os
        from document_ai.classify import load_classifier
        from document_ai.config import local_environment

        os.environ.update(local_environment())
        self._llm = load_classifier(self.model_name)

    def unload(self) -> None:
        self._llm = None
        gc.collect()
        try:
            import mlx.core as mx

            mx.clear_cache()      # trả bộ nhớ GPU cho mô hình khác (trước đó chỉ gc.collect nên bộ nhớ vẫn bị giữ)
        except ImportError:
            pass

    def suggest(self, pages: list[PageResult], catalog: Catalog, prompt_style: str = "production") -> Suggestion:
        from .llm_suggest import suggest_with

        if self._llm is None:
            self.load()
        return suggest_with(self._llm, self.key, pages, catalog, prompt_style)
