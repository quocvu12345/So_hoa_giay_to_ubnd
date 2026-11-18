"""AI-21: vùng nguồn của trường cho engine thật (khối bố cục OCR, lớp chữ PDF), không phụ thuộc engine."""
from __future__ import annotations

from pathlib import Path

import pytest

from conftest import FakeStorage, make_job
from hoso_ai.contracts import FieldSuggestion, PageInfo, PageResult, Suggestion
from hoso_ai.engines.base import Engines
from hoso_ai.engines.fake import FakeOcr
from hoso_ai.engines.pdfium import PdfiumReader
from hoso_ai.engines.quality import PillowQualityChecker
from hoso_ai.regions import approximate_by_lines, blocks_with_regions, locate_in_blocks, locate_regions
from hoso_ai.runtime.scheduler import ModelScheduler
from hoso_ai.worker import Worker

SAMPLE = Path(__file__).resolve().parents[2] / "database/samples/public-019.pdf"

# Kích thước và khối lấy từ lần chạy thật PaddleOCR-VL trên public-016.pdf (ảnh 1698 x 2400).
RES = {"width": 1698, "height": 2400, "doc_preprocessor_res": {"angle": 0}, "parsing_res_list": [
    {"block_label": "text", "block_bbox": [335, 263, 657, 314], "block_content": "Số: 04 /NQ-HĐND"},
    {"block_label": "header", "block_bbox": [912, 263, 1526, 312], "block_content": "Từ Liêm, ngày 27 tháng 3 năm 2026"},
    {"block_label": "doc_title", "block_bbox": [432, 347, 1338, 491], "block_content": "NGHỊ QUYẾT\nVề Kế hoạch tổ chức các kỳ họp trong năm 2026"},
]}


def field(label: str, value: str, quote: str = "", page: int = 1) -> FieldSuggestion:
    return FieldSuggestion(label, label, value, quote or value, (page,), True)


def suggestion(*fields: FieldSuggestion) -> Suggestion:
    return Suggestion("classifier", "U02", "U02-D01", "Kế hoạch", "t", "r", "q", True, False, tuple(fields))


def ocr_page(data: dict = RES) -> PageResult:
    return PageResult(1, "ocr", "\n\n".join(b["block_content"] for b in data["parsing_res_list"]), blocks=blocks_with_regions(data))


def test_khoi_bo_cuc_doi_sang_ti_le_trang():
    blocks = blocks_with_regions(RES)
    assert blocks[0]["region"] == {"x": round(335 / 1698, 4), "y": round(263 / 2400, 4),
                                   "width": round((657 - 335) / 1698, 4), "height": round((314 - 263) / 2400, 4)}
    assert all(0 <= b["region"]["x"] <= 1 and b["region"]["x"] + b["region"]["width"] <= 1 for b in blocks)
    assert blocks[0]["block_content"] == "Số: 04 /NQ-HĐND" and "region" not in RES["parsing_res_list"][0]   # không sửa dữ liệu gốc


def test_trang_bi_xoay_hoac_thieu_kich_thuoc_thi_khong_co_vung():
    rotated = RES | {"doc_preprocessor_res": {"angle": 90}}
    assert all("region" not in b for b in blocks_with_regions(rotated))
    assert all("region" not in b for b in blocks_with_regions({"parsing_res_list": RES["parsing_res_list"]}))
    # Khung có toạ độ ngoài ảnh được cắt về trong trang, khung không còn diện tích thì bỏ.
    out = blocks_with_regions({"width": 100, "height": 100, "parsing_res_list": [
        {"block_bbox": [90, 90, 150, 150], "block_content": "a"}, {"block_bbox": [10, 10, 10, 20], "block_content": "b"}]})
    assert out[0]["region"] == {"x": 0.9, "y": 0.9, "width": 0.1, "height": 0.1} and "region" not in out[1]


def test_trich_dan_la_ca_khoi_thi_khung_chinh_xac():
    region = locate_in_blocks(ocr_page(), ["Số: 04 /NQ-HĐND"])
    assert region and region["page"] == 1 and "approximate" not in region
    assert region["x"] == round(335 / 1698, 4) and region["width"] == round(322 / 1698, 4)


