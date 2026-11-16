"""AI-08: cưỡng chế hạn thời gian cho phần mã không ngắt được từ bên ngoài.

OCR chạy trên mô hình đã nạp trong tiến trình và PDFium là mã gốc; cả hai không có điểm dừng an toàn. Một PDF độc hại hay hỏng có thể làm chúng treo vô hạn
trong khi luồng heartbeat vẫn báo "còn sống", nên job không bao giờ được thu hồi. Watchdog đặt đồng hồ quanh từng thao tác: quá hạn thì ghi log rồi THOÁT HẲN
tiến trình (mã 75). launchd/systemd chạy lại worker; job dở dang mất heartbeat nên API (requeue_stale_jobs) trả về hàng đợi sau 5 phút, tối đa 3 lần rồi
đánh dấu lỗi. Trang đã đọc xong được giữ nguyên nên lần sau chỉ đọc phần còn thiếu.
"""
from __future__ import annotations

import os
import sys
import threading
from contextlib import contextmanager
from typing import Callable, Iterator

from .. import logging as log

EXIT_STUCK = 75  # EX_TEMPFAIL: lỗi tạm thời, chạy lại có thể được


def _die(what: str, seconds: float) -> None:
    sys.stdout.flush()
    sys.stderr.flush()
    os._exit(EXIT_STUCK)  # không chạy trình dọn dẹp: tiến trình đang kẹt trong mã gốc, các khóa sẽ được CSDL nhả khi kết nối đóng


class Watchdog:
    def __init__(self, on_stuck: Callable[[str, float], None] = _die) -> None:
        self._on_stuck = on_stuck

    @contextmanager
    def guard(self, seconds: float, what: str) -> Iterator[None]:
        """Trong khối `with`, nếu quá `seconds` giây thì coi là kẹt và gọi `on_stuck` (mặc định thoát tiến trình)."""
        timer = threading.Timer(seconds, self._fire, args=(what, seconds))
        timer.daemon = True
        timer.start()
        try:
            yield
        finally:
            timer.cancel()

    def _fire(self, what: str, seconds: float) -> None:
        log.error("operation_stuck", what=what, seconds=seconds)
        self._on_stuck(what, seconds)
