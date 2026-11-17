"""AI-20: thu hẹp nhóm và loại ứng viên bằng từ khóa trước khi hỏi mô hình nhỏ."""
import json
import sys
from types import SimpleNamespace

from document_ai.shortlist import Scorer, tokens

CATEGORIES = [
    {"code": "A", "title": "Đất đai", "group": "", "documentTypes": [
        {"id": "A-1", "name": "Hợp đồng chuyển nhượng quyền sử dụng đất", "fields": []},
        {"id": "A-2", "name": "Đơn đăng ký biến động đất đai", "fields": []}]},
    {"code": "B", "title": "Phương tiện giao thông", "group": "", "documentTypes": [
        {"id": "B-1", "name": "Giấy khai đăng ký xe", "fields": []},
        {"id": "B-2", "name": "Giấy khai thu hồi chứng nhận đăng ký xe, biển số xe", "fields": []}]},
    {"code": "C", "title": "Chỉ đạo, điều hành", "group": "", "documentTypes": [
        {"id": "C-1", "name": "Báo cáo công tác", "fields": []},
        {"id": "C-2", "name": "Kế hoạch công tác", "fields": []}]},
]


def test_nhom_khop_tieu_de_dung_dau_va_loai_cu_the_hon_dung_truoc():
    scorer = Scorer(CATEGORIES)
    text = "[Trang 1]\nCỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nGIẤY KHAI THU HỒI CHỨNG NHẬN ĐĂNG KÝ XE, BIỂN SỐ XE\nChủ xe: Trần Văn Hòa"
    assert scorer.rank_groups(text)[0] == "B"
    ranked = scorer.rank_types(text, CATEGORIES[1]["documentTypes"])
    assert [t["id"] for t in ranked] == ["B-2", "B-1"], "loại có tên khớp nguyên văn đứng trước loại chung hơn"


def test_khong_khop_gi_thi_giu_nguyen_danh_muc_de_mo_hinh_chon_nhu_cu():
    scorer = Scorer(CATEGORIES)
    text = "Thư mời họp mặt cựu chiến binh"
    assert scorer.rank_groups(text) is None
    assert scorer.rank_types(text, CATEGORIES[0]["documentTypes"]) == CATEGORIES[0]["documentTypes"]


def test_tu_pho_bien_va_dong_danh_dau_trang_khong_gay_nhieu():
    assert tokens("Của và các theo trong [Trang 1] ngày tháng năm") == ["trang"], "chỉ còn từ có nghĩa; dấu trang bị lọc ở bước lấy phần đầu"
    scorer = Scorer(CATEGORIES)
    assert scorer.rank_groups("[Trang 1]\n[Trang 2]\nngày tháng năm của và") is None


def test_gioi_han_so_nhom_va_loai_dua_cho_mo_hinh():
    many = [{"code": f"G{n:02d}", "title": f"Nhóm số {n}", "group": "",
             "documentTypes": [{"id": f"G{n:02d}-D{m:02d}", "name": f"Loại {m} của nhóm {n}", "fields": []} for m in range(1, 15)]} for n in range(1, 13)]
    scorer = Scorer(many)
    text = "LOẠI 3 CỦA NHÓM 5\nNội dung"
    assert len(scorer.rank_groups(text, 8)) == 8
    assert len(scorer.rank_types(text, many[4]["documentTypes"], 10)) == 10
    assert scorer.rank_types(text, many[4]["documentTypes"])[0]["id"] == "G05-D03"


def test_classify_chi_dua_cho_mo_hinh_cac_nhom_va_loai_khop_nhat(monkeypatch, fake_models):
    import document_ai.classify as classify_module

    prompts, answers = [], iter([{"category_code": "B", "document_form": "Giấy khai", "title": "t", "quote": "q"}, {"type_id": "B-2"}, {"fields": []}])
    tokenizer = SimpleNamespace(apply_chat_template=lambda messages, **kwargs: messages[-1]["content"])

    def generate(*args, prompt, **kwargs):
        prompts.append(prompt)
        return json.dumps(next(answers), ensure_ascii=False)

    monkeypatch.setitem(sys.modules, "mlx_lm", SimpleNamespace(load=lambda path: (object(), tokenizer), generate=generate))
    monkeypatch.setitem(sys.modules, "mlx_lm.sample_utils", SimpleNamespace(make_sampler=lambda **kwargs: None))
    many = [{"code": f"G{n:02d}", "title": f"Nhóm số {n}", "group": "", "documentTypes": [{"id": f"G{n:02d}-D01", "name": f"Mục {n}", "fields": []}]} for n in range(1, 13)]
    many.append(CATEGORIES[1] | {"code": "B"})
    llm = classify_module.load_classifier()
    # thiếu hai chữ đầu "giấy khai" nên chưa đủ chắc chắn để bỏ qua mô hình: mô hình vẫn được hỏi, nhưng chỉ trong danh sách đã thu hẹp
    result = classify_module.classify([{"page": 1, "text": "THU HỒI CHỨNG NHẬN ĐĂNG KÝ XE, BIỂN SỐ XE"}], many, llm=llm, shortlist=True, restrict_types_to_group=True)
    menu = json.loads(prompts[0].split("CATALOG:\n")[1].split("\n<DOCUMENT>")[0])
    assert len(menu) == 8 and menu[0]["code"] == "B", "13 nhóm chỉ đưa 8, nhóm khớp nhất đứng đầu"
    types = json.loads(prompts[1].split("TYPES:\n")[1].split("\n<DOCUMENT>")[0])
    assert [t["id"] for t in types] == ["B-2", "B-1"], "loại khớp nhất đứng đầu danh sách"
    assert result["type_id"] == "B-2" and result["shortlist"] is True

    prompts.clear()
    answers = iter([{"category_code": "B", "document_form": "Giấy khai", "title": "t", "quote": "q"}, {"type_id": "B-2"}, {"fields": []}])
    classify_module.classify([{"page": 1, "text": "GIẤY KHAI THU HỒI CHỨNG NHẬN ĐĂNG KÝ XE, BIỂN SỐ XE"}], many, llm=llm)
    assert len(json.loads(prompts[0].split("CATALOG:\n")[1].split("\n<DOCUMENT>")[0])) == 13, "không bật thì đưa đủ danh mục như trước"


