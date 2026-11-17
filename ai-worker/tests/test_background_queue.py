"""AI-15: khay nền chạy khi rảnh, nhường chỗ cho việc ưu tiên sau trang hiện tại, ngoài khung giờ chỉ lấy việc có người chờ."""
from __future__ import annotations

import dataclasses
from datetime import datetime
from pathlib import Path

import pytest
from conftest import FakeReader, FakeStorage, make_job
from hoso_ai.contracts import JobStatus, PageInfo
from hoso_ai.engines.base import Engines
from hoso_ai.engines.fake import FakeClassifier, FakeOcr
from hoso_ai.engines.quality import PillowQualityChecker
from hoso_ai.runtime.scheduler import ModelScheduler
from hoso_ai.runtime.windows import BackgroundWindows
from hoso_ai.settings import Settings, SettingsError
from hoso_ai.worker import Worker

IMAGE_PAGES = [PageInfo(n, "", has_images=True) for n in range(1, 11)]     # 10 trang quét, đều phải OCR


def build(settings, repo, ocr=None, now=None):
    engines = Engines(FakeReader(IMAGE_PAGES), ocr or FakeOcr(), FakeClassifier(), PillowQualityChecker())
    worker = Worker(settings, repo, engines, FakeStorage(Path("/tmp/fake.pdf")), ModelScheduler(6), now=now or (lambda: datetime(2026, 11, 17, 12, 0)))
    return worker, engines


def job(job_id, priority):
    return dataclasses.replace(make_job(job_id), priority=priority, page_count=10)


def test_viec_nen_nhuong_sau_trang_hien_tai_roi_chay_tiep_tu_trang_con_thieu(settings, repo):
    class OcrThenPriorityArrives(FakeOcr):
        fired = False

        def read(self, image, timeout_seconds):
            result = super().read(image, timeout_seconds)
            if image.name == "page-3.png" and not self.fired:
                self.fired = True
                repo.enqueue(job("uu-tien", 1))         # người dùng bấm "Trích xuất ngay" khi đang đọc trang 3
            return result

    ocr = OcrThenPriorityArrives()
    worker, _ = build(settings, repo, ocr=ocr)
    repo.enqueue(job("nen", 7))

    assert worker.run_once()                                         # đọc xong trang 3 (đã lưu) rồi nhường
    assert repo.status("nen") is JobStatus.QUEUED
    assert [p for p in repo.pages["nen"]] == [1, 2, 3], "ba trang đã đọc được giữ lại"
    assert repo.rows["nen"].preempted == 1 and repo.rows["nen"].job.attempt == 1, "attempt vẫn tăng đều (mã chống nhầm chủ)"
    assert repo.rows["nen"].job.attempt - repo.rows["nen"].job.preempted == 0, "nhưng nhường chỗ không tính là một lần thử thật"
    assert worker.state.jobs["yielded"] == 1
    assert ocr.calls == ["page-1.png", "page-2.png", "page-3.png"], "không đọc thêm trang nào sau khi có việc ưu tiên"

    assert worker.run_once()                                         # việc ưu tiên chạy trước
    assert repo.status("uu-tien") is JobStatus.COMPLETED and repo.status("nen") is JobStatus.QUEUED

    ocr.calls.clear()
    assert worker.run_once()                                         # quay lại việc nền: chỉ đọc trang 4–10
    assert ocr.calls == [f"page-{n}.png" for n in range(4, 11)]
    assert repo.status("nen") is JobStatus.COMPLETED and repo.rows["nen"].job.attempt == 2 and repo.rows["nen"].job.preempted == 1


def test_viec_da_duoc_nang_muc_khong_con_bi_nhuong(settings, repo):
    class RaisedWhileRunning(FakeOcr):
        def read(self, image, timeout_seconds):
            result = super().read(image, timeout_seconds)
            if image.name == "page-2.png":
                repo.enqueue(job("uu-tien", 1))
                repo.set_priority("nen", 1)             # chính việc đang chạy bị bấm "Trích xuất ngay"
            return result

    worker, engines = build(settings, repo, ocr=RaisedWhileRunning())
    repo.enqueue(job("nen", 7))
    assert worker.run_once()
    assert repo.status("nen") is JobStatus.COMPLETED and len(engines.ocr.calls) == 10
    assert worker.state.jobs["yielded"] == 0


