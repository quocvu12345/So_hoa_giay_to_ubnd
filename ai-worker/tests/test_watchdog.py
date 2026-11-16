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
