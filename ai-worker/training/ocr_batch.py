"""OCR hàng loạt bằng đúng engine của ai-worker (PaddleOCR-VL 1.6, nạp một lần). Chạy tiếp được nếu bị ngắt.
Thứ tự: tập eval trước, rồi tập train, để có thể đo baseline sớm."""
from __future__ import annotations

import json
import shutil
import sys
import time

from common import DATASET, WORK, append_jsonl, read_jsonl

from hoso_ai.engines.mlx import PaddleVlMlxOcr
from hoso_ai.engines.pdfium import PdfiumReader


def main() -> None:
    selection = json.loads((WORK / "selection.json").read_text(encoding="utf-8"))
    selection.sort(key=lambda r: r["split"] != "eval")
    out = WORK / "ocr.jsonl"
    done = {r["document_id"] for r in read_jsonl(out)}
    todo = [r for r in selection if r["document_id"] not in done]
    print(f"đã xong {len(done)}, còn {len(todo)} tài liệu", flush=True)
    if not todo:
        return
    engine = PaddleVlMlxOcr(WORK / "ocr-server")
    reader = PdfiumReader()
    images = WORK / "images"
    started = time.time()
    engine.load()
    print(f"nạp OCR {time.time() - started:.1f}s", flush=True)
    try:
        for index, item in enumerate(todo, 1):
            pdf = DATASET / "documents" / f"{item['document_id']}.pdf"
            pages, error = [], None
            for page_no in range(1, item["pages"] + 1):
                began = time.time()
                try:
                    image = reader.render(pdf, page_no, images)
                    text, _ = engine.read(image, 300)
                    pages.append({"page": page_no, "text": text, "seconds": round(time.time() - began, 1)})
                except Exception as exc:  # một trang lỗi không làm hỏng cả lô
                    error = f"{type(exc).__name__}: {exc}"
                    break
                finally:
                    shutil.rmtree(images, ignore_errors=True)
            append_jsonl(out, {**item, "pages": pages, "error": error})
            elapsed = time.time() - started
            print(f"[{index}/{len(todo)}] {item['split']} {item['document_id']} "
                  f"{sum(p['seconds'] for p in pages):.0f}s · còn ~{elapsed / index * (len(todo) - index) / 60:.0f} phút", flush=True)
    finally:
        engine.unload()


if __name__ == "__main__":
    sys.exit(main())
