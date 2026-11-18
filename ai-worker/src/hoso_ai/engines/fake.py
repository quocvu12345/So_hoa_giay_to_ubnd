"""Mô hình GIẢ cho HOSO_AI_PROFILE=fake: chạy đủ luồng tiếp nhận khi không có máy AI.

Để đội backend/frontend làm và thử mọi màn cần kết quả AI (đối chiếu, vùng nguồn, tách văn bản, hàng đợi, lỗi trang)
trên máy không có GPU và mô hình. Ở đây không có "trí tuệ" nào:

- OCR giả KHÔNG đọc ảnh. Mỗi trang sinh một văn bản hành chính mẫu kèm khối bố cục có toạ độ (giống `parsing_res_list`
  của PaddleOCR-VL, thêm khóa `region` theo tỉ lệ trang). Trang có lớp chữ PDF sạch thì pipeline dùng chữ thật, không gọi OCR.
- Phân loại giả dùng bộ chấm từ khóa `document_ai/shortlist.py` (tên loại in ở tiêu đề); không khớp thì chọn theo mã băm nội dung.
- Trích trường giả chỉ lấy giá trị tìm thấy NGUYÊN VĂN trong chữ của trang bằng quy tắc (ngày, "Số:", "Về việc", người ký,
  dòng "Nhãn: giá trị"), nên vẫn đúng giao kèo "mỗi giá trị có trích dẫn nằm trong văn bản". Không tìm được thì để trống.
- Cùng nội dung luôn ra cùng kết quả; chỉ lỗi trang (HOSO_AI_FAKE_FAIL_RATE) là ngẫu nhiên.

Kết quả ghi model_key='fake' (ai_models.active=false), tiêu đề gợi ý có tiền tố [GIẢ LẬP]; Settings từ chối profile này khi HOSO_ENV=production.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import random
import re
import time
import unicodedata
from dataclasses import dataclass
from pathlib import Path

from ..contracts import FieldSuggestion, PageResult, Suggestion
from ..queue.repository import Catalog, FieldDef


# Khóa trong bảng ai_models (migration 013); active=false nên không bao giờ là kết quả thật.
MODEL_KEY = "fake"
TITLE_PREFIX = "[GIẢ LẬP] "
OCR_MARK = "[GIẢ LẬP: chữ do HOSO_AI_PROFILE=fake sinh ra, không đọc từ ảnh]"


def _plain(text: str) -> str:
    folded = unicodedata.normalize("NFD", str(text).casefold())
    return "".join(c for c in folded if unicodedata.category(c) != "Mn").replace("đ", "d")


def _seed(*parts: object) -> int:
    return int.from_bytes(hashlib.sha256("|".join(map(str, parts)).encode("utf-8")).digest()[:8], "big")


# ---------------------------------------------------------------- OCR giả

# Tiêu đề mẫu lấy từ tên loại có trong danh mục (migration seed), để bộ chấm từ khóa chọn được loại. Danh mục đổi tên thì
# phân loại giả quay về chọn theo mã băm, vẫn chạy được.
TEMPLATES = (
    ("THÔNG BÁO THU HỒI ĐẤT", "TB-UBND", "Về việc thu hồi đất để mở rộng đường liên xã"),
    ("BIÊN BẢN TIẾP CÔNG DÂN", "BB-UBND", "Về việc tiếp công dân định kỳ tháng {month}"),
    ("QUYẾT ĐỊNH CÔNG NHẬN HÒA GIẢI VIÊN", "QĐ-UBND", "Về việc công nhận hòa giải viên ở cơ sở"),
    ("TỜ TRÌNH ĐỀ NGHỊ MUA SẮM", "TTr-UBND", "Về việc đề nghị mua sắm trang thiết bị làm việc"),
    ("BIÊN BẢN PHIÊN HỌP UBND", "BB-UBND", "Về việc họp thường kỳ tháng {month}"),
    ("CÔNG VĂN TRẢ LỜI, GIẢI TRÌNH", "UBND-VP", "V/v trả lời kiến nghị của cử tri thôn {village}"),
)
PLACES = ("An Bình", "Tân Lập", "Hòa Phú", "Phước Long", "Thạnh Mỹ")
SIGNERS = ("Nguyễn Văn An", "Trần Thị Bình", "Lê Minh Cường", "Phạm Thu Hà", "Võ Đức Thắng")
POSITIONS = ("CHỦ TỊCH", "PHÓ CHỦ TỊCH")
SENTENCES = (
    "Căn cứ Luật Tổ chức chính quyền địa phương và các văn bản hướng dẫn thi hành.",
    "Xét đề nghị của công chức phụ trách lĩnh vực và kết quả kiểm tra thực tế tại địa phương.",
    "Các bộ phận liên quan có trách nhiệm phối hợp thực hiện, báo cáo kết quả đúng thời hạn.",
    "Trong quá trình thực hiện nếu có vướng mắc, kịp thời phản ánh về Văn phòng để tổng hợp.",
    "Nội dung này được niêm yết công khai tại trụ sở và nhà văn hóa các thôn.",
)


def _block(label: str, content: str, x: float, y: float, width: float, height: float, size: tuple[int, int], order: int) -> dict:
    w, h = size
    return {
        "block_label": label, "block_content": content, "block_order": order,
        "block_bbox": [round(x * w), round(y * h), round((x + width) * w), round((y + height) * h)],
        "region": {"x": x, "y": y, "width": width, "height": height},     # chỉ bản giả có; bản thật tự tính từ block_bbox
    }


def fake_page(page_no: int, seed: int, size: tuple[int, int] = (1240, 1754)) -> tuple[str, list[dict]]:
    """Văn bản mẫu của một trang và các khối bố cục. Trang 1 là văn bản hành chính đủ phần; trang sau là phần tiếp theo."""
    rng = random.Random(seed)
    place = rng.choice(PLACES)
    blocks: list[tuple[str, str, float, float, float, float]] = []
    if page_no == 1:
        title, suffix, subject = rng.choice(TEMPLATES)
        month, year = rng.randint(1, 12), rng.choice((2025, 2026))
        day = rng.randint(1, 28)
        subject = subject.format(month=month, village=rng.randint(1, 9))
        blocks += [
            ("header", f"ỦY BAN NHÂN DÂN\nXÃ {place.upper()}", 0.07, 0.05, 0.38, 0.06),
            ("header", f"Số: {rng.randint(1, 350)}/{suffix}", 0.07, 0.12, 0.38, 0.025),
            ("header", "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc", 0.50, 0.05, 0.45, 0.06),
            ("text", f"{place}, ngày {day:02d} tháng {month:02d} năm {year}", 0.52, 0.12, 0.42, 0.025),
            ("doc_title", title, 0.15, 0.19, 0.70, 0.035),
            ("paragraph_title", subject, 0.18, 0.23, 0.64, 0.025),
            ("text", "\n".join(rng.sample(SENTENCES, 3)), 0.08, 0.29, 0.84, 0.16),
            ("text", f"Địa điểm: Hội trường Ủy ban nhân dân xã {place}", 0.08, 0.47, 0.84, 0.025),
            ("text", f"Thành phần: đại diện Ủy ban nhân dân xã, các ban ngành đoàn thể và nhân dân thôn {rng.randint(1, 9)}", 0.08, 0.50, 0.84, 0.025),
            ("text", "Nơi nhận:\n- Như trên;\n- Lưu: VT.", 0.07, 0.70, 0.30, 0.07),
            ("text", f"TM. ỦY BAN NHÂN DÂN\n{rng.choice(POSITIONS)}", 0.55, 0.70, 0.38, 0.05),
            ("seal", "", 0.60, 0.76, 0.22, 0.07),
            ("text", rng.choice(SIGNERS), 0.58, 0.84, 0.32, 0.025),
        ]
    else:
        blocks += [
            ("text", f"Trang {page_no}. " + " ".join(rng.sample(SENTENCES, 3)), 0.08, 0.06, 0.84, 0.12),
            ("text", "\n".join(f"{i}. {s}" for i, s in enumerate(rng.sample(SENTENCES, 3), 1)), 0.08, 0.20, 0.84, 0.15),
        ]
    blocks.append(("footer", OCR_MARK, 0.08, 0.95, 0.84, 0.02))
    result = [_block(label, content, x, y, w, h, size, i) for i, (label, content, x, y, w, h) in enumerate(blocks, 1)]
    text = "\n\n".join(b["block_content"] for b in result if b["block_content"])
    return text, result


class FakeOcr:
    key = "fake-ocr"
    approx_gb = 0.1

    def __init__(self, fail_pages: set[int] | None = None, page_seconds: float = 0.0, fail_rate: float = 0.0):
        self.fail_pages = fail_pages or set()
        self.page_seconds = page_seconds
        self.fail_rate = fail_rate
        self.loaded = False
        self.calls: list[str] = []

    def load(self) -> None:
        self.loaded = True

    def unload(self) -> None:
        self.loaded = False

    def read(self, image: Path, timeout_seconds: int) -> tuple[str, list]:
        self.calls.append(image.name)
        page = int(image.stem.split("-")[-1])
        if self.page_seconds:
            time.sleep(self.page_seconds)
        if page in self.fail_pages:
            raise RuntimeError(f"OCR giả lỗi ở trang {page}")
        if self.fail_rate and random.random() < self.fail_rate:
            raise RuntimeError(f"OCR giả lỗi ngẫu nhiên ở trang {page} (HOSO_AI_FAKE_FAIL_RATE={self.fail_rate})")
        data = image.read_bytes()
        try:
            from PIL import Image

            with Image.open(image) as opened:
                size = opened.size
        except Exception:
            size = (1240, 1754)
        # Theo nội dung ảnh trang: cùng PDF luôn ra cùng chữ, kể cả khi đọc lại trang.
        return fake_page(page, _seed(hashlib.sha256(data).hexdigest(), page), size)


# ---------------------------------------------------------------- Phân loại và trích trường giả

DATE_WORDS = re.compile(r"ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})", re.IGNORECASE)
DATE_NUMBERS = re.compile(r"(?<![\d/])(\d{1,2})/(\d{1,2})/(\d{4})(?![\d/])")
NUMBER = re.compile(r"(?m)^[ \t]*Số[ \t]*[:.][ \t]*(\d[^\s,;]*)")
FILLED = re.compile(r"[^\W_]{2,}")
SUBJECT = re.compile(r"(?m)^[ \t]*((?:Về việc|V/v)\b[^\n]{3,250})")
FORMS = ("Giấy mời", "Quyết định", "Nghị quyết", "Công văn", "Báo cáo", "Thông báo", "Tờ trình", "Kế hoạch", "Biên bản",
         "Công điện", "Hợp đồng", "Phụ lục", "Danh sách", "Tờ khai", "Đơn", "Giấy")
SIGN_CUES = ("chu tich", "tm.", "kt.", "tl.", "q.", "giam doc", "truong ", "nguoi lap", "thu ky", "chu toa", "nguoi ky", "can bo")
NOT_NAMES = {"noi nhan", "nhu tren", "luu", "ghi chu"}


@dataclass(frozen=True)
class _Hit:
    value: str
    quote: str
    page_no: int
    start: int          # vị trí trích dẫn trong chữ của trang, để ước vùng khi trang không có khối bố cục
    confidence: float


def _date_value(day: str, month: str, year: str) -> str | None:
    try:
        return dt.date(int(year), int(month), int(day)).strftime("%d/%m/%Y")
    except ValueError:
        return None


class _Extractor:
    """Tìm giá trị cho từng nhãn trường trong chữ của các trang. Mỗi giá trị trả về đều nằm nguyên văn trong chữ."""

    def __init__(self, pages: list[PageResult]):
        self.pages = pages

    def find(self, field: FieldDef, any_date: bool = True) -> _Hit | None:
        """any_date: trường ngày không có dòng nhãn riêng thì lấy ngày đầu tiên của văn bản. Chỉ trường ngày ĐẦU của loại được phép
        (thường là ngày ban hành/lập); các trường như "Ngày sinh", "Ngày cấp" cần dòng nhãn, kẻo mọi trường ngày cùng một giá trị."""
        label = _plain(field.label)
        is_date = field.value_type == "date" or label.startswith("ngay")
        hit = self._labelled(label)
        if hit and is_date:
            # "Ngày ký: ngày 05 tháng 3 năm 2026" → 05/03/2026; dòng có nhãn mà không có ngày thì tìm ngày ở chỗ khác.
            match = DATE_WORDS.search(hit.value) or DATE_NUMBERS.search(hit.value)
            value = _date_value(*match.groups()) if match else None
            hit = _Hit(value, hit.quote, hit.page_no, hit.start, hit.confidence) if value else None
        if hit:
            return hit
        if is_date:
            return self._date() if any_date else None
        if label.startswith("so/") or label.startswith("so ky hieu") or label in ("so hop dong", "so chung tu", "so van ban"):
            return self._regex(NUMBER, 0.95)
        if "nguoi ky" in label:
            return self._signer()
        if "trich yeu" in label or label.startswith("noi dung chinh"):
            return self._regex(SUBJECT, 0.88)
        if label.startswith("co quan") or label.startswith("don vi lap"):
            return self._issuer()
        return None

    def _labelled(self, label: str) -> _Hit | None:
        """Dòng dạng "Nhãn: giá trị" (biểu mẫu, biên bản). Nhãn so khớp không dấu, chấp nhận nhãn rút gọn ("Thành phần" ~ "Thành phần tham gia")."""
        keys = {label.replace(" neu co", "").strip()}
        keys |= {part.strip() for part in re.split(r"/| hoac |,", label.replace(" neu co", ""))}
        keys = {k for k in keys if len(k) >= 4}
        for page in self.pages:
            offset = 0
            for line in page.text.split("\n"):
                colon = line.find(":")
                if 2 <= colon <= 60:
                    prefix = _plain(line[:colon]).strip(" -•*\t")
                    value = line[colon + 1:].strip()
                    # Biểu mẫu để trống chỉ còn đơn vị hoặc dấu chấm sau nhãn ("Diện tích : m", "Họ tên: ......"): không phải giá trị.
                    if FILLED.search(value) and len(value) <= 300 and len(prefix) >= 4 and any(
                            prefix == k or prefix.startswith(k) or (len(prefix) >= 6 and k.startswith(prefix)) for k in keys):
                        start = offset + len(line) - len(line.lstrip())
                        return _Hit(value, line.strip(), page.page_no, start, 0.9)
                offset += len(line) + 1
        return None

    def _date(self) -> _Hit | None:
        for page in self.pages:
            for pattern in (DATE_WORDS, DATE_NUMBERS):
                for match in pattern.finditer(page.text):
                    value = _date_value(*match.groups())
                    if value:
                        return _Hit(value, match.group(0), page.page_no, match.start(), 0.93)
        return None

    def _regex(self, pattern: re.Pattern, confidence: float) -> _Hit | None:
        for page in self.pages:
            match = pattern.search(page.text)
            if match:
                whole = match.group(0)
                start = match.start() + len(whole) - len(whole.lstrip())
                return _Hit(match.group(1).strip(), whole.strip(), page.page_no, start, confidence)
        return None

    def _signer(self) -> _Hit | None:
        """Tên người (2–5 chữ viết hoa chữ cái đầu) ở cuối trang, ngay dưới dòng chức danh ("CHỦ TỊCH", "TM. ..."). Trang cuối trước."""
        for page in reversed(self.pages):
            lines = page.text.split("\n")
            starts, offset = [], 0
            for line in lines:
                starts.append(offset)
                offset += len(line) + 1
            for index in range(len(lines) - 1, -1, -1):
                line = lines[index].strip()
                words = line.split()
                if not (2 <= len(words) <= 5) or _plain(line) in NOT_NAMES:
                    continue
                if not all(w.isalpha() and w[0].isupper() and (len(w) == 1 or w[1:].islower()) for w in words):
                    continue
                above = [_plain(x).strip() for x in lines[max(0, index - 6):index] if x.strip()]
                if any(cue in x + " " for x in above for cue in SIGN_CUES):
                    return _Hit(line, line, page.page_no, starts[index] + lines[index].find(line), 0.82)
        return None

    def _issuer(self) -> _Hit | None:
        """Các dòng in hoa đầu trang 1 trước quốc hiệu, ví dụ "ỦY BAN NHÂN DÂN" / "XÃ AN BÌNH"."""
        page = self.pages[0]
        lines, offset, picked = page.text.split("\n"), 0, []
        for line in lines[:8]:
            # Lớp chữ PDF hay gộp hai cột đầu văn bản thành một dòng: "ỦY BAN NHÂN DÂN    CỘNG HÒA XÃ HỘI...". Chỉ giữ cột trái.
            stripped = re.split(r"CỘNG HÒA|\s{3,}", line.strip())[0].strip()
            letters = [c for c in stripped if c.isalpha()]
            upper = len(letters) >= 3 and sum(c.isupper() for c in letters) / len(letters) >= 0.8
            plain = _plain(stripped)
            if upper and not plain.startswith(("cong hoa", "doc lap", "so:")) and len(picked) < 2:
                picked.append((offset + line.find(stripped), stripped))
            elif picked:
                break
            offset += len(line) + 1
        if not picked:
            return None
        start, end = picked[0][0], picked[-1][0] + len(picked[-1][1])
        return _Hit(" ".join(text for _, text in picked), page.text[start:end], page.page_no, start, 0.85)


def _region(page: PageResult, hit: _Hit) -> dict:
    """Vùng của trích dẫn trên trang, theo tỉ lệ trang. Có khối bố cục (OCR giả) thì lấy đúng dòng trong khối; không có thì ước theo vị trí dòng."""
    first_line = hit.quote.split("\n")[0]
    for block in page.blocks or ():
        content, region = str(block.get("block_content", "")), block.get("region")
        if region and first_line and first_line in content:
            lines = content.split("\n")
            index = next(i for i, line in enumerate(lines) if first_line in line)
            count = len(hit.quote.split("\n"))
            height = region["height"] / len(lines)
            return {"page": page.page_no, "x": region["x"], "y": round(region["y"] + index * height, 4),
                    "width": region["width"], "height": round(height * count, 4)}
    text = page.text
    lines = text.split("\n")
    line_no = text.count("\n", 0, hit.start)
    line_start = text.rfind("\n", 0, hit.start) + 1
    line_len = max(len(lines[line_no]) if line_no < len(lines) else 0, 60)
    top, span = 0.05, 0.90
    height = min(0.035, span / max(len(lines), 1))
    x = 0.08 + 0.84 * (hit.start - line_start) / line_len
    width = max(0.03, min(0.84 * len(first_line) / line_len, 0.92 - x))
    return {"page": page.page_no, "x": round(x, 4), "y": round(top + span * line_no / max(len(lines), 1), 4),
            "width": round(width, 4), "height": round(height * len(hit.quote.split("\n")), 4), "approximate": True}


def _categories(catalog: Catalog) -> list[dict]:
    return [{"code": code, "title": title, "documentTypes": [
        {"id": t.code, "name": t.name, "fields": [f.label for f in t.fields]}
        for t in catalog.document_types.values() if t.work_group_code == code]}
        for code, title in catalog.work_groups.items()]


def _form(type_name: str) -> str:
    plain = _plain(type_name)
    return next((form for form in FORMS if plain.startswith(_plain(form))), "Chưa xác định")


class FakeClassifier:
    key = "fake-classifier"
    approx_gb = 0.1

    def __init__(self, seconds: float = 0.0, mixed_from_pages: int = 0):
        self.seconds = seconds
        self.mixed_from_pages = mixed_from_pages
        self.loaded = False

    def load(self) -> None:
        self.loaded = True

    def unload(self) -> None:
        self.loaded = False

    def suggest(self, pages: list[PageResult], catalog: Catalog, prompt_style: str = "production") -> Suggestion:
        if self.seconds:
            time.sleep(self.seconds)
        pages = sorted(pages, key=lambda p: p.page_no)
        # PDF vừa có trang chữ thật vừa có trang ảnh (OCR giả): chỉ dùng chữ thật, kẻo tiêu đề giả chen vào văn bản thật.
        pages = [p for p in pages if OCR_MARK not in p.text] or pages
        text = "\n".join(f"[Trang {p.page_no}]\n{p.text}" for p in pages)
        doc_type, why, quote, verified, scorer = self._choose_type(pages, text, catalog)
        if doc_type is None:
            return Suggestion(model_key=MODEL_KEY, work_group_code=None, document_type_code=None, document_form="Chưa xác định",
                              title=TITLE_PREFIX + "Danh mục trống", reason="Giả lập: danh mục không có loại giấy tờ nào.",
                              quote="", evidence_verified=False, mixed_documents=False)

        extractor = _Extractor(pages)
        by_page = {p.page_no: p for p in pages}
        seed = _seed(text, doc_type.code)
        fields = []
        first_date = next((f.code for f in doc_type.fields if f.value_type == "date" or _plain(f.label).startswith("ngay")), None)
        for index, field in enumerate(doc_type.fields):
            hit = extractor.find(field, any_date=field.code == first_date)
            if hit is None:
                fields.append(FieldSuggestion(field.code, field.label, "", "", (), False))
                continue
            jitter = ((seed >> (index % 48)) % 7 - 3) / 100     # độ tin cậy dao động nhẹ, cố định theo nội dung
            fields.append(FieldSuggestion(field.code, field.label, hit.value, hit.quote, (hit.page_no,), True,
                                          _region(by_page[hit.page_no], hit), round(min(0.99, max(0.5, hit.confidence + jitter)), 4)))

        mixed, mixed_reason = self._mixed(pages, scorer)
        subject = next((f.value for f, d in zip(fields, doc_type.fields) if f.value and "trich yeu" in _plain(d.label)), "")
        title = TITLE_PREFIX + doc_type.name + (f" – {subject}" if subject else "")
        return Suggestion(
            model_key=MODEL_KEY,
            work_group_code=doc_type.work_group_code,
            document_type_code=doc_type.code,
            document_form=_form(doc_type.name),
            title=title[:180],
            reason=f"Giả lập (HOSO_AI_PROFILE=fake), không phải kết quả AI: {mixed_reason}{why}",
            quote=quote,
            evidence_verified=verified,
            mixed_documents=mixed,
            fields=tuple(fields),
        )

    @staticmethod
    def _choose_type(pages: list[PageResult], text: str, catalog: Catalog):
        """(loại, lý do, trích dẫn, trích dẫn có trong văn bản?, bộ chấm). Ưu tiên tên loại in ở tiêu đề, rồi từ khóa gần nhất, rồi mã băm."""
        types = sorted(catalog.document_types.values(), key=lambda t: t.code)
        if not types:
            return None, "", "", False, None
        scorer = None
        try:
            from document_ai.shortlist import MIN_SCORE, Scorer

            scorer = Scorer(_categories(catalog))
            sure = scorer.confident_type(text)
            if sure:
                chosen = catalog.document_types[sure[1]["id"]]
                line = _line_with(pages, chosen.name)
                return chosen, f"tiêu đề văn bản ghi \"{chosen.name}\".", line, bool(line), scorer
            scores = scorer.score_types(text)
            best = max(types, key=lambda t: (scores.get(t.code, 0.0), t.code))
            if scores.get(best.code, 0.0) >= MIN_SCORE:
                return best, f"từ khóa gần với \"{best.name}\" nhất (điểm {scores[best.code]:.2f}), không chắc chắn.", "", False, scorer
        except ImportError:      # chạy worker không kèm thư mục document_ai/: chỉ chọn theo mã băm
            pass
        # Không khớp gì: chọn theo mã băm, ưu tiên loại có trường ngày và số/ký hiệu để màn đối chiếu có dữ liệu.
        rich = [t for t in types if any(f.value_type == "date" for f in t.fields) and any("ky hieu" in _plain(f.label) for f in t.fields)]
        pool = rich or types
        chosen = pool[_seed(text) % len(pool)]
        return chosen, "văn bản không ghi tên loại nào trong danh mục; chọn theo mã băm nội dung để có dữ liệu thử.", "", False, scorer

    def _mixed(self, pages: list[PageResult], scorer) -> tuple[bool, str]:
        if scorer is not None and len(pages) > 1:
            seen = {t["id"]: (n, t["name"]) for n, t in scorer.page_types([{"page": p.page_no, "text": p.text} for p in pages])}
            if len(seen) >= 2:
                return True, "Các trang có tiêu đề khác loại: " + "; ".join(f"trang {n} \"{name}\"" for n, name in sorted(seen.values())[:4]) + ". "
        if self.mixed_from_pages and len(pages) >= self.mixed_from_pages:
            return True, f"Gói từ {self.mixed_from_pages} trang trở lên luôn báo nhiều giấy tờ (HOSO_AI_FAKE_MIXED_FROM_PAGES). "
        return False, ""


def _line_with(pages: list[PageResult], name: str) -> str:
    """Dòng đầu tiên chứa tên loại (so không dấu), lấy nguyên văn làm trích dẫn."""
    wanted = _plain(name)
    for page in pages:
        for line in page.text.split("\n"):
            if wanted in _plain(line):
                return line.strip()[:180]
    return ""