def test_trich_dan_la_mot_phan_khoi_thi_uoc_theo_chu_va_danh_dau():
    region = locate_in_blocks(ocr_page(), ["27 tháng 3 năm 2026"])
    block_x, block_w = round(912 / 1698, 4), round(614 / 1698, 4)
    assert region["approximate"] is True
    assert block_x < region["x"] < block_x + block_w                 # nằm sau "Từ Liêm, ngày " trong khối
    assert region["x"] + region["width"] <= block_x + block_w + 1e-3
    # Nhiều dòng trong khối: chỉ lấy dải dòng chứa trích dẫn.
    second = locate_in_blocks(ocr_page(), ["Về Kế hoạch tổ chức"])
    assert second["approximate"] is True and second["y"] > round(347 / 2400, 4) + 0.02
    assert second["height"] == pytest.approx(round(144 / 2400, 4) / 2, abs=1e-3)


# Bảng thật PaddleOCR-VL trả cho biểu mẫu kiểm tra hiện trạng đất (ô ghi xuống dòng bằng chuỗi "\\n" hai ký tự).
TABLE = ('<table><tr><td>Số/ký hiệu nếu có\\n186/TEST</td><td>Ngày, giờ lập\\n09 giờ 30 phút, ngày 12/11/2026</td></tr>'
         '<tr><td>Địa điểm\\nPhòng hợp số 2</td><td>Thành phần tham gia\\nNguyễn Minh Quân; Trần Thị Hà</td></tr>'
         '<tr><td>Nội dung, kết quả\\nĐã kiểm tra 12 hồ sơ</td><td>Người ký\\nNguyễn Minh Quân</td></tr></table>\n')
TABLE_BOX = {"x": 0.0754, "y": 0.1925, "width": 0.8491, "height": 0.1688}


def table_page() -> PageResult:
    return PageResult(1, "ocr", "bảng", blocks=[{"block_label": "table", "block_content": TABLE, "region": TABLE_BOX}])


def test_gia_tri_trong_bang_dinh_vi_theo_o_va_dong_gia_tri():
    page = table_page()
    number = locate_in_blocks(page, ["186/TEST"], "Số/ký hiệu")
    assert number["approximate"] is True                                          # chiều cao hàng chỉ là ước tính
    assert number["x"] == TABLE_BOX["x"] and number["width"] == pytest.approx(TABLE_BOX["width"] / 2, abs=1e-3)   # ô trái
    row_h = TABLE_BOX["height"] / 6                                               # 3 hàng x 2 dòng chữ
    assert number["y"] == pytest.approx(TABLE_BOX["y"] + row_h, abs=1e-3)         # dòng giá trị, bên dưới dòng nhãn
    assert number["height"] == pytest.approx(row_h, abs=1e-3)


def test_cung_mot_gia_tri_o_hai_o_thi_chon_o_co_nhan_cua_truong():
    page = table_page()
    signer = locate_in_blocks(page, ["Nguyễn Minh Quân"], "Người ký")
    attendees = locate_in_blocks(page, ["Nguyễn Minh Quân"], "Thành phần")
    assert signer["y"] > attendees["y"]                                           # Người ký ở hàng 3, Thành phần ở hàng 2
    assert signer["x"] == pytest.approx(TABLE_BOX["x"] + TABLE_BOX["width"] / 2, abs=1e-3)
    assert locate_in_blocks(page, ["Nguyễn Minh Quân"])["y"] == attendees["y"]    # không có nhãn thì lấy chỗ đầu tiên theo thứ tự đọc


def test_khop_khong_phan_biet_hoa_thuong_khoang_trang_va_xuong_dong():
    page = ocr_page()
    assert locate_in_blocks(page, ["NGHỊ  QUYẾT về kế hoạch"]) is not None
    assert locate_in_blocks(page, ["không có trong trang"]) is None


def test_trich_dan_vat_hai_khoi_thi_thu_gia_tri_roi_dong_dau():
    page = ocr_page()
    split_quote = "Số: 04 /NQ-HĐND Từ Liêm, ngày 27 tháng 3"
    # Nguyên trích dẫn không nằm trong một khối: thử giá trị, rồi dòng đầu trích dẫn.
    result = locate_regions(suggestion(field("Số", "04 /NQ-HĐND", split_quote)), {1: page}, None, None)
    region = result.fields[0].source_region
    # Giá trị chỉ là phần sau "Số: " của khối: cùng hàng với khối, lệch phải so với mép khối, nên ước theo chữ.
    assert region and region["approximate"] is True and region["y"] == pytest.approx(263 / 2400, abs=1e-3)
    assert 335 / 1698 < region["x"] < 657 / 1698
    nothing = locate_regions(suggestion(field("Số", "xxx yyy", "xxx yyy")), {1: page}, None, None)
    assert nothing.fields[0].source_region is None          # trang OCR có khối mà không khớp: không ước bừa


