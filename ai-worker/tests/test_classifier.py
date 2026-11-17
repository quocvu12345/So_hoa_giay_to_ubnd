"""Dùng đầu ra mô hình cố định để kiểm tra prompt/danh mục DB và trích dẫn, không cần GPU."""
import json
import sys
from pathlib import Path
from types import SimpleNamespace

from conftest import LONG_TEXT, FakeReader, FakeStorage, make_job
from hoso_ai.contracts import PageInfo, PageResult
from hoso_ai.engines.mlx import QwenMlxClassifier
from hoso_ai.queue.repository import Catalog, DocumentTypeDef, FieldDef


def test_phan_loai_va_trich_truong_dung_danh_muc_db_hien_tai(monkeypatch, fake_models):
    import document_ai.classify as classify_module

    def no_pilot():
        raise AssertionError("Worker không được đọc danh mục JS")

    monkeypatch.setattr(classify_module, "catalog", no_pilot)
    outputs = iter([
        {"category_code": "CUSTOM", "document_form": "Kế hoạch", "title": "Kế hoạch thử", "quote": "Kế hoạch thử"},
        {"type_id": "CUSTOM-D01"},
        {"fields": [{"label": "Mã tiếp nhận mới", "value": "TEST-123", "quote": "Mã tiếp nhận mới: TEST-123"}]},
    ])
    prompts = []

    def generate(*args, prompt, **kwargs):
        prompts.append(prompt)
        return json.dumps(next(outputs), ensure_ascii=False)

    tokenizer = SimpleNamespace(apply_chat_template=lambda messages, **kwargs: messages[-1]["content"])
    monkeypatch.setitem(sys.modules, "mlx_lm", SimpleNamespace(load=lambda path: (object(), tokenizer), generate=generate))
    monkeypatch.setitem(sys.modules, "mlx_lm.sample_utils", SimpleNamespace(make_sampler=lambda **kwargs: None))
    catalog = Catalog({"CUSTOM": "Nhóm mới", "OTHER": "Nhóm khác"}, {
        "CUSTOM-D01": DocumentTypeDef("CUSTOM-D01", "Kế hoạch mới", "CUSTOM", (
            FieldDef("CUSTOM-F01", "Mã tiếp nhận mới", "text"),)),
        "OTHER-D01": DocumentTypeDef("OTHER-D01", "Kế hoạch khác", "OTHER", ()),
    })
    result = QwenMlxClassifier().suggest([PageResult(2, "ocr", "Kế hoạch thử\nMã tiếp nhận mới: TEST-123")], catalog)
    assert (result.work_group_code, result.document_type_code) == ("CUSTOM", "CUSTOM-D01")
    assert result.fields[0].field_code == "CUSTOM-F01"
    assert result.fields[0].value == "TEST-123"
    assert result.fields[0].source_pages == (2,)
    assert "CUSTOM-D01" in prompts[1] and "OTHER-D01" not in prompts[1]
    assert "Mã tiếp nhận mới" in prompts[2]


def test_pdf_co_lop_chu_van_dat_moi_truong_offline(monkeypatch, fake_models):
    import document_ai.classify as classify_module

    monkeypatch.delenv("HF_HUB_OFFLINE", raising=False)
    monkeypatch.delenv("TRANSFORMERS_OFFLINE", raising=False)
    monkeypatch.setattr(classify_module, "load_classifier", lambda name=None: object())
    QwenMlxClassifier().load()
    import os
    assert os.environ["HF_HUB_OFFLINE"] == "1"
    assert os.environ["TRANSFORMERS_OFFLINE"] == "1"


# ---- AI-13: chọn mô hình bằng cấu hình, nạp một lần, ghi mô hình đã dùng ----------------------------------------------------

import pytest  # noqa: E402

from hoso_ai.engines.base import Engines  # noqa: E402
from hoso_ai.engines.fake import FakeClassifier, FakeOcr  # noqa: E402
from hoso_ai.engines.quality import PillowQualityChecker  # noqa: E402
from hoso_ai.runtime.scheduler import ModelScheduler  # noqa: E402
from hoso_ai.settings import Settings, SettingsError  # noqa: E402
from hoso_ai.worker import Worker  # noqa: E402

