from __future__ import annotations

from pathlib import Path

from conftest import FakeReader, FakeStorage, make_job
from hoso_ai.contracts import Job, JobStatus, JobType, PageResult
from hoso_ai.engines.base import Engines
from hoso_ai.engines.fake import FakeClassifier, FakeOcr
from hoso_ai.engines.quality import PillowQualityChecker
from hoso_ai.runtime.scheduler import ModelScheduler
from hoso_ai.worker import Worker


def build(settings, repo, ocr=None, reader=None, storage_error=None):
    engines = Engines(reader or FakeReader(), ocr or FakeOcr(), FakeClassifier(), PillowQualityChecker())
    worker = Worker(settings, repo, engines, FakeStorage(Path("/tmp/fake.pdf"), storage_error), ModelScheduler(6))
    return worker, engines


def test_trang_co_lop_chu_sach_khong_phai_ocr(settings, repo):
    worker, engines = build(settings, repo)
    repo.enqueue(make_job())
    assert worker.run_once()

    pages = repo.pages["job-1"]
    assert pages[1].method == "pdf_text"
    assert pages[2].method == "ocr" and pages[3].method == "ocr"
    assert engines.ocr.calls == ["page-2.png", "page-3.png"]
    assert repo.status("job-1") is JobStatus.COMPLETED
    assert repo.rows["job-1"].all_pages_read
    assert repo.suggestions["job-1"].document_type_code == "U02-D01"


def test_chay_lai_chi_doc_trang_con_thieu(settings, repo):
    worker, engines = build(settings, repo)
    repo.enqueue(make_job())
    repo.pages["job-1"] = {2: PageResult(2, "ocr", "đã đọc lần trước")}
    worker.run_once()
    assert engines.ocr.calls == ["page-3.png"]
    assert repo.pages["job-1"][2].text == "đã đọc lần trước"


def test_huy_job_dung_sau_trang_dang_doc(settings, repo):
    class CancellingOcr(FakeOcr):
        def read(self, image, timeout_seconds):
            repo.cancel("job-1")  # người dùng bấm Hủy trong lúc đọc trang 2
            return super().read(image, timeout_seconds)

    worker, engines = build(settings, repo, ocr=CancellingOcr())
    repo.enqueue(make_job())
    worker.run_once()
    assert engines.ocr.calls == ["page-2.png"]
    assert repo.status("job-1") is JobStatus.CANCELLED
    assert "job-1" not in repo.suggestions
    assert worker.state.jobs["cancelled"] == 1


def test_mot_trang_loi_khong_lam_hong_ca_job(settings, repo):
    worker, _ = build(settings, repo, ocr=FakeOcr(fail_pages={2}))
    repo.enqueue(make_job())
    worker.run_once()
    row = repo.rows["job-1"]
    assert row.status is JobStatus.COMPLETED
    assert not row.all_pages_read
    assert any("Trang 2" in w for w in row.warnings)
    assert repo.pages["job-1"][2].status == "failed"


def test_doc_lai_mot_trang_ghi_vao_job_goc(settings, repo):
    repo.pages["job-goc"] = {1: PageResult(1, "pdf_text", "a"), 2: PageResult(2, "failed", "", status="failed")}
    worker, engines = build(settings, repo)
    repo.enqueue(Job(id="job-doc-lai", file_id="file-1", document_id="doc-1", storage_key="", sha256="", page_count=3,
                     job_type=JobType.REREAD_PAGE, options={"pages": [2], "target_job_id": "job-goc", "classify": False}))
    worker.run_once()
    assert engines.ocr.calls == ["page-2.png"]
    assert repo.pages["job-goc"][2].status == "completed"


def test_loi_tep_khong_thu_lai_loi_may_thi_thu_lai(settings, repo):
    from hoso_ai.storage import StorageError

    worker, _ = build(settings, repo, storage_error=StorageError("Mã băm tệp không khớp"))
    repo.enqueue(make_job("hong"))
    worker.run_once()
    assert repo.status("hong") is JobStatus.FAILED
    assert "Mã băm" in repo.rows["hong"].error

    class BrokenOcr(FakeOcr):
        def load(self):
            raise RuntimeError("MLX chưa sẵn sàng")

    worker, _ = build(settings, repo, ocr=BrokenOcr())
    repo.enqueue(make_job("may-loi"))
    for attempt in (1, 2, 3):
        worker.run_once()
        assert repo.rows["may-loi"].job.attempt == attempt
    assert repo.status("may-loi") is JobStatus.FAILED
    assert worker.state.jobs["retried"] == 2
    assert "lỗi hệ thống" in repo.rows["may-loi"].error


def test_tat_worker_tra_job_ve_hang_doi(settings, repo):
    worker, _ = build(settings, repo)
    repo.enqueue(make_job())
    worker.stop.set()
    worker.run_once()
    assert repo.status("job-1") is JobStatus.QUEUED
    assert worker.state.jobs["released"] == 1


def test_anh_tam_bi_xoa_va_co_co_chat_luong(settings, repo):
    worker, _ = build(settings, repo)
    repo.enqueue(make_job())
    worker.run_once()
    assert not (settings.work_root / "job-1").exists()
    assert ("file-1", 2) in repo.quality


def test_pipeline_dat_dong_ho_quanh_ocr_dung_anh_doc_trang_va_phan_loai(settings, repo):
    """AI-08: mọi thao tác không ngắt được đều chạy trong khối guard của watchdog (test ghi lại tên và hạn của các thao tác được bảo vệ)."""
    from contextlib import contextmanager

    guarded: list[tuple[str, float]] = []

    class Recording:
        @contextmanager
        def guard(self, seconds, what):
            guarded.append((what, seconds))
            yield

    worker, _ = build(settings, repo)
    worker.pipeline.watchdog = Recording()
    repo.enqueue(make_job())
    assert worker.run_once()

    names = {name for name, _ in guarded}
    assert {"inspect", "render", "ocr", "classify"} <= names
    assert {seconds for name, seconds in guarded if name in ("render", "ocr")} == {settings.page_timeout_seconds}
    assert {seconds for name, seconds in guarded if name == "classify"} == {settings.page_timeout_seconds * 2}