def test_khong_ghi_de_vung_da_co_va_bo_qua_truong_trong():
    page = ocr_page()
    existing = {"page": 1, "x": 0.1, "y": 0.1, "width": 0.1, "height": 0.1}
    given = FieldSuggestion("a", "a", "27 tháng 3 năm 2026", "27 tháng 3 năm 2026", (1,), True, existing, 0.9)
    empty = FieldSuggestion("b", "b", "", "", (), False)
    result = locate_regions(suggestion(given, empty), {1: page}, None, None)
    assert result.fields[0].source_region == existing and result.fields[0].confidence == 0.9
    assert result.fields[1].source_region is None and result.fields[1].confidence is None
    assert all(f.confidence is None for f in locate_regions(suggestion(field("c", "Số: 04 /NQ-HĐND")), {1: page}, None, None).fields)  # không bịa độ tin cậy


def test_trang_chu_pdf_khong_co_khung_thi_uoc_theo_dong():
    page = PageResult(1, "pdf_text", "Dòng một\nDòng hai\nSố: 12/KH-UBND\nDòng bốn")
    region = approximate_by_lines(page, ["12/KH-UBND"])
    assert region["approximate"] is True and 0.4 < region["y"] < 0.7 and 0 < region["x"] < 1


@pytest.mark.skipif(not SAMPLE.is_file(), reason="Không có PDF mẫu")
def test_trang_chu_pdf_that_tim_khung_bang_pdfium():
    pytest.importorskip("pypdfium2")
    reader = PdfiumReader()
    info = reader.inspect(SAMPLE, 50)[0]
    line = next(l.strip() for l in info.native_text.split("\n") if len(l.strip()) > 25)
    page = PageResult(1, "pdf_text", info.native_text, info.native_text)
    result = locate_regions(suggestion(field("t", line[:20], line[:20])), {1: page}, SAMPLE, reader)
    region = result.fields[0].source_region
    assert region and region["page"] == 1 and "approximate" not in region          # khung thật từ PDFium
    assert 0 <= region["x"] < 1 and 0 <= region["y"] < 1 and region["width"] > 0 and region["height"] > 0
    assert region["x"] + region["width"] <= 1.0 and region["y"] + region["height"] <= 1.0
    # Không tìm thấy trong lớp chữ thì ước theo dòng, không mất trường.
    assert reader.locate_texts(SAMPLE, [(1, ["chuỗi không có trong tệp này"]), (99, ["a"])]) == [None, None]


def test_pipeline_dien_vung_cho_truong_cua_engine_that(settings, repo):
    class Classifier:
        key, approx_gb = "classifier", 0.1

        def load(self): ...
        def unload(self): ...

        def suggest(self, pages, catalog, prompt_style="production"):
            return suggestion(field("Số/ký hiệu", "Số: 04 /NQ-HĐND"), field("Ngày", "27 tháng 3 năm 2026"))

    class BlockOcr(FakeOcr):
        def read(self, image, timeout_seconds):
            return ocr_page().text, ocr_page().blocks

    from conftest import FakeReader
    reader = FakeReader([PageInfo(1, "", has_images=True)])
    worker = Worker(settings, repo, Engines(reader, BlockOcr(), Classifier(), PillowQualityChecker()), FakeStorage(Path("/tmp/fake.pdf")), ModelScheduler(6))
    repo.enqueue(make_job())
    worker.run_once()
    saved = repo.suggestions["job-1"]
    assert saved.fields[0].source_region and "approximate" not in saved.fields[0].source_region
    assert saved.fields[1].source_region and saved.fields[1].source_region["approximate"] is True
    assert repo.pages["job-1"][1].blocks[0]["region"]["x"] > 0          # khối đã lưu mang vùng theo tỉ lệ


def test_loi_khi_tim_vung_khong_lam_mat_goi_y(settings, repo, monkeypatch):
    import hoso_ai.pipeline as pipeline

    def broken(*args, **kwargs):
        raise RuntimeError("PDFium lỗi")

    monkeypatch.setattr(pipeline, "locate_regions", broken)
    from conftest import FakeReader
    from hoso_ai.engines.fake import FakeClassifier
    worker = Worker(settings, repo, Engines(FakeReader(), FakeOcr(), FakeClassifier(), PillowQualityChecker()), FakeStorage(Path("/tmp/fake.pdf")), ModelScheduler(6))
    repo.enqueue(make_job())
    worker.run_once()
    assert "job-1" in repo.suggestions
