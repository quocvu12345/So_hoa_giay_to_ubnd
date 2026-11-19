"""Quy tắc giữ gợi ý AI khớp danh mục trong DB."""
from __future__ import annotations

import re
import unicodedata

from .queue.repository import Catalog

# Cấp của nhóm theo mã, đúng như trường "group" của danh mục thí điểm (assets/danh-muc-ho-so.js): H01–H10 là HĐND, U01–U28 là UBND.
WORK_GROUP_LEVELS = {"H": "HĐND", "U": "UBND"}


def work_group_level(code: str | None) -> str:
    """Cấp UBND/HĐND của nhóm công việc, suy từ mã vì bảng work_groups không lưu cấp; "" khi mã không theo quy ước.

    Lời nhắc chọn nhóm cần cấp: thiếu cấp, mô hình xếp đơn của dân vào nhóm HĐND có tên gần giống (2/8 tài liệu đo trên máy
    Windows, nhánh ai-11-cpu-profile của hoso-ai: ai-worker/training/DO-TOC-DO-CPU.md).
    """
    return WORK_GROUP_LEVELS[code[0]] if re.fullmatch(r"[HU]\d{2}", code or "") else ""


def fold(value: str) -> str:
    text = unicodedata.normalize("NFD", " ".join(str(value).casefold().split()))
    return "".join(c for c in text if unicodedata.category(c) != "Mn").replace("đ", "d")


def reconcile_type(work_group_code: str | None, document_type_code: str | None, catalog: Catalog) -> tuple[str | None, str | None]:
    """Loại giấy tờ phải thuộc nhóm đã chọn (khóa ngoại document_types(code, work_group_code)).

    Bộ phân loại chọn loại theo hình thức văn bản trên mọi nhóm (giấy mời về giáo dục vẫn là giấy mời),
    nên có thể trả loại của nhóm khác. Khi đó tìm loại cùng tên trong nhóm đã chọn; không có thì bỏ loại.
    Trả (mã loại hợp lệ hoặc None, cảnh báo hoặc None).
    """
    if not document_type_code:
        return None, None
    chosen = catalog.document_types.get(document_type_code)
    if chosen is None:
        return None, f"Loại giấy tờ {document_type_code} không có trong danh mục; cán bộ chọn tay."
    if not work_group_code or chosen.work_group_code == work_group_code:
        return document_type_code, None
    same_name = next((t for t in catalog.document_types.values()
                      if t.work_group_code == work_group_code and fold(t.name) == fold(chosen.name)), None)
    if same_name:
        return same_name.code, None
    return None, (f"AI gợi ý loại “{chosen.name}” thuộc nhóm {chosen.work_group_code}, khác nhóm {work_group_code}; "
                  "cán bộ chọn loại giấy tờ.")
