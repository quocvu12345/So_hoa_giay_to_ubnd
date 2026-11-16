from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path

import pytest

from hoso_ai.engines.quality import PillowQualityChecker
from hoso_ai.logging import JsonFormatter
from hoso_ai.runtime.scheduler import ModelScheduler
from hoso_ai.settings import Settings, SettingsError
from hoso_ai.status_http import health, render_metrics
from hoso_ai.storage import LocalBlobStorage, StorageError
from hoso_ai.worker import WorkerState


class Model:
    def __init__(self, key, gb):
        self.key, self.approx_gb, self.loaded = key, gb, False

    def load(self):
        self.loaded = True

    def unload(self):
        self.loaded = False


def test_may_16gb_chi_giu_mot_mo_hinh_lon():
    scheduler = ModelScheduler(budget_gb=6)
    ocr, llm = Model("ocr", 4.5), Model("classifier", 3)
    with scheduler.use(ocr):
        pass
    with scheduler.use(llm):
        pass
    assert not ocr.loaded and llm.loaded
    assert scheduler.loaded == ("classifier",)


def test_may_lon_giu_ca_hai_mo_hinh():
    scheduler = ModelScheduler(budget_gb=24)
    ocr, llm = Model("ocr", 4.5), Model("classifier", 3)
    with scheduler.use(ocr):
        pass
    with scheduler.use(llm):
        pass
    assert ocr.loaded and llm.loaded


def test_kho_tep_kiem_tra_khoa_va_ma_bam(tmp_path: Path):
    content = b"%PDF-1.7 test"
    sha = hashlib.sha256(content).hexdigest()
    key = f"blobs/{sha[:2]}/{sha[2:4]}/{sha}"
    target = tmp_path.joinpath(*key.split("/"))
    target.parent.mkdir(parents=True)
    target.write_bytes(content)
    storage = LocalBlobStorage(tmp_path)

    assert storage.open_verified(key, sha) == target
    with pytest.raises(StorageError):
        storage.open_verified(key, "0" * 64)
    with pytest.raises(StorageError):
        storage.path_for("blobs/../../etc/passwd")
    with pytest.raises(StorageError):
        storage.path_for(f"blobs/ff/ff/{sha}")  # thư mục không khớp mã băm


def test_trang_trang_bi_gan_co(tmp_path: Path):
    from PIL import Image, ImageDraw

    blank = tmp_path / "blank.png"
    Image.new("RGB", (800, 1100), "white").save(blank)
    written = tmp_path / "written.png"
    image = Image.new("RGB", (800, 1100), "white")
    draw = ImageDraw.Draw(image)
    for y in range(100, 1000, 30):
        draw.line((80, y, 720, y), fill="black", width=3)
    image.save(written)

    checker = PillowQualityChecker()
    assert checker.check(blank) == ("blank",)
    assert "blank" not in checker.check(written)


def test_cau_hinh_sai_bao_ro():
    with pytest.raises(SettingsError, match="HOSO_AI_PROFILE"):
        Settings.from_env({"HOSO_AI_PROFILE": "gpu-cloud"})
    with pytest.raises(SettingsError, match="HOSO_AI_MODEL_BUDGET_GB"):
        Settings.from_env({"HOSO_AI_MODEL_BUDGET_GB": "nhiều"})
    with pytest.raises(SettingsError, match="HOSO_AI_DATABASE_URL"):
        Settings.from_env({}).require_database()


def test_log_khong_ghi_noi_dung_tai_lieu():
    record = logging.LogRecord("hoso_ai", logging.INFO, __file__, 1, "page_saved", None, None)
    record.fields = {"job_id": "j1", "text": "Nguyễn Văn A, CCCD 001...", "value": "x", "pages": 3}
    line = json.loads(JsonFormatter().format(record))
    assert line["job_id"] == "j1" and line["pages"] == 3
    assert line["text"] == "[đã ẩn]" and line["value"] == "[đã ẩn]"
    assert line["service"] == "hoso-ai-worker"


def test_metrics_va_health(settings):
    state, scheduler = WorkerState(), ModelScheduler(6)
    state.jobs["completed"] = 4
    text = render_metrics(state, scheduler)
    assert 'hoso_ai_jobs_total{result="completed"} 4' in text
    status, body = health(state, scheduler, settings)
    assert status == 200 and body["status"] == "ok"


def test_loai_giay_to_phai_thuoc_nhom_da_chon():
    from hoso_ai.catalog_rules import reconcile_type
    from hoso_ai.queue.repository import Catalog, DocumentTypeDef

    catalog = Catalog({"H01": "Kỳ họp", "H02": "Thẩm tra"}, {
        "H01-D03": DocumentTypeDef("H01-D03", "Nghị quyết HĐND", "H01", ()),
        "H02-D07": DocumentTypeDef("H02-D07", "Nghị quyết HĐND", "H02", ()),
        "H02-D09": DocumentTypeDef("H02-D09", "Báo cáo thẩm tra", "H02", ()),
    })
    # Trường hợp gặp khi chạy thật: nhóm H01 nhưng loại thuộc H02 → chuyển về loại cùng tên của H01.
    assert reconcile_type("H01", "H02-D07", catalog) == ("H01-D03", None)
    code, warning = reconcile_type("H01", "H02-D09", catalog)
    assert code is None and "khác nhóm" in warning
    assert reconcile_type("H02", "H02-D09", catalog) == ("H02-D09", None)
    assert reconcile_type("H01", "KHONG-CO", catalog)[0] is None
