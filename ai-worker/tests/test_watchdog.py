"""AI-08: hạn thời gian được cưỡng chế thật. Tiến trình kẹt (OCR, PDFium) phải thoát để job được thu hồi, không được treo vô hạn với heartbeat vẫn báo sống."""
from __future__ import annotations

import subprocess
import sys
import textwrap
import threading
import time
from pathlib import Path

from hoso_ai.runtime.watchdog import EXIT_STUCK, Watchdog

SRC = str(Path(__file__).resolve().parents[1] / "src")


def test_thao_tac_xong_dung_han_khong_bao_ket():
    fired = []
    watchdog = Watchdog(on_stuck=lambda what, seconds: fired.append(what))
    with watchdog.guard(0.5, "ocr"):
        time.sleep(0.05)
    time.sleep(0.7)
    assert fired == [], "xong trước hạn thì đồng hồ đã bị hủy, không kêu muộn"


def test_thao_tac_qua_han_bi_bao_ket_dung_ten_thao_tac():
    fired = threading.Event()
    seen: list[tuple[str, float]] = []

    def on_stuck(what: str, seconds: float) -> None:
        seen.append((what, seconds))
        fired.set()

    watchdog = Watchdog(on_stuck=on_stuck)
    with watchdog.guard(0.2, "ocr"):
        assert fired.wait(3), "quá hạn phải được phát hiện dù thao tác vẫn đang chạy"
    assert seen == [("ocr", 0.2)]


def test_ngoai_le_trong_khoi_van_huy_dong_ho():
    fired = []
    watchdog = Watchdog(on_stuck=lambda what, seconds: fired.append(what))
    try:
        with watchdog.guard(0.3, "render"):
            raise RuntimeError("lỗi bình thường")
    except RuntimeError:
        pass
    time.sleep(0.5)
    assert fired == []


def test_tien_trinh_ket_that_su_bi_thoat_ma_75_dung_han():
    """Mô phỏng OCR treo: một tiến trình thật ngủ 60 giây trong khối guard 1 giây phải tự thoát mã 75, không phải chờ hết 60 giây."""
    script = textwrap.dedent(f"""
        import sys, time
        sys.path.insert(0, {SRC!r})
        from hoso_ai import logging as log
        from hoso_ai.runtime.watchdog import Watchdog
        log.setup()
        with Watchdog().guard(1, "ocr"):
            time.sleep(60)
        print("không bao giờ tới đây")
    """)
    started = time.monotonic()
    result = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True, timeout=30)
    assert result.returncode == EXIT_STUCK == 75
    assert time.monotonic() - started < 15
    assert "không bao giờ tới đây" not in result.stdout
    assert '"event": "operation_stuck"' in result.stdout and '"what": "ocr"' in result.stdout, "có dòng log JSON báo thao tác kẹt"


# ---- Lớp ngoài cùng: vòng lặp rảnh và tắt máy ----------------------------------------------------------------------------------------

def _worker(settings, repo, **kw):
    from pathlib import Path

    from conftest import FakeReader, FakeStorage
    from hoso_ai.engines.base import Engines
    from hoso_ai.engines.fake import FakeClassifier, FakeOcr
    from hoso_ai.engines.quality import PillowQualityChecker
    from hoso_ai.runtime.scheduler import ModelScheduler
    from hoso_ai.worker import Worker

    return Worker(settings, repo, Engines(FakeReader(), FakeOcr(), FakeClassifier(), PillowQualityChecker()), FakeStorage(Path("/tmp/fake.pdf")), ModelScheduler(6), **kw)


def test_vong_lap_ranh_khong_quay_qua_lau_thi_bi_coi_la_ket(settings, repo):
    worker = _worker(settings, repo)
    base = worker.state.last_loop_at
    assert worker.stuck_reason(base + 30) is None, "đang chờ việc bình thường"
    assert "vòng lặp rảnh" in worker.stuck_reason(base + worker.idle_stuck_seconds + 1)
    worker.state.current_job = "job-1"
    assert worker.stuck_reason(base + 10_000) is None, "đang xử lý job thì đã có watchdog theo từng thao tác"


def test_tat_may_qua_han_thi_bi_coi_la_ket(settings, repo):
    worker = _worker(settings, repo)
    worker.stop.set()
    assert worker.stuck_reason(1000.0) is None, "mới nhận lệnh dừng"
    assert worker.stuck_reason(1000.0 + worker.shutdown_grace_seconds - 1) is None
    assert "tắt máy" in worker.stuck_reason(1000.0 + worker.shutdown_grace_seconds + 1)


def test_watchdog_vong_lap_thoat_tien_trinh_voi_ma_75(settings, repo, monkeypatch):
    import hoso_ai.worker as worker_module

    codes = []
    worker = _worker(settings, repo, exit_fn=codes.append)
    worker.state.last_loop_at -= 10_000
    monkeypatch.setattr(worker_module.time, "sleep", lambda seconds: None)
    worker._loop_watchdog(0)
    assert codes == [75]


def test_xu_ly_xong_job_dai_khong_bi_watchdog_hieu_nham_la_ket(settings, repo):
    worker = _worker(settings, repo)
    repo.enqueue(__import__("conftest").make_job())
    worker.state.last_loop_at -= 5_000        # job chạy rất lâu: vòng lặp chưa quay từ lúc bắt đầu
    assert worker.run_once()
    assert worker.stuck_reason(__import__("time").time()) is None