CATALOG = Catalog({"CUSTOM": "Nhóm mới"}, {
    "CUSTOM-D01": DocumentTypeDef("CUSTOM-D01", "Kế hoạch mới", "CUSTOM", (FieldDef("CUSTOM-F01", "Mã tiếp nhận mới", "text"),)),
})
PAGES = [PageResult(1, "ocr", "Kế hoạch thử\nMã tiếp nhận mới: TEST-123")]


class FakeMlx:
    """mlx_lm giả: đếm số lần nạp mô hình và ghi lại tham số dựng lời nhắc."""

    def __init__(self, monkeypatch, fields=None):
        self.loads, self.template_kwargs, self.cleared, self.calls = [], [], 0, []
        outputs = [{"category_code": "CUSTOM", "document_form": "Kế hoạch", "title": "Kế hoạch thử", "quote": "Kế hoạch thử"},
                   {"type_id": "CUSTOM-D01"},
                   fields or {"fields": [{"label": "Mã tiếp nhận mới", "value": "TEST-123", "quote": "Mã tiếp nhận mới: TEST-123"}]}]
        self._cycle = 0
        self._outputs = outputs
        mine = self

        def generate(*args, prompt, **kwargs):
            mine.calls.append({"prompt": prompt, **kwargs})
            answer = mine._outputs[mine._cycle % 3]
            mine._cycle += 1
            return json.dumps(answer, ensure_ascii=False)

        def template(messages, **kwargs):
            mine.template_kwargs.append(kwargs)
            return messages[-1]["content"]

        def load(path):
            mine.loads.append(path)
            return object(), SimpleNamespace(apply_chat_template=template)

        monkeypatch.setitem(sys.modules, "mlx_lm", SimpleNamespace(load=load, generate=generate))
        monkeypatch.setitem(sys.modules, "mlx_lm.sample_utils", SimpleNamespace(make_sampler=lambda **kwargs: None))
        monkeypatch.setitem(sys.modules, "mlx", SimpleNamespace(core=SimpleNamespace(clear_cache=lambda: setattr(mine, "cleared", mine.cleared + 1))))
        monkeypatch.setitem(sys.modules, "mlx.core", sys.modules["mlx"].core)


def test_mo_hinh_nap_mot_lan_qua_nhieu_tai_lieu_va_nap_lai_sau_khi_bo(monkeypatch, fake_models):
    mlx = FakeMlx(monkeypatch)
    classifier = QwenMlxClassifier()
    classifier.load()
    for _ in range(3):
        assert classifier.suggest(PAGES, CATALOG).document_type_code == "CUSTOM-D01"
    assert len(mlx.loads) == 1, "ba tài liệu liên tiếp chỉ nạp mô hình một lần"

    classifier.unload()
    assert mlx.cleared == 1, "bỏ mô hình thì trả bộ nhớ GPU, không chỉ gc"
    classifier.suggest(PAGES, CATALOG)       # không gọi load(): tự nạp lại khi cần
    assert len(mlx.loads) == 2


def test_dung_che_do_khong_suy_nghi_cho_moi_lan_dung_loi_nhac(monkeypatch, fake_models):
    mlx = FakeMlx(monkeypatch)
    QwenMlxClassifier().suggest(PAGES, CATALOG)
    assert mlx.template_kwargs and all(kwargs.get("enable_thinking") is False for kwargs in mlx.template_kwargs)


def test_doi_mo_hinh_bang_bien_moi_truong_va_ghi_dung_nhan_phien_ban(monkeypatch, fake_models):
    mlx = FakeMlx(monkeypatch)
    default = QwenMlxClassifier()
    assert (default.model_name, default.approx_gb) == ("Qwen3-4B-Instruct-2507-ifstruct-4bit", 3.0)
    assert default.version == "Qwen3-4B-Instruct-2507-ifstruct-4bit@00161de", "phiên bản là commit của nguồn, lấy từ phiếu chuyển đổi"

    monkeypatch.setenv("HOSO_AI_CLASSIFIER_MODEL", "Qwen3-1.7B-4bit")
    monkeypatch.setenv("HOSO_AI_CLASSIFIER_GB", "2")
    classifier = QwenMlxClassifier()
    assert (classifier.model_name, classifier.approx_gb) == ("Qwen3-1.7B-4bit", 2.0)
    assert classifier.version == "Qwen3-1.7B-4bit@3b1b176"
    classifier.suggest(PAGES, CATALOG)
    assert mlx.loads == [str(fake_models / "Qwen3-1.7B-4bit")]


