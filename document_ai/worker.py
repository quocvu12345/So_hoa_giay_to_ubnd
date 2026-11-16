"""Read every PDF page locally, then propose metadata. No cloud calls."""
import argparse
import json
import os
import signal
import socket
import subprocess
import sys
import time
import urllib.request
from contextlib import contextmanager
from pathlib import Path

from .config import AI_HOME, MODELS, local_environment, model_path, readiness


def write_json(path, value):
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(path)


@contextmanager
def vlm_server(output):
    # A private loopback port for this worker; never send document images to a public service.
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    url = f"http://127.0.0.1:{port}"
    with (output / "mlx.log").open("w") as log:
        process = subprocess.Popen([sys.executable, "-m", "uvicorn", "document_ai.vlm:app", "--host", "127.0.0.1",
                                    "--port", str(port)],
                                   env=local_environment(), stdout=log, stderr=subprocess.STDOUT)
        try:
            deadline = time.monotonic() + 180
            while time.monotonic() < deadline:
                if process.poll() is not None:
                    raise RuntimeError("Không khởi động được OCR trên MLX; xem mlx.log.")
                try:
                    with urllib.request.urlopen(url + "/v1/models", timeout=2):
                        break
                except (OSError, TimeoutError):
                    time.sleep(0.3)
            else:
                raise RuntimeError("Quá thời gian nạp OCR trên MLX.")
            yield url
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


def run(source, output, force_ocr=False, classify_enabled=True):
    os.environ.update(local_environment())
    import pypdfium2 as pdfium
    from .classify import classify
    output.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    pages, warnings = [], []
    state = {"stage": "preparing", "processed_pages": 0, "page_count": 0, "message": "Đang mở PDF"}

    def progress(**changes):
        state.update(changes)
        write_json(output / "progress.json", state)

    with pdfium.PdfDocument(source) as pdf:
        progress(page_count=len(pdf))
        raster_pages = []
        for index in range(len(pdf)):
            page = pdf[index]
            try:
                textpage = page.get_textpage()
                try:
                    native = textpage.get_text_range().replace("\r\n", "\n").strip()
                finally:
                    textpage.close()
                # Only trust the text-only path when no raster images could contain additional words.
                images = list(page.get_objects(filter=[pdfium.raw.FPDF_PAGEOBJ_IMAGE]))
                clean_text = len(native) >= 80 and native.count("\ufffd") < len(native) * 0.01
                if clean_text and not images and not force_ocr:
                    pages.append({"page": index + 1, "method": "pdf_text", "text": native, "native_text": native,
                                  "blocks": [], "status": "completed"})
                else:
                    width, height = page.get_size()
                    bitmap = page.render(scale=min(3.0, 2400 / max(width, height)))
                    image_path = output / f"page-{index + 1}.png"
                    try:
                        image = bitmap.to_pil().convert("RGB")
                        image.save(image_path)
                        image.close()
                    finally:
                        bitmap.close()
                    raster_pages.append((index + 1, image_path, native))
            finally:
                page.close()
        progress(processed_pages=len(pages))
        if raster_pages:
            progress(stage="loading_ocr", message="Đang nạp OCR và mô hình bố cục")
            with vlm_server(output) as server_url:
                from paddleocr import PaddleOCRVL
                pipeline = PaddleOCRVL(
                    pipeline_version="v1.6", device="cpu", cpu_threads=4,
                    layout_detection_model_dir=str(model_path("layout")),
                    doc_orientation_classify_model_dir=str(model_path("orientation")),
                    use_doc_orientation_classify=True, use_doc_unwarping=False,
                    vl_rec_backend="mlx-vlm-server", vl_rec_server_url=server_url + "/v1",
                    vl_rec_api_model_name=str(model_path("ocr")), vl_rec_max_concurrency=1,
                    use_queues=False, use_seal_recognition=True, use_ocr_for_image_block=True,
                    markdown_ignore_labels=[],
                )
                for page_number, image_path, native in raster_pages:
                    progress(stage="ocr", current_page=page_number, message=f"Đang đọc trang {page_number}/{len(pdf)}")
                    page_start = time.monotonic()
                    try:
                        res = next(iter(pipeline.predict(str(image_path), max_new_tokens=4096)))
                        raw = res.json
                        write_json(output / f"page-{page_number}.json", raw)
                        data = raw.get("res", raw)
                        blocks = data.get("parsing_res_list", [])
                        text = "\n\n".join(str(b.get("block_content", "")) for b in blocks).strip()
                        if not text:
                            warnings.append(f"Trang {page_number}: không đọc được chữ; cần xem bản gốc.")
                        pages.append({"page": page_number, "method": "PaddleOCR-VL-1.6/MLX", "text": text,
                                      "native_text": native, "blocks": blocks, "status": "completed" if text else "empty",
                                      "elapsed_seconds": round(time.monotonic() - page_start, 2)})
                    except Exception as error:
                        warnings.append(f"Trang {page_number}: OCR lỗi, cần chạy lại hoặc đối chiếu bản gốc.")
                        pages.append({"page": page_number, "method": "failed", "text": native, "native_text": native,
                                      "blocks": [], "status": "failed", "error": str(error)[:1000]})
                    pages.sort(key=lambda item: item["page"])
                    write_json(output / "pages.json", pages)
                    progress(processed_pages=len(pages))
        pages.sort(key=lambda item: item["page"])
        write_json(output / "pages.json", pages)
        suggestion = None
        if classify_enabled:
            progress(stage="classifying", message="Đang gợi ý loại hồ sơ và trích xuất trường")
            try:
                suggestion = classify(pages)
            except Exception as error:
                warnings.append("Chưa gợi ý được loại hồ sơ: " + str(error)[:500])
        text = "\n\n".join(f'--- Trang {p["page"]} ---\n{p["text"]}' for p in pages)
        (output / "full-text.txt").write_text(text, encoding="utf-8")
        result = {"page_count": len(pdf), "processed_pages": len(pages), "pages": pages,
                  "suggestion": suggestion, "warnings": warnings, "requires_review": True,
                  "all_pages_read": len(pages) == len(pdf) and all(p["status"] == "completed" for p in pages),
                  "elapsed_seconds": round(time.monotonic() - started, 2), "local_only": True,
                  "models": {key: {"repo": row[0], "revision": row[1]} for key, row in MODELS.items()}}
        write_json(output / "result.json", result)
        progress(stage="completed", message="Đã đọc xong; kiểm tra dữ liệu trước khi lưu")
        return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--force-ocr", action="store_true")
    parser.add_argument("--no-classify", action="store_true")
    args = parser.parse_args()
    if not readiness()["ready"]:
        raise SystemExit("Thiếu mô hình. Chạy ./scripts/document-ai.sh download")
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(143))
    result = run(args.pdf.resolve(), args.output.resolve(), args.force_ocr, not args.no_classify)
    print(json.dumps({k: result[k] for k in ("page_count", "all_pages_read", "elapsed_seconds", "warnings")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