def test_viec_co_nguoi_cho_khong_bao_gio_nhuong(settings, repo):
    class AnotherArrives(FakeOcr):
        def read(self, image, timeout_seconds):
            if image.name == "page-1.png":
                repo.enqueue(job("khac", 1))
            return super().read(image, timeout_seconds)

    worker, engines = build(settings, repo, ocr=AnotherArrives())
    repo.enqueue(job("tuong-tac", 3))
    assert worker.run_once()
    assert repo.status("tuong-tac") is JobStatus.COMPLETED and len(engines.ocr.calls) == 10


def test_viec_nen_khong_nhuong_cho_viec_nen_khac(settings, repo):
    class AnotherBackground(FakeOcr):
        def read(self, image, timeout_seconds):
            if image.name == "page-2.png":
                repo.enqueue(job("nen-2", 7))
            return super().read(image, timeout_seconds)

    worker, engines = build(settings, repo, ocr=AnotherBackground())
    repo.enqueue(job("nen-1", 7))
    assert worker.run_once()
    assert repo.status("nen-1") is JobStatus.COMPLETED and worker.state.jobs["yielded"] == 0


def test_thu_tu_lay_viec_theo_muc_roi_theo_luc_nang_muc(settings, repo):
    worker, _ = build(settings, repo)
    for index in range(3):
        repo.enqueue(job(f"nen-{index}", 7))
    repo.enqueue(job("tuong-tac", 3))
    repo.set_priority("nen-2", 1)            # tải sau cùng nhưng được nâng
    repo.set_priority("nen-1", 1)            # nâng sau nen-2 nên đứng sau nen-2 dù tải trước

    order = []
    while repo.claim.__self__ and (claimed := repo.claim("w")) is not None:
        order.append(claimed.id)
        repo.complete(claimed, "w", (), True)
    assert order == ["nen-2", "nen-1", "tuong-tac", "nen-0"]


def test_ngoai_khung_gio_khay_nen_chi_lay_viec_co_nguoi_cho(repo):
    settings = Settings.from_env({"HOSO_AI_PROFILE": "fake", "HOSO_AI_BACKGROUND_WINDOWS": "17:30-07:30,sat,sun",
                                  "HOSO_AI_WORK_ROOT": "/tmp/hoso-ai-test-work", "HOSO_AI_STORAGE_ROOT": "/tmp/hoso-ai-test-blobs"})
    clock = {"now": datetime(2026, 11, 17, 10, 0)}        # thứ ba 10:00: ngoài khung giờ
    worker, _ = build(settings, repo, now=lambda: clock["now"])
    repo.enqueue(job("nen", 7))
    assert not worker.run_once() and repo.status("nen") is JobStatus.QUEUED

    repo.enqueue(job("uu-tien", 1))
    assert worker.run_once() and repo.status("uu-tien") is JobStatus.COMPLETED
    assert repo.status("nen") is JobStatus.QUEUED, "việc ưu tiên vẫn chạy ngoài khung giờ, việc nền chờ"

    clock["now"] = datetime(2026, 11, 17, 18, 0)           # 18:00: trong khung giờ
    assert worker.run_once() and repo.status("nen") is JobStatus.COMPLETED


@pytest.mark.parametrize("text, when, expected", [
    ("", datetime(2026, 11, 17, 3, 0), True),                         # rỗng: luôn mở
    ("11:30-13:30,17:30-07:30,sat,sun", datetime(2026, 11, 17, 12, 0), True),     # thứ ba, nghỉ trưa
    ("11:30-13:30,17:30-07:30,sat,sun", datetime(2026, 11, 17, 15, 0), False),    # giờ làm việc
    ("11:30-13:30,17:30-07:30,sat,sun", datetime(2026, 11, 17, 23, 0), True),     # qua nửa đêm: phần tối
    ("11:30-13:30,17:30-07:30,sat,sun", datetime(2026, 11, 18, 6, 59), True),     # qua nửa đêm: phần sáng
    ("11:30-13:30,17:30-07:30,sat,sun", datetime(2026, 11, 18, 7, 30), False),    # hết khung đúng 07:30
    ("11:30-13:30,17:30-07:30,sat,sun", datetime(2026, 11, 21, 10, 0), True),     # thứ bảy cả ngày
    ("11:30-13:30,17:30-07:30,sat,sun", datetime(2026, 11, 13, 13, 30), False),   # hết khung trưa đúng 13:30
    ("SAT, Sun", datetime(2026, 11, 22, 9, 0), True),                             # không phân biệt hoa thường, bỏ khoảng trắng
])
def test_khung_gio_khay_nen(text, when, expected):
    assert BackgroundWindows.parse(text).is_open(when) is expected


