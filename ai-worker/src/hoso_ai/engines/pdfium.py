"""Đọc PDF bằng PDFium (pypdfium2), chép từ document_ai/worker.py của bản thí điểm.

TODO(AI-08): chạy inspect/render trong tiến trình con có giới hạn thời gian và bộ nhớ,
vì phân tích PDF không tin cậy là bề mặt tấn công chính; mô hình chỉ nhận ảnh PNG đã xuất.
"""
from __future__ import annotations

from pathlib import Path

from ..contracts import PageInfo


class PdfiumReader:
    def inspect(self, pdf: Path, max_pages: int) -> list[PageInfo]:
        import pypdfium2 as pdfium

        result: list[PageInfo] = []
        with pdfium.PdfDocument(str(pdf)) as document:
            if len(document) > max_pages:
                raise ValueError(f"PDF có {len(document)} trang, vượt giới hạn {max_pages}.")
            for index in range(len(document)):
                page = document[index]
                try:
                    textpage = page.get_textpage()
                    try:
                        native = textpage.get_text_range().replace("\r\n", "\n").strip()
                    finally:
                        textpage.close()
                    has_images = any(True for _ in page.get_objects(filter=[pdfium.raw.FPDF_PAGEOBJ_IMAGE]))
                finally:
                    page.close()
                result.append(PageInfo(index + 1, native, has_images))
        return result

    def render(self, pdf: Path, page_no: int, out_dir: Path) -> Path:
        import pypdfium2 as pdfium

        out_dir.mkdir(parents=True, exist_ok=True)
        target = out_dir / f"page-{page_no}.png"
        with pdfium.PdfDocument(str(pdf)) as document:
            page = document[page_no - 1]
            try:
                width, height = page.get_size()
                bitmap = page.render(scale=min(3.0, 2400 / max(width, height)))
                try:
                    image = bitmap.to_pil().convert("RGB")
                    image.save(target)
                    image.close()
                finally:
                    bitmap.close()
            finally:
                page.close()
        return target
