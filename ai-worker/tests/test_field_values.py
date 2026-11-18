"""AI-23: chuẩn hóa giá trị AI trích theo kiểu trường. Các ca lấy từ giá trị thật trong hoso_dev (giấy tờ mô phỏng, IFStruct qua Ollama)."""
from __future__ import annotations

import pytest

from hoso_ai.contracts import PageResult
from hoso_ai.engines.llm_suggest import suggest_with
from hoso_ai.field_values import clean_value
from hoso_ai.queue.repository import Catalog, DocumentTypeDef, FieldDef


@pytest.mark.parametrize("value, expected", [
    ("12/11/2026", "12/11/2026"),
    ("5/3/2026", "05/03/2026"),
    ("12-11-2026", "12/11/2026"),
    ("12.11.2026", "12/11/2026"),
    ("27 tháng 3 năm 2026", "27/03/2026"),
    ("ngày 5 tháng 3 năm 2026", "05/03/2026"),
    ("Từ Liêm, ngày 27 tháng 3 năm 2026", "27/03/2026"),
    ("09 giờ 30 phút, ngày 12/11/2026", "12/11/2026"),          # giờ không có chỗ trong trường ngày; trích dẫn còn đủ giờ
    ("  12 / 11 / 2026  ", "12/11/2026"),
    ("12/11/2026 (thứ Năm)", "12/11/2026"),
])
def test_truong_ngay_ve_dang_dd_mm_yyyy_ma_giao_dien_va_api_nhan(value, expected):
    assert clean_value("date", "Ngày lập", value) == (expected, None)


def test_truong_ngay_khong_co_ngay_thi_bo_ham_chi_la_nhan():
    value, reason = clean_value("date", "Ngày lập hợp đồng", "Hợp đồng có hiệu lực từ ngày:")
    assert value == "" and reason
    assert clean_value("date", "Ngày", "không ghi") == ("", "không có ngày nào")


@pytest.mark.parametrize("value", ["từ 01/01/2026 đến 31/12/2026", "31/02/2026", "12/13/2026"])
def test_ngay_mo_ho_hoac_sai_lich_thi_giu_nguyen_de_nguoi_doi_chieu_quyet_dinh(value):
    assert clean_value("date", "Ngày", value) == (value, None)


def test_cau_huong_dan_in_san_khong_phai_gia_tri():
    value, reason = clean_value("text", "Bên mua xe", "Bên mua (sau đây gọi là Bên B): (Chọn một trong các chủ thể nêu trên)")
    assert value == "" and "hướng dẫn" in reason
    assert clean_value("text", "Bên bán", "(Chọn một trong các chủ thể)")[0] == ""
    # Chỉ bỏ phần hướng dẫn, giữ nội dung thật.
    assert clean_value("text", "Người ký", "Nguyễn Minh Quân (ghi rõ họ tên)") == ("Nguyễn Minh Quân", None)


def test_nhan_ket_thuc_bang_hai_cham_khong_phai_gia_tri_o_moi_kieu_truong():
    assert clean_value("text", "Người ký", "Người ký:")[0] == ""
    assert clean_value("text", "Số", "Số hiệu văn bản:")[1]


def test_cat_nhan_cua_dong_ke_ben_o_truong_ngan_nhung_khong_o_truong_dien_dat():
    assert clean_value("text", "Biển số xe", "TEST-001 - Màu biển: Trắng") == ("TEST-001", None)
    assert clean_value("text", "Người bán", "Trần Văn Hòa; Chức vụ: Giám đốc")[0] == "Trần Văn Hòa; Chức vụ: Giám đốc"      # dấu ; không kèm gạch: không cắt
    long = "Chương trình công tác - Nội dung: chỉ đạo, điều hành"
    assert clean_value("text", "Trích yếu hoặc nội dung chính", long) == (long, None)
    assert clean_value("text", "Nội dung, kết quả", "Đã kiểm tra 12 hồ sơ - Kết quả: đạt")[0].endswith("Kết quả: đạt")
    assert clean_value("text", "Biển số", "- Hạng mục: x")[0] == "- Hạng mục: x"           # không có gì đứng trước nhãn thì không cắt thành rỗng