def test_nhan_mo_hinh_trong_ket_qua_lay_tu_mo_hinh_dang_chay_khong_ghi_cung(monkeypatch, fake_models):
    import document_ai.classify as classify_module

    FakeMlx(monkeypatch)
    llm = classify_module.load_classifier()
    result = classify_module.classify([{"page": 1, "text": "Kế hoạch thử\nMã tiếp nhận mới: TEST-123"}],
                                      [{"code": "CUSTOM", "title": "Nhóm mới", "group": "", "documentTypes": [
                                          {"id": "CUSTOM-D01", "name": "Kế hoạch mới", "fields": ["Mã tiếp nhận mới"]}]}], llm=llm)
    assert result["model"] == "Qwen3-4B-Instruct-2507-ifstruct · MLX 4-bit"


@pytest.mark.parametrize("bad", ["../Qwen3-4B", "/etc", "a/b", "Qwen3 4B", "-x", ""])
def test_ten_mo_hinh_khong_duoc_tro_ra_ngoai_thu_muc_mo_hinh(bad):
    from document_ai.config import DEFAULT_CLASSIFIER, classifier_name

    if bad == "":
        assert classifier_name({"HOSO_AI_CLASSIFIER_MODEL": bad}) == DEFAULT_CLASSIFIER
    else:
        with pytest.raises(ValueError):
            classifier_name({"HOSO_AI_CLASSIFIER_MODEL": bad})


def test_thieu_mo_hinh_dung_ngay_luc_khoi_dong_kem_goi_y(monkeypatch, fake_models):
    monkeypatch.setenv("HOSO_AI_CLASSIFIER_MODEL", "Qwen3-9B-4bit")
    with pytest.raises(FileNotFoundError, match="Qwen3-4B-Instruct-2507-ifstruct-4bit"):
        QwenMlxClassifier()

    from hoso_ai.engines.factory import build_engines

    settings = Settings.from_env({"HOSO_AI_PROFILE": "mac-mlx", "HOSO_AI_CLASSIFIER_MODEL": "Qwen3-9B-4bit"})
    assert settings.classifier_model == "Qwen3-9B-4bit"
    with pytest.raises(SettingsError, match="Qwen3-9B-4bit"):
        build_engines(settings)


def test_cau_hinh_mo_hinh_phan_loai_mac_dinh_la_khong_dat():
    assert Settings.from_env({"HOSO_AI_PROFILE": "fake"}).classifier_model is None


def test_ghi_mo_hinh_da_dung_vao_job_chi_ghi_ocr_khi_that_su_dung_ocr(settings, repo):
    class Versioned(FakeOcr):
        version = "ocr-giả@1"

    class VersionedClassifier(FakeClassifier):
        version = "llm-giả@2"

    def run(reader):
        worker = Worker(settings, repo, Engines(reader, Versioned(), VersionedClassifier(), PillowQualityChecker()),
                        FakeStorage(Path("/tmp/fake.pdf")), ModelScheduler(6))
        job = make_job(f"job-{len(repo.rows) + 1}")
        repo.enqueue(job)
        assert worker.run_once()
        return repo.rows[job.id].model_version

    assert run(FakeReader()) == "ocr=ocr-giả@1 classifier=llm-giả@2/short"    # make_job không đặt mức: mặc định 5 là việc có người chờ
    clean = [PageInfo(n, LONG_TEXT, has_images=False) for n in (1, 2, 3)]
    assert run(FakeReader(clean)) == "classifier=llm-giả@2/short", "mọi trang lấy từ lớp chữ thì không ghi mô hình OCR"


