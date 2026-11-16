import hashlib
import json
import threading
from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image, ImageOps

from .config import DATA, MAX_IMAGE_PIXELS, MAX_PAGE_EDGE, ROOT, RUNTIME

Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
# PDFium is not thread-safe, even for distinct documents.
PDF_LOCK = threading.RLock()


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def atomic_json(path, value):
    path = Path(path)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def inspect_document(path):
    path = Path(path)
    with path.open("rb") as handle:
        header = handle.read(5)
    if header == b"%PDF-":
        with PDF_LOCK, pdfium.PdfDocument(path) as pdf:
            count = len(pdf)
            if count == 0:
                raise ValueError("PDF không có trang.")
            # Force parsing of the first page before accepting the upload.
            page = pdf[0]
            try:
                width, height = page.get_size()
            finally:
                page.close()
            return {"media_type": "application/pdf", "page_count": count,
                    "first_page_size_pt": [width, height]}
    with Image.open(path) as image:
        if image.format not in {"PNG", "JPEG", "WEBP", "TIFF"}:
            raise ValueError("Chỉ nhận PDF, PNG, JPEG, WEBP hoặc TIFF.")
        if image.width * image.height > MAX_IMAGE_PIXELS:
            raise ValueError("Ảnh vượt quá giới hạn 40 megapixel.")
        if getattr(image, "n_frames", 1) > 1:
            raise ValueError("Hãy chuyển ảnh nhiều khung/trang sang PDF trước khi nạp.")
        image.load()
        return {"media_type": Image.MIME[image.format], "page_count": 1}


def sample_records(include_baseline=False):
    records = []
    # The full extension contains the same 425 x 2 scenarios with actual
    # supporting PDFs. Prefer it once verified, avoiding duplicate versions in
    # the inbox while keeping the original source-backed catalogue accessible.
    dossiers = ROOT / "data/tuliem-dossiers/manifest.json"
    complete = ROOT / "data/tuliem-dossiers-full/manifest.json"
    verification = ROOT / "data/tuliem-dossiers-full/verification.json"
    if complete.is_file() and verification.is_file():
        if json.loads(verification.read_text(encoding="utf-8")).get("passed"):
            dossiers = complete
    manifests = [DATA / "manifest.json", ROOT / "data/citizen-samples/manifest.json",
                 ROOT / "data/form-test-data/manifest.json",
                 ROOT / "data/vietnamese-form-dataset/manifest.json",
                 dossiers]
    if include_baseline:
        manifests.append(ROOT / "data/filled-samples/manifest.json")
    for manifest in manifests:
        if manifest.is_file():
            records.extend(json.loads(manifest.read_text(encoding="utf-8"))["documents"])
    return records


def uploaded_records():
    return [json.loads(path.read_text(encoding="utf-8")) for path in
            sorted((RUNTIME / "uploads").glob("upload-*.json"), key=lambda p: p.stat().st_mtime, reverse=True)]


def get_document(document_id):
    # Caller never supplies a filesystem path.
    for record in sample_records(include_baseline=True):
        if record["id"] == document_id:
            return record
    if document_id.startswith("upload-") and len(document_id) == 39:
        suffix = document_id[7:]
        if all(c in "0123456789abcdef" for c in suffix):
            meta = RUNTIME / "uploads" / f"{document_id}.json"
            if meta.is_file():
                return json.loads(meta.read_text(encoding="utf-8"))
    raise KeyError(document_id)


def document_path(record):
    if record["id"].startswith("upload-"):
        path = (RUNTIME / "uploads" / record["filename"]).resolve()
        allowed_root = (RUNTIME / "uploads").resolve()
    else:
        path = (ROOT / record["local_path"]).resolve()
        allowed_root = ROOT
    if not path.is_relative_to(allowed_root) or not path.is_file():
        raise ValueError("Không tìm thấy tệp nguồn hợp lệ.")
    return path


def render_page(record, page_number):
    if page_number < 1 or page_number > record["page_count"]:
        raise ValueError("Số trang nằm ngoài tài liệu.")
    output = RUNTIME / "previews" / f'{record["id"]}-{record["sha256"][:12]}-p{page_number}.png'
    with PDF_LOCK:
        if output.is_file():
            return output
        source = document_path(record)
        if record["media_type"] == "application/pdf":
            with pdfium.PdfDocument(source) as pdf:
                page = pdf[page_number - 1]
                try:
                    width, height = page.get_size()
                    if min(width, height) <= 0:
                        raise ValueError("Kích thước trang PDF không hợp lệ.")
                    scale = min(2.0, MAX_PAGE_EDGE / max(width, height))
                    bitmap = page.render(scale=scale)
                    try:
                        image = bitmap.to_pil().convert("RGB")
                    finally:
                        bitmap.close()
                finally:
                    page.close()
        else:
            with Image.open(source) as original:
                image = ImageOps.exif_transpose(original).convert("RGB")
                image.thumbnail((MAX_PAGE_EDGE, MAX_PAGE_EDGE))
        image.save(output, "PNG")
        image.close()
    return output