def test_giu_nguyen_gia_tri_binh_thuong_va_khoang_trang():
    assert clean_value("text", "Tên", "  Nguyễn   Văn  A \n") == ("Nguyễn Văn A", None)
    assert clean_value("text", "Tên", "") == ("", None)
    assert clean_value("number", "Số lượng", "80,5") == ("80,5", None)


DOC = ("ỦY BAN NHÂN DÂN PHƯỜNG TỪ LIÊM\nHỢP ĐỒNG MUA BÁN XE\nTừ Liêm, ngày 27 tháng 3 năm 2026\n"
       "Bên mua (sau đây gọi là Bên B): (Chọn một trong các chủ thể nêu trên)\nHợp đồng có hiệu lực từ ngày:\nBiển số: TEST-001 - Màu biển: Trắng")


class Llm:
    """Mô hình giả trả về đúng các giá trị lỗi đã gặp thật."""
    label = "test"

    def complete(self, system, prompt, max_tokens):
        if "Chọn category_code" in prompt:
            return '{"category_code": "U27", "document_form": "Hợp đồng", "title": "Hợp đồng", "reason": "r", "quote": "HỢP ĐỒNG MUA BÁN XE", "mixed_documents": false}'
        if "Chọn type_id" in prompt:
            return '{"type_id": "U27-D01"}'
        return ('{"fields": ['
                '{"label": "Ngày lập hợp đồng", "value": "27 tháng 3 năm 2026", "quote": "ngày 27 tháng 3 năm 2026"},'
                '{"label": "Hiệu lực từ ngày", "value": "Hợp đồng có hiệu lực từ ngày:", "quote": "Hợp đồng có hiệu lực từ ngày:"},'
                '{"label": "Bên mua xe", "value": "Bên mua (sau đây gọi là Bên B): (Chọn một trong các chủ thể nêu trên)", "quote": "Bên mua (sau đây gọi là Bên B): (Chọn một trong các chủ thể nêu trên)"},'
                '{"label": "Biển số xe", "value": "TEST-001 - Màu biển: Trắng", "quote": "TEST-001 - Màu biển: Trắng"}]}')


def test_suggest_with_chuan_hoa_theo_kieu_truong_va_giu_trich_dan_nguyen_van(monkeypatch):
    monkeypatch.setenv("HOSO_AI_SHORTLIST", "off")
    fields = (FieldDef("F1", "Ngày lập hợp đồng", "date"), FieldDef("F2", "Hiệu lực từ ngày", "date"),
              FieldDef("F3", "Bên mua xe", "text"), FieldDef("F4", "Biển số xe", "text"))
    catalog = Catalog({"U27": "Phương tiện"}, {"U27-D01": DocumentTypeDef("U27-D01", "Hợp đồng mua bán xe", "U27", fields)})
    result = suggest_with(Llm(), "classifier", [PageResult(1, "pdf_text", DOC)], catalog, "production")
    by = {f.label: f for f in result.fields}

    assert by["Ngày lập hợp đồng"].value == "27/03/2026"                       # chuẩn hóa
    assert "27 tháng 3 năm 2026" in by["Ngày lập hợp đồng"].quote              # dẫn chứng vẫn nguyên văn
    assert by["Ngày lập hợp đồng"].quote_verified and by["Ngày lập hợp đồng"].source_pages == (1,)
    assert by["Biển số xe"].value == "TEST-001"                                 # cắt nhãn thừa
    for dropped in ("Hiệu lực từ ngày", "Bên mua xe"):                          # bỏ hẳn, kèm lý do cho cán bộ
        assert by[dropped].value == "" and by[dropped].quote == "" and by[dropped].source_pages == () and not by[dropped].quote_verified
    assert any("Hiệu lực từ ngày" in w and "để trống" in w for w in result.warnings)
    assert any("Bên mua xe" in w for w in result.warnings)