def test_mo_ta_mo_hinh_lay_repo_va_phien_ban_tu_tep_tai_ve(fake_models):
    from document_ai.config import model_identity, model_version

    identity = model_identity(fake_models / "Qwen3-1.7B-4bit")
    assert identity == {"name": "Qwen3-1.7B-4bit", "repo": "mlx-community/Qwen3-1.7B-4bit", "revision": "3b1b1768f8f8cf8351c712464f906e86c2b8269e"}
    assert model_version(fake_models / "Qwen3-1.7B-4bit") == "Qwen3-1.7B-4bit@3b1b176"

    # Bản tự chuyển: repo và commit lấy từ phiếu chuyển đổi, không lấy tiêu đề README do công cụ chuyển ghi.
    converted = fake_models / "Qwen3-4B-Instruct-2507-ifstruct-4bit"
    assert model_identity(converted) == {"name": converted.name, "repo": "ChetanDhembreAI/Qwen3-4B-Instruct-2507-ifstruct",
                                         "revision": "00161de525486e01ba505e6c24f39472fdfe4a23"}


# ---- AI-14: kiểu lời nhắc theo mức ưu tiên ---------------------------------------------------------------------------------------

def test_loi_nhac_ngan_chi_hoi_label_va_value_va_gioi_han_dau_ra(monkeypatch, fake_models):
    mlx = FakeMlx(monkeypatch)
    QwenMlxClassifier().suggest(PAGES, CATALOG, prompt_style="short")
    fields_call = mlx.calls[2]
    assert "chép nguyên văn từ tài liệu" in fields_call["prompt"] and '"quote"' not in fields_call["prompt"]
    assert fields_call["max_tokens"] == 1200
    assert "Chọn category_code" in mlx.calls[0]["prompt"], "bước chọn nhóm giữ nguyên lời nhắc chính"


def test_loi_nhac_chinh_van_xin_trich_dan(monkeypatch, fake_models):
    mlx = FakeMlx(monkeypatch)
    QwenMlxClassifier().suggest(PAGES, CATALOG)
    assert '"quote"' in mlx.calls[2]["prompt"] and mlx.calls[2]["max_tokens"] == 2600


def test_loi_nhac_ngan_van_phai_co_nguyen_van_trong_van_ban(monkeypatch, fake_models):
    import document_ai.classify as classify_module

    no_quote = {"fields": [{"label": "Mã tiếp nhận mới", "value": "TEST-123"}]}       # bản ngắn không trả trích dẫn
    FakeMlx(monkeypatch, no_quote)
    llm = classify_module.load_classifier()
    categories = [{"code": "CUSTOM", "title": "Nhóm mới", "group": "", "documentTypes": [
        {"id": "CUSTOM-D01", "name": "Kế hoạch mới", "fields": ["Mã tiếp nhận mới"]}]}]
    ok = classify_module.classify([{"page": 1, "text": "Kế hoạch thử\nMã tiếp nhận mới: TEST-123"}], categories, llm=llm, prompt_style="short")
    assert [f["value"] for f in ok["fields"]] == ["TEST-123"] and ok["prompt_style"] == "short"
    assert ok["fields"][0]["quote"] == "TEST-123" and ok["fields"][0]["source_pages"] == [1]

    FakeMlx(monkeypatch, no_quote)       # mô hình "bịa" giá trị không có trong văn bản: bị loại dù không có trích dẫn để đối chiếu
    llm = classify_module.load_classifier()
    invented = classify_module.classify([{"page": 1, "text": "Kế hoạch thử\nKhông có mã nào ở đây"}], categories, llm=llm, prompt_style="short")
    assert [f["value"] for f in invented["fields"]] == [""]


def test_kieu_loi_nhac_la_gia_tri_hop_le(monkeypatch, fake_models):
    FakeMlx(monkeypatch)
    with pytest.raises(ValueError, match="prompt_style"):
        QwenMlxClassifier().suggest(PAGES, CATALOG, prompt_style="nhanh")
    with pytest.raises(SettingsError, match="HOSO_AI_PROMPT_BACKGROUND"):
        Settings.from_env({"HOSO_AI_PROFILE": "fake", "HOSO_AI_PROMPT_BACKGROUND": "nhanh"})
    settings = Settings.from_env({"HOSO_AI_PROFILE": "fake"})
    assert (settings.prompt_interactive, settings.prompt_background, settings.background_from) == ("short", "production", 7)
    assert settings.model_budget_gb == 7, "Mac 16 GB: OCR (4,5 GB) và IFStruct (3 GB) thay phiên nạp; máy nhiều RAM hơn đặt 8 để giữ cả hai"


