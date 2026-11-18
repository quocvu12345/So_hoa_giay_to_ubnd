"""AI-23: chuẩn hóa giá trị AI trích ra theo kiểu của trường (field_definitions.value_type), dùng chung cho mọi engine thật.

Nguyên tắc: không bịa. Chỉ làm một trong ba việc,
  1. đổi cách viết của giá trị đã có trong tài liệu (ngày chữ → dd/mm/yyyy), vì giao diện đối chiếu và API chỉ nhận ngày dạng đó;
  2. cắt phần thừa ở cuối giá trị (nhãn của dòng kế bên, câu hướng dẫn in sẵn);
  3. bỏ hẳn giá trị khi rõ ràng không phải dữ liệu (không có ngày nào trong trường ngày; chỉ là nhãn kết thúc bằng dấu hai chấm; chỉ là câu hướng dẫn).
Trích dẫn (`quote`) luôn giữ nguyên văn: đó là dẫn chứng; giá trị đã chuẩn hóa không còn phải nằm nguyên văn trong văn bản.
Không chắc thì giữ nguyên giá trị để người đối chiếu quyết định (ví dụ trường ngày chứa hai ngày, hoặc ngày sai lịch như 31/02).
"""
from __future__ import annotations

import re
import unicodedata
from datetime import date

# Trường diễn đạt (trích yếu, nội dung...) vốn dài và có thể chứa dấu gạch, dấu hai chấm: không cắt đuôi.
_SUMMARY = re.compile(r"trích yếu|nội dung|mô tả|kết quả|thành phần|ghi chú", re.IGNORECASE)
_NUMERIC_DATE = re.compile(r"(?<!\d)(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{4})(?!\d)")
_WORD_DATE = re.compile(r"(?<!\d)(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})(?!\d)", re.IGNORECASE)
_INSTRUCTION = re.compile(r"\(\s*(?:chọn|ghi rõ|điền|nhập|đánh dấu|gạch|xóa|nếu có)\b[^)]*\)", re.IGNORECASE)
_TAIL_LABEL = re.compile(r"\s+[-–—;]\s+(?=[A-ZÀ-Ỹ][\wÀ-ỹ /]{0,30}:\s)")


def _dates(text: str) -> tuple[set[date], bool]:
    """Các ngày đọc được trong chuỗi, và có token trông như ngày nhưng sai lịch (31/02/2026) hay không."""
    found: set[date] = set()
    invalid = False
    for pattern in (_NUMERIC_DATE, _WORD_DATE):
        for d, m, y in pattern.findall(text):
            try:
                found.add(date(int(y), int(m), int(d)))
            except ValueError:
                invalid = True
    return found, invalid


def clean_value(value_type: str, label: str, value: str) -> tuple[str, str | None]:
    """(giá trị đã chuẩn hóa, lý do bỏ). Giá trị rỗng kèm lý do nghĩa là bỏ hẳn; rỗng không kèm lý do là đầu vào rỗng."""
    text = " ".join(unicodedata.normalize("NFC", value).split()).strip()
    if not text:
        return "", None
    stripped = _INSTRUCTION.sub("", text).strip()          # "(Chọn một trong các chủ thể nêu trên)" là hướng dẫn của biểu mẫu
    if stripped != text:
        if not stripped or stripped.endswith(":"):
            return "", "là câu hướng dẫn in sẵn của biểu mẫu"
        text = stripped
    if text.endswith(":"):
        return "", "chỉ là nhãn của dòng, không có nội dung"

    if value_type == "date":
        found, invalid = _dates(text)
        if len(found) == 1 and not invalid:
            day = next(iter(found))
            return f"{day.day:02d}/{day.month:02d}/{day.year:04d}", None
        if not found and not invalid:
            return "", "không có ngày nào"
        return text, None                                   # nhiều ngày hoặc ngày sai lịch: để người đối chiếu quyết định
    if value_type == "text" and not _SUMMARY.search(label):
        tail = _TAIL_LABEL.search(text)
        if tail and tail.start() > 0:
            text = text[: tail.start()].rstrip()           # "TEST-001 - Màu biển: Trắng" → "TEST-001"
    return text, None
