"""Bản giả (HOSO_AI_PROFILE=fake) đủ giống thật để làm và thử các màn đối chiếu, vùng nguồn, tách văn bản mà không cần mô hình."""
from __future__ import annotations

from pathlib import Path

import pytest
from PIL import Image

from hoso_ai.contracts import PageResult
from hoso_ai.engines.factory import build_engines
from hoso_ai.engines.fake import OCR_MARK, TITLE_PREFIX, FakeClassifier, FakeOcr, fake_page
from hoso_ai.queue.repository import Catalog, DocumentTypeDef, FieldDef
from hoso_ai.settings import Settings, SettingsError


def _type(code: str, name: str, group: str, *labels: tuple[str, str]) -> DocumentTypeDef:
    return DocumentTypeDef(code, name, group, tuple(FieldDef(f"{code}-F{i}", label, kind) for i, (label, kind) in enumerate(labels, 1)))


COMMON = (("Số/ký hiệu nếu có", "text"), ("Ngày ban hành/lập", "date"), ("Cơ quan ban hành/lập", "text"),
          ("Trích yếu hoặc nội dung chính", "text"), ("Người ký", "text"))
CATALOG = Catalog(
    {"U16": "Đất đai", "U04": "Tiếp công dân", "U27": "Phương tiện"},
    {
        "U16-D01": _type("U16-D01", "Thông báo thu hồi đất", "U16", *COMMON),
        "U04-D03": _type("U04-D03", "Biên bản tiếp công dân", "U04", ("Ngày, giờ lập", "date"), ("Địa điểm", "text"),
                         ("Thành phần tham gia", "text"), ("Người ký", "text")),
        "U27-D14": _type("U27-D14", "Hợp đồng mua bán xe", "U27", ("Ngày lập hợp đồng", "date"), ("Ngày sinh bên bán", "date"),
                         ("Diện tích đất", "text"), ("Bên bán", "text")),
    },
)

NOTICE = """ỦY BAN NHÂN DÂN
XÃ AN BÌNH

Số: 125/TB-UBND

CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc

An Bình, ngày 05 tháng 3 năm 2026

THÔNG BÁO THU HỒI ĐẤT
Về việc thu hồi đất để mở rộng đường liên xã

Nơi nhận:
- Như trên;
- Lưu: VT.

TM. ỦY BAN NHÂN DÂN
CHỦ TỊCH

Nguyễn Văn An"""


def _image(tmp_path: Path, page: int, size=(600, 800), color="white") -> Path:
    path = tmp_path / f"page-{page}.png"
    Image.new("RGB", size, color).save(path)
    return path


def test_ocr_gia_sinh_van_ban_co_khoi_bo_cuc_va_toa_do_dung_kich_thuoc_anh(tmp_path):
    text, blocks = FakeOcr().read(_image(tmp_path, 1, (1000, 1400)), 60)
    assert OCR_MARK in text and "Số:" in text and "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM" in text
    for block in blocks:
        x1, y1, x2, y2 = block["block_bbox"]
        assert 0 <= x1 < x2 <= 1000 and 0 <= y1 < y2 <= 1400
        region = block["region"]
        assert round(region["x"] * 1000) == x1 and round((region["y"] + region["height"]) * 1400) == y2


def test_ocr_gia_cung_anh_cung_chu_va_cho_dung_cau_hinh(tmp_path):
    image = _image(tmp_path, 2)
    assert FakeOcr().read(image, 60) == FakeOcr().read(image, 60)
    assert fake_page(1, 7)[0] != fake_page(1, 8)[0] or fake_page(1, 7)[0] != fake_page(1, 9)[0]
    with pytest.raises(RuntimeError, match="ngẫu nhiên"):
        FakeOcr(fail_rate=1.0).read(image, 60)


def test_chon_loai_theo_tieu_de_va_trich_truong_co_trich_dan_nguyen_van():
    suggestion = FakeClassifier().suggest([PageResult(1, "pdf_text", NOTICE)], CATALOG)
    assert suggestion.model_key == "fake" and suggestion.title.startswith(TITLE_PREFIX)
    assert (suggestion.work_group_code, suggestion.document_type_code) == ("U16", "U16-D01")
    assert suggestion.evidence_verified and suggestion.quote == "THÔNG BÁO THU HỒI ĐẤT"
    assert suggestion.document_form == "Thông báo" and not suggestion.mixed_documents
    values = {f.label: f.value for f in suggestion.fields}
    assert values == {
        "Số/ký hiệu nếu có": "125/TB-UBND",
        "Ngày ban hành/lập": "05/03/2026",
        "Cơ quan ban hành/lập": "ỦY BAN NHÂN DÂN XÃ AN BÌNH",
        "Trích yếu hoặc nội dung chính": "Về việc thu hồi đất để mở rộng đường liên xã",
        "Người ký": "Nguyễn Văn An",
    }
    for field in suggestion.fields:
        assert field.quote_verified and field.quote in NOTICE and field.source_pages == (1,)
        region = field.source_region
        assert region["page"] == 1 and region["approximate"] is True
        assert all(0 <= region[k] <= 1 for k in ("x", "y", "width", "height")) and region["x"] + region["width"] <= 1
        assert 0.5 <= field.confidence <= 0.99
    # Cùng nội dung → cùng kết quả (để thử giao diện lặp lại được).
    assert FakeClassifier().suggest([PageResult(1, "pdf_text", NOTICE)], CATALOG) == suggestion


