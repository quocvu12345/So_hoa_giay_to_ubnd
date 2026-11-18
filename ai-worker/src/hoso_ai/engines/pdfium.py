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

    def locate_texts(self, pdf: Path, requests: list[tuple[int, list[str]]]) -> list[dict | None]:
        """Vùng chứa chữ trên trang có lớp chữ PDF (AI-21). Mỗi yêu cầu là (số trang, các chuỗi thử theo thứ tự); trả vùng theo tỉ lệ trang
        của chuỗi đầu tiên tìm thấy, hoặc None. Mở PDF một lần cho mọi yêu cầu. Trang bị xoay thì bỏ vùng (khung không trùng ảnh người dùng xem)."""
        import pypdfium2 as pdfium

        results: list[dict | None] = []
        with pdfium.PdfDocument(str(pdf)) as document:
            for page_no, queries in requests:
                results.append(self._locate(document, page_no, queries))
        return results

    @staticmethod
    def _locate(document, page_no: int, queries: list[str]) -> dict | None:
        if not 1 <= page_no <= len(document):
            return None
        page = document[page_no - 1]
        try:
            if page.get_rotation():
                return None
            left, bottom, right, top = page.get_bbox()
            width, height = right - left, top - bottom
            if width <= 0 or height <= 0:
                return None
            textpage = page.get_textpage()
            try:
                for query in queries:
                    text = " ".join(query.split())
                    if len(text) < 2:
                        continue
                    searcher = textpage.search(text, match_case=False)
                    try:
                        found = searcher.get_next()
                    finally:
                        searcher.close()
                    if not found:
                        continue
                    rects = [textpage.get_rect(i) for i in range(textpage.count_rects(*found))]
                    if not rects:
                        continue
                    x1, x2 = min(r[0] for r in rects), max(r[2] for r in rects)
                    y1, y2 = min(r[1] for r in rects), max(r[3] for r in rects)
                    ratio = lambda v: round(min(1.0, max(0.0, v)), 4)  # noqa: E731
                    box = {"x": ratio((x1 - left) / width), "y": ratio((top - y2) / height),
                           "width": ratio((x2 - x1) / width), "height": ratio((y2 - y1) / height)}
                    if box["width"] > 0 and box["height"] > 0:
                        return {"page": page_no, **box}
            finally:
                textpage.close()
        finally:
            page.close()
        return None

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