def test_worker_bat_thu_hep_ung_vien_bang_bien_moi_truong(monkeypatch, fake_models):
    from document_ai.config import shortlist_enabled
    from hoso_ai.contracts import PageResult
    from hoso_ai.engines.mlx import QwenMlxClassifier
    from hoso_ai.queue.repository import Catalog, DocumentTypeDef

    assert shortlist_enabled({}) is False and shortlist_enabled({"HOSO_AI_SHORTLIST": "on"}) is True and shortlist_enabled({"HOSO_AI_SHORTLIST": "off"}) is False
    seen = []

    def fake_classify(pages, categories, **kwargs):
        seen.append(kwargs.get("shortlist"))
        return {"category_code": None, "fields": []}

    import document_ai.classify as classify_module

    monkeypatch.setattr(classify_module, "classify", fake_classify)
    monkeypatch.setattr(classify_module, "load_classifier", lambda name=None: object())
    catalog = Catalog({"A": "Nhóm"}, {"A-1": DocumentTypeDef("A-1", "Loại", "A", ())})
    for value in ("off", "on"):
        monkeypatch.setenv("HOSO_AI_SHORTLIST", value)
        QwenMlxClassifier().suggest([PageResult(1, "ocr", "chữ")], catalog)
    assert seen == [False, True]


def _fake_llm(monkeypatch, answers):
    import document_ai.classify as classify_module

    prompts = []
    tokenizer = SimpleNamespace(apply_chat_template=lambda messages, **kwargs: messages[-1]["content"])
    queue = iter(answers)

    def generate(*args, prompt, **kwargs):
        prompts.append(prompt)
        return json.dumps(next(queue), ensure_ascii=False)

    monkeypatch.setitem(sys.modules, "mlx_lm", SimpleNamespace(load=lambda path: (object(), tokenizer), generate=generate))
    monkeypatch.setitem(sys.modules, "mlx_lm.sample_utils", SimpleNamespace(make_sampler=lambda **kwargs: None))
    return classify_module, classify_module.load_classifier(), prompts


def test_tai_lieu_tu_ghi_ten_loai_o_dau_thi_tin_chu_trong_tai_lieu_hon_lua_chon_sai_cua_mo_hinh(monkeypatch, fake_models):
    classify_module, llm, prompts = _fake_llm(monkeypatch, [
        {"category_code": "A", "document_form": "Giấy khai", "title": "Giấy khai thu hồi", "quote": "q", "reason": "mô hình chọn nhầm"},
        {"fields": []}])
    text = "GIẤY KHAI THU HỒI CHỨNG NHẬN ĐĂNG KÝ XE, BIỂN SỐ XE\nChủ xe: Trần Văn Hòa"
    result = classify_module.classify([{"page": 1, "text": text}], CATEGORIES, llm=llm, shortlist=True, restrict_types_to_group=True)
    assert (result["category_code"], result["type_id"], result["type_chosen_by"]) == ("B", "B-2", "document_title")
    assert "xuất hiện ở đầu tài liệu" in result["reason"] and "mô hình chọn nhầm" in result["reason"], "ghi rõ vì sao đổi, giữ lý do của mô hình"
    assert all("TYPES:" not in p for p in prompts), "không hỏi mô hình bước chọn loại khi tài liệu đã ghi rõ"


