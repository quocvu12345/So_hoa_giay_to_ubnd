"""Mac Apple Silicon: dùng lại đúng mã đã kiểm thử của document_ai/ (PaddleOCR-VL 1.6 + Qwen3-4B qua MLX).

Khác bản thí điểm: mô hình được nạp một lần và giữ lại giữa các job (ModelScheduler quyết định khi nào bỏ).
TODO(AI-01): chuyển mã từ document_ai/ vào gói này khi bỏ bản thí điểm; hiện import để chỉ có một nguồn.
"""
from __future__ import annotations

import gc
from contextlib import ExitStack
from pathlib import Path

from ..catalog_rules import reconcile_type
from ..contracts import FieldSuggestion, PageResult, Suggestion
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
        blocks = data.get("parsing_res_list", [])
        text = "\n\n".join(str(b.get("block_content", "")) for b in blocks).strip()
        return text, blocks


class QwenMlxClassifier:
    key = "classifier"
    approx_gb = 3.0   # Qwen3-4B-Instruct-2507 MLX 4-bit

    def load(self) -> None:
        # document_ai.classify hiện tự nạp mô hình trong mỗi lần gọi.
        # TODO(AI-05): giữ model/tokenizer ở đây và truyền vào, nhận danh mục từ DB thay cho danh-muc-ho-so.js.
        pass

    def unload(self) -> None:
        gc.collect()

    def suggest(self, pages: list[PageResult], catalog: Catalog) -> Suggestion:
        from document_ai.classify import classify

        raw = classify([{"page": p.page_no, "text": p.text} for p in pages])
        group = raw.get("category_code")
        type_code, type_warning = reconcile_type(group, raw.get("type_id"), catalog)
        type_def = catalog.document_types.get(type_code) if type_code else None
        labels = {f.label: f.code for f in (type_def.fields if type_def else ())}
        fields = tuple(
            FieldSuggestion(labels.get(f["label"], f["label"]), f["label"], f.get("value", ""), f.get("quote", ""),
                            tuple(f.get("source_pages", [])), bool(f.get("value")))
            for f in raw.get("fields", [])
            if f["label"] in labels
        )
        warnings = tuple(raw.get("field_extraction_warnings", [])) + ((type_warning,) if type_warning else ())
        return Suggestion(
            model_key=self.key,
            work_group_code=group,
            document_type_code=type_code,
            document_form=raw.get("document_form", "Chưa xác định"),
            title=raw.get("title", ""),
            reason=raw.get("reason", ""),
            quote=raw.get("quote", ""),
            evidence_verified=bool(raw.get("classification_evidence_verified")),
            mixed_documents=bool(raw.get("mixed_documents")),
            fields=fields,
            warnings=warnings,
        )
