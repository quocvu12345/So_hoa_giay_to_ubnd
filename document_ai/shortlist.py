"""Thu hẹp danh sách ứng viên trước khi hỏi mô hình (AI-20).

Mô hình nhỏ (Qwen3-1.7B) chọn kém khi phải chọn trong 38 nhóm rồi hàng chục loại có tên gần giống nhau.
Tên loại giấy tờ thường chính là tiêu đề in trên văn bản, nên chấm điểm bằng từ khóa rất rẻ (vài mili giây, không dùng GPU) và đủ để
chỉ đưa cho mô hình vài ứng viên đáng nghi nhất. Mô hình vẫn là bên quyết định, và vẫn có thể trả "không chắc".

Chỉ dùng từ trong chính văn bản và danh mục; không có dữ liệu ngoài, không gửi đi đâu.
"""
from __future__ import annotations

import math
import re
import unicodedata

# Từ rất phổ biến trong tên loại và trong văn bản hành chính, không giúp phân biệt.
STOP = frozenset("""
cua va cac cho theo trong ve voi la mot nhung duoc tai tu den khi nay do co khong cung nhu
so ngay thang nam ban hanh nguoi ky noi dung uy ban nhan dan phuong
""".split())

TOP_GROUPS = 8
TOP_TYPES = 10
HEAD_CHARS = 1500
# Dưới ngưỡng này coi như văn bản không khớp tên loại nào (một từ trùng như "hợp" trong "họp" và "hợp đồng" không đủ): giữ nguyên danh mục đầy đủ.
MIN_SCORE = 0.25
# Chắc chắn: tên loại nằm nguyên văn ở đầu tài liệu (điểm ≥ 1) và hơn loại đứng sau ít nhất ngần này. Tên trùng ở nhiều nhóm ("Báo cáo") có hiệu 0 nên không bao giờ chắc chắn.
CONFIDENT_SCORE = 1.0
CONFIDENT_MARGIN = 0.15
# Tiêu đề văn bản hành chính in hoa: tên loại nằm trong một dòng in hoa là dấu hiệu mạnh hơn nhiều so với nằm trong câu văn thường
# (ví dụ biểu mẫu xe có dòng "Hợp đồng mua bán xe" ở mục giấy tờ kèm theo nhưng tiêu đề thật là "GIẤY KHAI THU HỒI...").
HEADING_BONUS = 0.6
DECISIVE_SCORE = 1.0
DECISIVE_LEAD = 0.5


def plain(text: str) -> str:
    folded = unicodedata.normalize("NFD", str(text).casefold())
    return "".join(c for c in folded if unicodedata.category(c) != "Mn").replace("đ", "d")


