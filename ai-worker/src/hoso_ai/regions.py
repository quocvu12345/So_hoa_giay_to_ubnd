"""AI-21: vùng nguồn của từng trường trên trang (ai_field_suggestions.source_region), cho mọi engine thật.

Toạ độ theo TỈ LỆ trang (0..1), gốc ở góc trên bên trái, xem docs/03 mục giao kèo worker và contracts.FieldSuggestion.

- Trang OCR: mỗi khối bố cục của PaddleOCR-VL (`block_bbox`, pixel trên ảnh đã dựng) được đổi sang `region` ngay khi đọc xong (`blocks_with_regions`);
  trích dẫn nằm trọn một khối thì lấy khối đó; chỉ chiếm một phần khối thì ước theo dòng và vị trí chữ, kèm `approximate`.
- Trang lấy từ lớp chữ PDF: tìm trích dẫn bằng PDFium (`PdfiumReader.locate_texts`) để có khung chữ thật; không tìm được thì ước theo dòng.
- Không có nguồn đáng tin thì để None (không bịa). `confidence` cũng để None: chưa có nguồn nào cho số đó.

Chạy sau khi engine gợi ý xong, trong pipeline, nên bản MLX, bản Ollama và các engine sau này dùng chung một đường.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import replace
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterator

from .contracts import FieldSuggestion, PageResult, Suggestion


def _ratio(value: float) -> float:
    return round(min(1.0, max(0.0, value)), 4)


def _box(x: float, y: float, width: float, height: float) -> dict | None:
    x, y = _ratio(x), _ratio(y)
    width, height = _ratio(min(width, 1.0 - x)), _ratio(min(height, 1.0 - y))
    return {"x": x, "y": y, "width": width, "height": height} if width > 0 and height > 0 else None


def blocks_with_regions(data: dict) -> list[dict]:
    """Khối bố cục của một trang OCR kèm khóa `region` theo tỉ lệ trang. `data` là `res` của PaddleOCR-VL (có width, height của ảnh đã dựng).

    Trang bị xoay khi nhận dạng hướng (`doc_preprocessor_res.angle` khác 0) thì toạ độ nằm trên ảnh đã xoay, không trùng ảnh người dùng
    xem nên bỏ vùng thay vì vẽ lệch."""
    width, height = data.get("width"), data.get("height")
    angle = (data.get("doc_preprocessor_res") or {}).get("angle") or 0
    usable = angle == 0 and isinstance(width, (int, float)) and isinstance(height, (int, float)) and width > 0 and height > 0
    result = []
    for block in data.get("parsing_res_list", []):
        item = dict(block)
        bbox = item.get("block_bbox")
        if usable and isinstance(bbox, (list, tuple)) and len(bbox) == 4:
            x1, y1, x2, y2 = (float(v) for v in bbox)
            region = _box(x1 / width, y1 / height, (x2 - x1) / width, (y2 - y1) / height)
            if region:
                item["region"] = region
        result.append(item)
    return result


def _pattern(text: str) -> re.Pattern | None:
    """Khớp bất kể khoảng trắng và xuống dòng, không phân biệt hoa thường: giống cách kiểm trích dẫn của document_ai.classify."""
    words = unicodedata.normalize("NFC", text).split()
    return re.compile(r"\s+".join(re.escape(w) for w in words), re.IGNORECASE) if words else None


def _queries(field: FieldSuggestion) -> list[str]:
    """Thứ tự thử: nguyên trích dẫn, giá trị, rồi dòng đầu của trích dẫn (trích dẫn dài hay vắt qua hai khối)."""
    first_line = next((line.strip() for line in field.quote.split("\n") if len(line.strip()) >= 6), "")
    seen, result = set(), []
    for query in (field.quote, field.value, first_line):
        if query and query.strip() and query not in seen:
            seen.add(query)
            result.append(query)
    return result


def _in_block(page_no: int, region: dict, content: str, start: int, end: int) -> dict:
    lines = content.split("\n")
    covered = len(re.sub(r"\s", "", content[start:end])) / max(len(re.sub(r"\s", "", content)), 1)
    if covered >= 0.85:
        return {"page": page_no, **{k: region[k] for k in ("x", "y", "width", "height")}}      # trích dẫn gần như là cả khối: khung chính xác
    first = content.count("\n", 0, start)
    last = content.count("\n", 0, max(end - 1, start))
    height = region["height"] / len(lines)
    y = region["y"] + first * height
    if first == last:
        line_start = content.rfind("\n", 0, start) + 1
        line_len = max(len(lines[first]), 1)
        x = region["x"] + region["width"] * (start - line_start) / line_len
        width = region["width"] * (end - start) / line_len
    else:
        x, width = region["x"], region["width"]
    box = _box(x, y, width, height * (last - first + 1)) or {k: region[k] for k in ("x", "y", "width", "height")}
    return {"page": page_no, **box, "approximate": True}      # vị trí ngang ước theo số ký tự; chữ căn giữa có thể lệch


class _TableParser(HTMLParser):
    """Bảng HTML mà PaddleOCR-VL trả cho khối `table`: danh sách hàng, mỗi ô là (chữ, số cột chiếm)."""

    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[tuple[str, int]]] = []
        self._cell: list[str] | None = None
        self._span = 1

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag == "tr":
            self.rows.append([])
        elif tag in ("td", "th") and self.rows:
            try:
                self._span = max(1, int(dict(attrs).get("colspan") or 1))
            except ValueError:
                self._span = 1
            self._cell = []

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in ("td", "th") and self._cell is not None and self.rows:
            # Mô hình ghi xuống dòng trong ô bằng chuỗi "\n" (hai ký tự) thay vì ký tự xuống dòng.
            text = unicodedata.normalize("NFC", "".join(self._cell)).replace("\\n", "\n").strip()
            self.rows[-1].append((text, self._span))
            self._cell = None


def _table_cells(content: str, region: dict) -> Iterator[tuple[str, dict]]:
    """Từng ô của khối bảng kèm khung ước tính: cột chia theo số cột chiếm, hàng chia theo số dòng chữ nhiều nhất trong hàng.
    Chiều cao thật của hàng và ô gộp hàng (rowspan) không có trong kết quả OCR nên khung của ô luôn chỉ là ước tính."""
    parser = _TableParser()
    parser.feed(content)
    rows = [r for r in parser.rows if r]
    columns = max((sum(span for _, span in r) for r in rows), default=0)
    if not rows or columns == 0:
        return
    weights = [max(text.count("\n") + 1 for text, _ in r) for r in rows]
    total, top = sum(weights), 0
    for row, weight in zip(rows, weights):
        column = 0
        for text, span in row:
            box = _box(region["x"] + region["width"] * column / columns, region["y"] + region["height"] * top / total,
                       region["width"] * span / columns, region["height"] * weight / total)
            if box:
                yield text, box
            column += span
        top += weight


def _folded(text: str) -> str:
    return " ".join(unicodedata.normalize("NFC", text).casefold().split())


def locate_in_blocks(page: PageResult, queries: list[str], label: str = "") -> dict | None:
    """Vùng của trích dẫn trong khối bố cục của trang OCR. Một giá trị có thể nằm ở nhiều chỗ (cùng một tên người ở hai ô):
    ưu tiên chỗ chứa luôn nhãn của trường (biểu mẫu thường in "Nhãn" rồi mới tới giá trị), không có thì lấy chỗ đầu tiên theo thứ tự đọc."""
    blocks = [b for b in page.blocks or () if isinstance(b.get("region"), dict)]
    wanted = _folded(label)
    for query in queries:
        pattern = _pattern(query)
        if pattern is None:
            continue
        found = []
        for block in blocks:
            content = unicodedata.normalize("NFC", str(block.get("block_content", "")))
            if content.lstrip().lower().startswith("<table"):
                for text, box in _table_cells(content, block["region"]):
                    if match := pattern.search(text):
                        found.append((text, box, match, True))
            elif match := pattern.search(content):
                found.append((content, block["region"], match, False))
        if found:
            text, box, match, is_cell = min(found, key=lambda c: 0 if wanted and wanted in _folded(c[0]) else 1)     # min giữ thứ tự đọc khi hòa
            region = _in_block(page.page_no, box, text, match.start(), match.end())
            return {**region, "approximate": True} if is_cell else region
    return None


def approximate_by_lines(page: PageResult, queries: list[str]) -> dict | None:
    """Trang không có khung chữ: ước theo số thứ tự dòng trong chữ của trang (đánh dấu approximate)."""
    text = unicodedata.normalize("NFC", page.text)
    lines = text.split("\n")
    for query in queries:
        pattern = _pattern(query)
        match = pattern.search(text) if pattern else None
        if not match:
            continue
        line_no = text.count("\n", 0, match.start())
        line_start = text.rfind("\n", 0, match.start()) + 1
        line_len = max(len(lines[line_no]) if line_no < len(lines) else 0, 60)
        count = max(len(lines), 1)
        top, span = 0.05, 0.90
        height = min(0.035, span / count)
        x = 0.08 + 0.84 * (match.start() - line_start) / line_len
        width = max(0.03, min(0.84 * (match.end() - match.start()) / line_len, 0.92 - x))
        box = _box(x, top + span * line_no / count, width, height * (text.count("\n", match.start(), match.end()) + 1))
        return {"page": page.page_no, **box, "approximate": True} if box else None
    return None


def locate_regions(suggestion: Suggestion, pages: dict[int, PageResult], pdf: Path | None, reader) -> Suggestion:
    """Điền source_region cho trường chưa có vùng. Không làm hỏng gợi ý: lỗi ở một trường chỉ làm trường đó không có vùng."""
    todo: list[tuple[int, FieldSuggestion, PageResult, list[str]]] = []
    fields = list(suggestion.fields)
    for index, field in enumerate(fields):
        page = pages.get(field.source_pages[0]) if field.source_pages else None
        if field.source_region is not None or not field.value or page is None:
            continue
        queries = _queries(field)
        region = locate_in_blocks(page, queries, field.label) if page.blocks else None
        if region:
            fields[index] = replace(field, source_region=region)
        elif page.method != "ocr" or not page.blocks:     # trang OCR đã có khối mà không khớp khối nào thì thôi, không ước bừa
            todo.append((index, field, page, queries))
    if todo:
        locator = getattr(reader, "locate_texts", None)
        found = locator(pdf, [(page.page_no, queries) for _, _, page, queries in todo]) if locator and pdf else [None] * len(todo)
        for (index, field, page, queries), region in zip(todo, found):
            region = region or (approximate_by_lines(page, queries) if page.text.strip() else None)
            if region:
                fields[index] = replace(field, source_region=region)
    return replace(suggestion, fields=tuple(fields))