def test_viec_nen_va_viec_co_nguoi_cho_dung_kieu_loi_nhac_rieng(repo):
    import dataclasses

    styles = []

    class Recording(FakeClassifier):
        def suggest(self, pages, catalog, prompt_style="production"):
            styles.append(prompt_style)
            return super().suggest(pages, catalog, prompt_style)

    settings = Settings.from_env({"HOSO_AI_PROFILE": "fake", "HOSO_AI_PROMPT_INTERACTIVE": "short", "HOSO_AI_PROMPT_BACKGROUND": "production",
                                  "HOSO_AI_WORK_ROOT": "/tmp/hoso-ai-test-work", "HOSO_AI_STORAGE_ROOT": "/tmp/hoso-ai-test-blobs"})
    worker = Worker(settings, repo, Engines(FakeReader(), FakeOcr(), Recording(), PillowQualityChecker()), FakeStorage(Path("/tmp/fake.pdf")), ModelScheduler(6))
    for index, priority in enumerate((1, 3, 6, 7, 9)):
        repo.enqueue(dataclasses.replace(make_job(f"job-{index}"), priority=priority))
        assert worker.run_once()
    assert styles == ["short", "short", "short", "production", "production"]
    assert repo.rows["job-0"].model_version.endswith("/short") and repo.rows["job-3"].model_version.endswith("/production")


def test_mac_dinh_la_ifstruct_va_doi_mo_hinh_bang_cau_hinh(monkeypatch, fake_models):
    """Chốt 17/11/2026: IFStruct (Qwen3-4B-Instruct-2507 tinh chỉnh tuân thủ JSON/schema) thay Qwen3-4B gốc và 1.7B. Đổi mô hình chỉ bằng biến môi trường."""
    from document_ai.config import DEFAULT_CLASSIFIER, MODELS, classifier_name, model_path

    assert DEFAULT_CLASSIFIER == "Qwen3-4B-Instruct-2507-ifstruct-4bit" == classifier_name({})
    assert MODELS["classifier"][:3] == ("ChetanDhembreAI/Qwen3-4B-Instruct-2507-ifstruct", "00161de525486e01ba505e6c24f39472fdfe4a23",
                                        "Qwen3-4B-Instruct-2507-ifstruct-bf16")
    assert model_path("classifier") == fake_models / DEFAULT_CLASSIFIER, "worker nạp bản 4-bit đã chuyển, không nạp nguồn BF16"
    assert QwenMlxClassifier().model_name == DEFAULT_CLASSIFIER
    monkeypatch.setenv("HOSO_AI_CLASSIFIER_MODEL", "Qwen3-1.7B-4bit")
    assert QwenMlxClassifier().model_name == "Qwen3-1.7B-4bit"


def test_hinh_thuc_giong_cong_van_nhung_nhom_khong_co_loai_trung_ten_thi_van_chon_loai_trong_nhom():
    """Mô hình nhỏ hay chép cả dòng phụ đề ("Công văn, quyết định, thông báo...") vào document_form: không được bỏ qua bước chọn loại."""
    from document_ai.classify import type_candidates

    group = {"code": "U04", "documentTypes": [{"id": "U04-D01", "name": "Lịch tiếp công dân"}, {"id": "U04-D02", "name": "Đơn thư phản ánh"}]}
    assert [t["id"] for t in type_candidates([group], group, "Công văn, quyết định, thông báo và sổ đăng ký")] == ["U04-D01", "U04-D02"]
    other = {"code": "U02", "documentTypes": [{"id": "U02-D01", "name": "Công văn chỉ đạo"}, {"id": "U02-D02", "name": "Kế hoạch"}]}
    assert [t["id"] for t in type_candidates([group, other], group, "Công văn")] == ["U02-D01"], "có loại trùng tên thì vẫn thu hẹp như cũ"