def test_ten_loai_trung_o_nhieu_nhom_la_khong_chac_chan_nen_van_hoi_mo_hinh(monkeypatch, fake_models):
    twin = [{"code": code, "title": f"Nhóm {code}", "group": "", "documentTypes": [{"id": f"{code}-1", "name": "Báo cáo công tác", "fields": []}]} for code in ("X", "Y")]
    classify_module, llm, prompts = _fake_llm(monkeypatch, [
        {"category_code": "Y", "document_form": "Báo cáo", "title": "t", "quote": "q"}, {"type_id": "Y-1"}, {"fields": []}])
    result = classify_module.classify([{"page": 1, "text": "BÁO CÁO CÔNG TÁC năm 2026"}], twin, llm=llm, shortlist=True, restrict_types_to_group=True)
    assert (result["category_code"], result["type_id"]) == ("Y", "Y-1") and "type_chosen_by" not in result
    assert any("TYPES:" in p for p in prompts)


def test_khong_bat_thu_hep_thi_khong_doi_ket_qua_cua_mo_hinh(monkeypatch, fake_models):
    classify_module, llm, prompts = _fake_llm(monkeypatch, [
        {"category_code": "A", "document_form": "Giấy khai", "title": "t", "quote": "q"}, {"type_id": "A-1"}, {"fields": []}])
    result = classify_module.classify([{"page": 1, "text": "GIẤY KHAI THU HỒI CHỨNG NHẬN ĐĂNG KÝ XE, BIỂN SỐ XE"}], CATEGORIES, llm=llm, restrict_types_to_group=True)
    assert (result["category_code"], result["type_id"]) == ("A", "A-1") and result["shortlist"] is False


def test_ten_loai_nam_trong_dong_tieu_de_in_hoa_thang_ten_loai_nam_trong_cau_van_thuong():
    """Biểu mẫu xe: tiêu đề thật là "GIẤY KHAI THU HỒI..." còn "Hợp đồng mua bán xe" chỉ là một mục giấy tờ kèm theo."""
    categories = [{"code": "B", "title": "Phương tiện", "group": "", "documentTypes": [
        {"id": "B-1", "name": "Giấy khai thu hồi chứng nhận đăng ký xe", "fields": []},
        {"id": "B-2", "name": "Hợp đồng mua bán xe", "fields": []}]}, CATEGORIES[0], CATEGORIES[2]]
    scorer = Scorer(categories)
    text = "Mẫu ĐKX11\nGIẤY KHẢI THU HỒI CHỦNG NHẦN ĐẶNG KỶ XE\nGiấy tờ kèm theo: Hợp đồng mua bán xe, chứng từ lệ phí"
    sure = scorer.confident_type(text)
    assert sure is not None and sure[1]["id"] == "B-1", "tiêu đề in hoa thắng dù OCR sai dấu và loại kia cũng có mặt nguyên văn"


def test_nhom_ap_dao_khi_hai_loai_trong_cung_nhom_khop_ngang_nhau():
    categories = [{"code": "B", "title": "Phương tiện", "group": "", "documentTypes": [
        {"id": "B-1", "name": "Giấy khai đăng ký xe", "fields": []}, {"id": "B-2", "name": "Giấy khai sang tên xe", "fields": []}]}, CATEGORIES[0], CATEGORIES[2]]
    scorer = Scorer(categories)
    text = "giấy khai đăng ký xe và giấy khai sang tên xe"        # hai loại hòa điểm → không có loại chắc chắn, nhưng nhóm thì rõ
    assert scorer.confident_type(text) is None
    assert scorer.decisive_group(text)["code"] == "B"
    assert scorer.decisive_group("Thư mời họp mặt cựu chiến binh") is None


def test_goi_quet_nhieu_giay_to_duoc_danh_dau_can_tach(monkeypatch, fake_models):
    classify_module, llm, prompts = _fake_llm(monkeypatch, [
        {"category_code": "A", "document_form": "Công văn", "title": "t", "quote": "q", "mixed_documents": False}, {"type_id": "A-1"}, {"fields": []}])
    pages = [{"page": 1, "text": "HỢP ĐỒNG CHUYỂN NHƯỢNG QUYỀN SỬ DỤNG ĐẤT\nBên A: Nguyễn Văn An, bên B: Trần Thị Bình, thửa đất số 12"},
             {"page": 2, "text": "Điều 2. Giá chuyển nhượng và phương thức thanh toán, thửa đất số 12 tờ bản đồ số 3 phường Từ Liêm"},
             {"page": 3, "text": "GIẤY KHAI ĐĂNG KÝ XE\nChủ xe: Lê Thị Thu, biển số: TEST-001, nhãn hiệu HONDA, số máy 000123"}]
    result = classify_module.classify(pages, CATEGORIES, llm=llm, shortlist=True)
    assert result["mixed_documents"] is True and "trang 1" in result["reason"] and "trang 3" in result["reason"]

    _, llm_single, _ = _fake_llm(monkeypatch, [{"category_code": "A", "document_form": "Hợp đồng", "title": "t", "quote": "q"}, {"type_id": "A-1"}, {"fields": []}])
    single = classify_module.classify(pages[:2], CATEGORIES, llm=llm_single, shortlist=True)
    assert single["mixed_documents"] is False, "hai trang cùng một hợp đồng không bị coi là gói nhiều giấy tờ"