def tokens(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", plain(text)) if len(t) >= 2 and t not in STOP]


def _heading_blob(text: str) -> str:
    """Các dòng in hoa (tiêu đề) của văn bản, không dấu, nối lại thành một chuỗi: OCR hay tách tiêu đề dài thành nhiều dòng."""
    lines = []
    for line in text.splitlines():
        letters = [c for c in line if c.isalpha()]
        if len(letters) >= 6 and sum(c.isupper() for c in letters) / len(letters) >= 0.7:
            lines.append(plain(line))
    return " ".join(lines)


def _head(text: str) -> str:
    """Phần đầu văn bản (tiêu đề, trích yếu). Bỏ dòng đánh dấu trang để không lẫn vào từ khóa."""
    return re.sub(r"^\[Trang \d+\]\s*$", "", text, flags=re.M).strip()[:HEAD_CHARS]


class Scorer:
    """Chấm điểm một văn bản với mọi loại trong danh mục. Từ hiếm (chỉ vài tên loại có) nặng hơn từ chung (nhiều tên loại có)."""

    def __init__(self, categories: list[dict]):
        self.categories = categories
        self.types = [(c, t) for c in categories for t in c["documentTypes"]]
        names = [set(tokens(t["name"])) for _, t in self.types]
        total = max(1, len(names))
        document_frequency: dict[str, int] = {}
        for tokens_of_name in names:
            for token in tokens_of_name:
                document_frequency[token] = document_frequency.get(token, 0) + 1
        self.idf = {token: math.log((total + 1) / (count + 0.5)) for token, count in document_frequency.items()}
        self.name_tokens = {t["id"]: tokens_of_name for (_, t), tokens_of_name in zip(self.types, names)}

    def _coverage(self, wanted: set[str], present: set[str]) -> float:
        mass = sum(self.idf.get(token, 1.0) for token in wanted)
        return sum(self.idf.get(token, 1.0) for token in wanted & present) / mass if mass else 0.0

    def score_types(self, text: str) -> dict[str, float]:
        head, head_plain = _head(text), plain(_head(text))
        head_tokens, body_tokens = set(tokens(head)), set(tokens(text))
        headings = _heading_blob(head)
        scores = {}
        for _, t in self.types:
            name = self.name_tokens[t["id"]]
            plain_name = plain(t["name"])
            phrase = 1.0 if len(plain_name) >= 6 and plain_name in head_plain else 0.0       # tên loại nằm nguyên văn ở đầu tài liệu
            heading = HEADING_BONUS if phrase and plain_name in headings else 0.0               # ...và nằm trong dòng tiêu đề in hoa
            scores[t["id"]] = phrase + heading + self._coverage(name, head_tokens) + 0.25 * self._coverage(name, body_tokens)
        return scores

    def confident_type(self, text: str) -> tuple[dict, dict] | None:
        """(nhóm, loại) khi tài liệu tự ghi tên loại ở phần đầu và không có loại nào khác sát bằng. Không chắc thì None để hỏi mô hình.

        Đây là bằng chứng từ chính văn bản, không phải suy đoán: ví dụ đầu tài liệu in "GIẤY KHAI THU HỒI CHỨNG NHẬN ĐĂNG KÝ XE".
        """
        scores = self.score_types(text)
        ranked = sorted(self.types, key=lambda pair: -scores[pair[1]["id"]])
        if not ranked or scores[ranked[0][1]["id"]] < CONFIDENT_SCORE:
            return None
        second = scores[ranked[1][1]["id"]] if len(ranked) > 1 else 0.0
        if scores[ranked[0][1]["id"]] - second < CONFIDENT_MARGIN:
            return None
        return ranked[0]

    def decisive_group(self, text: str) -> dict | None:
        """Nhóm khớp tiêu đề rõ ràng hơn hẳn mọi nhóm khác (kể cả khi hai loại trong cùng nhóm khớp ngang nhau). Không rõ thì None."""
        scores = self.score_types(text)
        by_group = sorted(((max((scores[t["id"]] for t in c["documentTypes"]), default=0.0), c) for c in self.categories), key=lambda item: -item[0])
        if len(by_group) < 2 or by_group[0][0] < DECISIVE_SCORE or by_group[0][0] - by_group[1][0] < DECISIVE_LEAD:
            return None
        return by_group[0][1]

    def page_types(self, pages: list[dict]) -> list[tuple[int, dict]]:
        """Từng trang tự ghi tên loại ở tiêu đề (theo cùng quy tắc chắc chắn), để phát hiện gói quét gồm nhiều giấy tờ."""
        found = []
        for page in pages:
            if len(page.get("text", "")) < 40:
                continue
            sure = self.confident_type(page["text"])
            if sure:
                found.append((page["page"], sure[1]))
        return found

    def rank_groups(self, text: str, k: int = TOP_GROUPS) -> list[str] | None:
        """Mã nhóm đáng nghi nhất (tối đa k), hoặc None khi văn bản không khớp gì (khi đó giữ nguyên toàn bộ danh mục)."""
        scores = self.score_types(text)
        body_tokens = set(tokens(text))
        ranked = []
        for category in self.categories:
            best = max((scores[t["id"]] for t in category["documentTypes"]), default=0.0)
            title = set(tokens(category["title"]))
            ranked.append((best + 0.5 * self._coverage(title, body_tokens), category["code"]))
        ranked.sort(key=lambda item: -item[0])
        if not ranked or ranked[0][0] < MIN_SCORE:
            return None
        return [code for _, code in ranked[:k]]

    def rank_types(self, text: str, candidates: list[dict], k: int = TOP_TYPES) -> list[dict]:
        """Sắp xếp các loại ứng viên theo mức khớp giảm dần và lấy tối đa k. Không loại nào khớp thì giữ nguyên thứ tự."""
        scores = self.score_types(text)
        if not candidates or max(scores.get(t["id"], 0.0) for t in candidates) < MIN_SCORE:
            return candidates
        return sorted(candidates, key=lambda t: -scores.get(t["id"], 0.0))[:k]