@pytest.mark.parametrize("bad", ["25:00-07:00", "17:30-07:61", "chiều", "09:00-09:00", "9-17", "mon-fri"])
def test_khung_gio_sai_dung_ngay_voi_thong_bao_ro(bad):
    with pytest.raises(ValueError):
        BackgroundWindows.parse(bad)
    with pytest.raises(SettingsError, match="HOSO_AI_BACKGROUND_WINDOWS"):
        Settings.from_env({"HOSO_AI_PROFILE": "fake", "HOSO_AI_BACKGROUND_WINDOWS": bad})


def test_job_tung_nhuong_cho_van_ghi_mo_hinh_ocr_da_dung_o_lan_chay_truoc(settings, repo):
    class Versioned(FakeOcr):
        version = "ocr-giả@1"

    class VersionedClassifier(FakeClassifier):
        version = "llm-giả@2"

    class OcrThenPriorityArrives(Versioned):
        fired = False

        def read(self, image, timeout_seconds):
            result = super().read(image, timeout_seconds)
            if image.name == "page-3.png" and not self.fired:
                self.fired = True
                repo.enqueue(job("uu-tien", 1))
            return result

    engines = Engines(FakeReader(IMAGE_PAGES), OcrThenPriorityArrives(), VersionedClassifier(), PillowQualityChecker())
    worker = Worker(settings, repo, engines, FakeStorage(Path("/tmp/fake.pdf")), ModelScheduler(6), now=lambda: datetime(2026, 11, 17, 12, 0))
    repo.enqueue(job("nen", 7))
    for _ in range(3):
        assert worker.run_once()
    assert repo.status("nen") is JobStatus.COMPLETED
    assert repo.rows["nen"].model_version.startswith("ocr=ocr-giả@1 classifier=llm-giả@2"), repo.rows["nen"].model_version


def test_nang_muc_khi_job_dang_chay_thi_phan_phan_loai_con_lai_dung_loi_nhac_nhanh():
    """Bấm "Trích xuất ngay" khi job đã được lấy ở khay nền: mức hiện tại quyết định kiểu lời nhắc, không phải mức lúc lấy việc."""
    from hoso_ai.queue.memory import InMemoryRepository
    from hoso_ai.queue.repository import Catalog

    repository = InMemoryRepository(Catalog({"U02": "Nhóm"}, {}))
    styles = []

    class Recording(FakeClassifier):
        def suggest(self, pages, catalog, prompt_style="production"):
            styles.append(prompt_style)
            return super().suggest(pages, catalog, prompt_style)

    class RaisedWhileReading(FakeOcr):
        def read(self, image, timeout_seconds):
            repository.set_priority("nen", 1)
            return super().read(image, timeout_seconds)

    settings = Settings.from_env({"HOSO_AI_PROFILE": "fake", "HOSO_AI_PROMPT_INTERACTIVE": "short", "HOSO_AI_PROMPT_BACKGROUND": "production",
                                  "HOSO_AI_WORK_ROOT": "/tmp/hoso-ai-test-work", "HOSO_AI_STORAGE_ROOT": "/tmp/hoso-ai-test-blobs"})
    worker = Worker(settings, repository, Engines(FakeReader([PageInfo(1, "", has_images=True)]), RaisedWhileReading(), Recording(), PillowQualityChecker()),
                    FakeStorage(Path("/tmp/fake.pdf")), ModelScheduler(6))
    repository.enqueue(job("nen", 7))
    assert worker.run_once()
    assert styles == ["short"]