def test_trang_ocr_gia_cho_vung_nguon_dung_khoi_chua_trich_dan():
    text, blocks = fake_page(1, 3)
    suggestion = FakeClassifier().suggest([PageResult(1, "ocr", text, "", blocks)], CATALOG)
    filled = [f for f in suggestion.fields if f.value]
    assert filled, "chữ OCR giả phải đủ để trích trường"
    for field in filled:
        region = field.source_region
        assert "approximate" not in region, "trang có khối bố cục thì vùng lấy từ khối, không ước"
        block = next(b for b in blocks if field.quote.split("\n")[0] in b["block_content"])
        assert block["region"]["x"] == region["x"]
        assert block["region"]["y"] <= region["y"] < block["region"]["y"] + block["region"]["height"]


def test_bieu_mau_de_trong_khong_co_gia_tri_va_ngay_sinh_khong_lay_ngay_dau_van_ban():
    form = "HỢP ĐỒNG MUA BÁN XE\nHôm nay, ngày 20 tháng 02 năm 2025\n- Diện tích : m\nBên bán: ............\nNgày sinh:"
    fields = {f.label: f for f in FakeClassifier().suggest([PageResult(1, "pdf_text", form)], CATALOG).fields}
    assert fields["Ngày lập hợp đồng"].value == "20/02/2025"
    assert fields["Ngày sinh bên bán"].value == "", "chỉ trường ngày đầu tiên được lấy ngày đầu văn bản"
    assert fields["Diện tích đất"].value == "" and fields["Bên bán"].value == ""
    assert not any(f.quote_verified for f in fields.values() if not f.value)


def test_bao_goi_nhieu_giay_to_khi_cac_trang_ghi_ten_loai_khac_nhau():
    visit = "BIÊN BẢN TIẾP CÔNG DÂN\nĐịa điểm: Trụ sở Ủy ban nhân dân xã An Bình\nThành phần: cán bộ tiếp công dân và ông Trần Văn Bảy"
    suggestion = FakeClassifier().suggest([PageResult(1, "pdf_text", NOTICE), PageResult(2, "pdf_text", visit)], CATALOG)
    assert suggestion.mixed_documents and "trang 2" in suggestion.reason
    single = [PageResult(1, "pdf_text", NOTICE), PageResult(2, "pdf_text", "Nội dung tiếp theo của thông báo.")]
    assert not FakeClassifier().suggest(single, CATALOG).mixed_documents
    assert FakeClassifier(mixed_from_pages=2).suggest(single, CATALOG).mixed_documents


def test_pdf_tron_trang_that_va_trang_anh_chi_dung_chu_that():
    fake_text, blocks = fake_page(1, 11)
    pages = [PageResult(1, "ocr", fake_text, "", blocks), PageResult(2, "pdf_text", NOTICE)]
    suggestion = FakeClassifier().suggest(pages, CATALOG)
    assert suggestion.document_type_code == "U16-D01" and not suggestion.mixed_documents
    assert {f.source_pages for f in suggestion.fields if f.value} == {(2,)}


def test_khong_khop_ten_loai_nao_van_chon_mot_loai_co_truong_ngay_va_so():
    suggestion = FakeClassifier().suggest([PageResult(1, "pdf_text", "Ghi chép không có tiêu đề, ngày 01/02/2026.")], CATALOG)
    assert suggestion.document_type_code == "U16-D01" and not suggestion.evidence_verified
    assert "mã băm" in suggestion.reason


def test_cau_hinh_ban_gia(tmp_path):
    base = {"HOSO_AI_PROFILE": "fake", "HOSO_AI_WORK_ROOT": str(tmp_path)}
    settings = Settings.from_env(base | {"HOSO_AI_FAKE_PAGE_SECONDS": "0.2", "HOSO_AI_FAKE_FAIL_RATE": "0.1",
                                         "HOSO_AI_FAKE_MIXED_FROM_PAGES": "6", "HOSO_AI_FAKE_CLASSIFY_SECONDS": "1"})
    engines = build_engines(settings)
    assert (engines.ocr.page_seconds, engines.ocr.fail_rate) == (0.2, 0.1)
    assert (engines.classifier.seconds, engines.classifier.mixed_from_pages) == (1.0, 6)
    assert build_engines(Settings.from_env(base)).ocr.page_seconds == 0, "mặc định chạy ngay, không làm chậm test"
    with pytest.raises(SettingsError, match="0 đến 1"):
        Settings.from_env(base | {"HOSO_AI_FAKE_FAIL_RATE": "2"})
    with pytest.raises(SettingsError, match="production"):
        Settings.from_env(base | {"HOSO_ENV": "production"})
    assert Settings.from_env({**base, "HOSO_AI_PROFILE": "mac-mlx", "HOSO_ENV": "production"}).profile == "mac-mlx"
