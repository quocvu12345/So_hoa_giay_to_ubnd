"""AI-24: worker biết máy chạy mô hình (Ollama ở máy Windows qua Tailscale) có trả lời không, ghi vào ai_workers để API báo
giao diện, và không nhận việc khi máy đó đang hỏng (việc nằm yên trong hàng thay vì nhận rồi trả lại mỗi 30 giây)."""
from __future__ import annotations

from pathlib import Path

from conftest import FakeReader, FakeStorage, make_job
from hoso_ai.contracts import JobStatus
from hoso_ai.engines.base import Engines, EngineUnavailable
from hoso_ai.engines.fake import FakeClassifier, FakeOcr
from hoso_ai.engines.quality import PillowQualityChecker
from hoso_ai.runtime.scheduler import ModelScheduler
from hoso_ai.status_http import health
from hoso_ai.worker import Worker

ENGINE = "Ollama http://may-ai:11434"


class Remote:
    """Máy Ollama giả, bật tắt được; đếm số lần bị thăm dò."""

    def __init__(self, up: bool = True):
        self.up, self.calls = up, 0

    def probe(self) -> None:
        self.calls += 1
        if not self.up:
            raise EngineUnavailable("Không gọi được Ollama ở http://may-ai:11434: timed out")


class FlakyOcr(FakeOcr):
    """Mất kết nối giữa lúc đọc trang, tới khi được bảo là đã nối lại."""

    def __init__(self):
        super().__init__()
        self.offline = True

    def read(self, image: Path, timeout_seconds: int):
        if self.offline:
            raise EngineUnavailable("Mất kết nối tới Ollama ở http://may-ai:11434: [Errno 54] Connection reset by peer")
        return super().read(image, timeout_seconds)


def _worker(settings, repo, remote: Remote | None = None, ocr=None) -> Worker:
    engines = Engines(FakeReader(), ocr or FakeOcr(), FakeClassifier(), PillowQualityChecker(),
                      engine=None if remote is None else ENGINE, probe=None if remote is None else remote.probe)
    return Worker(settings, repo, engines, FakeStorage(Path("/tmp/fake.pdf")), ModelScheduler(6))


def test_may_ai_tat_thi_viec_nam_yen_trong_hang_va_ghi_trang_thai(settings, repo):
    remote = Remote(up=False)
    worker = _worker(settings, repo, remote)
    repo.enqueue(make_job())

    worker._probe_engine(force=True)
    assert worker.run_once() is False, "không nhận việc khi máy AI không trả lời"
    row = repo.rows["job-1"]
    assert row.status is JobStatus.QUEUED and row.job.attempt == 0 and row.preempted == 0, "việc không bị nhận rồi trả lại"

    report = repo.workers["test-worker"]
    assert (report.engine, report.engine_ok) == (ENGINE, False)
    assert report.engine_down_since is not None and "timed out" in report.engine_error
    assert [r.engine_ok for r in repo.worker_changes] == [False], "báo đổi trạng thái đúng một lần"

    status, body = health(worker.state, worker.scheduler, settings)
    assert (status, body["status"], body["engine"]["ok"]) == (200, "ok", False), "worker vẫn sống, chỉ máy AI hỏng"
    assert "timed out" in body["engine"]["error"]


def test_may_ai_tro_lai_thi_nhan_viec_ngay_khong_doi_het_khoang_cho(settings, repo):
    remote = Remote(up=False)
    worker = _worker(settings, repo, remote)
    repo.enqueue(make_job())
    worker._probe_engine(force=True)

    worker.idle_tick()
    assert remote.calls == 1, "chưa tới hạn thì không hỏi máy kia liên tục"
    remote.up = True
    worker._last_probe -= worker.probe_down_seconds        # máy đang hỏng: thăm dò lại sau 10 giây
    worker.idle_tick()

    assert worker.state.engine_ok and repo.workers["test-worker"].engine_ok
    assert repo.workers["test-worker"].engine_down_since is None
    assert [r.engine_ok for r in repo.worker_changes] == [False, True]
    assert worker.run_once() and repo.status("job-1") is JobStatus.COMPLETED


def test_may_ai_dang_tra_loi_thi_tham_do_thua(settings, repo):
    remote = Remote()
    worker = _worker(settings, repo, remote)
    worker._probe_engine(force=True)
    worker.idle_tick()
    assert remote.calls == 1
    worker._last_probe -= worker.probe_ok_seconds
    worker.idle_tick()
    assert remote.calls == 2 and repo.worker_changes == [], "máy vẫn trả lời: không báo đổi trạng thái"


def test_mat_ket_noi_giua_luc_doc_thi_bao_hong_va_doc_xong_thi_bao_tot(settings, repo):
    # Mô hình nằm trong worker hoặc chưa có hàm thăm dò: chỉ biết qua job. Việc được trả về hàng, không tính lần thử.
    ocr = FlakyOcr()
    worker = _worker(settings, repo, ocr=ocr)
    repo.enqueue(make_job())

    assert worker.run_once()
    assert repo.status("job-1") is JobStatus.QUEUED and repo.rows["job-1"].preempted == 1
    assert not worker.state.engine_ok and "Connection reset" in repo.workers["test-worker"].engine_error

    ocr.offline = False
    worker._engine_retry_at = 0.0          # hết khoảng chờ
    assert worker.run_once() and repo.status("job-1") is JobStatus.COMPLETED
    assert worker.state.engine_ok and [r.engine_ok for r in repo.worker_changes] == [False, True]


def test_tat_em_thi_xoa_dong_cua_minh(settings, repo):
    worker = _worker(settings, repo, Remote())
    worker.stop.set()
    worker.run_forever()
    assert [r.engine_ok for r in repo.worker_changes] == [True], "khởi động có ghi mặt"
    assert "test-worker" not in repo.workers


def test_ham_tham_do_loi_la_khong_lam_chet_worker(settings, repo):
    def broken() -> None:
        raise RuntimeError("Ollama trả lỗi 500: model runner crashed")

    worker = Worker(settings, repo, Engines(FakeReader(), FakeOcr(), FakeClassifier(), PillowQualityChecker(), engine=ENGINE, probe=broken),
                    FakeStorage(Path("/tmp/fake.pdf")), ModelScheduler(6))
    worker._probe_engine(force=True)
    assert not worker.state.engine_ok and worker.state.engine_error == "RuntimeError: Ollama trả lỗi 500: model runner crashed"


def test_khoi_dong_lai_thi_don_dong_cua_worker_da_chet_cung_may(tmp_path, repo):
    # Worker bị kill -9 không kịp xóa dòng; supervise.sh chạy lại với pid mới. Dòng cũ cùng máy mà pid không còn thì bị dọn,
    # còn worker cùng máy đang sống (pid còn) và worker máy khác thì giữ nguyên.
    import os
    import socket

    from hoso_ai.queue.repository import WorkerReport
    from hoso_ai.settings import Settings

    host = socket.gethostname()
    me = f"{host}-{os.getpid()}"
    settings = Settings.from_env({"HOSO_AI_PROFILE": "fake", "HOSO_AI_WORK_ROOT": str(tmp_path), "HOSO_AI_STORAGE_ROOT": str(tmp_path),
                                  "HOSO_AI_WORKER_ID": me})
    for worker_id in (f"{host}-4000000", f"{host}-{os.getppid()}", "may-khac-123"):
        repo.report_worker(WorkerReport(worker_id, "ollama", None, True, None, None, None))
    worker = _worker(settings, repo)
    worker.stop.set()
    worker._prune_dead_siblings()
    assert set(repo.workers) == {f"{host}-{os.getppid()}", "may-khac-123"}
