"""Khung giờ cho khay nền (HOSO_AI_BACKGROUND_WINDOWS), ví dụ "11:30-13:30,17:30-07:30,sat,sun" theo giờ máy.

Khay nền chạy khi không còn việc ưu tiên. Nếu máy AI còn dùng cho việc khác, giới hạn thêm khung giờ ở đây.
Để trống: chạy bất cứ lúc nào rảnh. Việc có người đang chờ (mức ưu tiên thấp hơn khay nền) KHÔNG bị khung giờ chặn.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime

DAYS = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}
_RANGE = re.compile(r"^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$")


@dataclass(frozen=True)
class BackgroundWindows:
    ranges: tuple[tuple[int, int], ...] = ()    # phút trong ngày; kết thúc nhỏ hơn bắt đầu nghĩa là qua nửa đêm
    days: frozenset[int] = frozenset()          # thứ trong tuần (0 = thứ hai) mở cả ngày

    @classmethod
    def parse(cls, text: str | None) -> "BackgroundWindows":
        ranges: list[tuple[int, int]] = []
        days: set[int] = set()
        for part in (p.strip().lower() for p in (text or "").split(",") if p.strip()):
            if part in DAYS:
                days.add(DAYS[part])
                continue
            match = _RANGE.match(part)
            if not match:
                raise ValueError(f"Khung giờ khay nền không hiểu được: {part!r}. Dùng HH:MM-HH:MM hoặc mon…sun, ví dụ 17:30-07:30,sat,sun.")
            h1, m1, h2, m2 = (int(x) for x in match.groups())
            if h1 > 23 or h2 > 23 or m1 > 59 or m2 > 59:
                raise ValueError(f"Giờ không hợp lệ trong khung giờ khay nền: {part!r}.")
            start, end = h1 * 60 + m1, h2 * 60 + m2
            if start == end:
                raise ValueError(f"Khung giờ {part!r} rỗng; muốn mở cả ngày thì ghi tên thứ (mon…sun).")
            ranges.append((start, end))
        return cls(tuple(ranges), frozenset(days))

    @property
    def always_open(self) -> bool:
        return not self.ranges and not self.days

    def is_open(self, now: datetime) -> bool:
        if self.always_open or now.weekday() in self.days:
            return True
        minute = now.hour * 60 + now.minute
        return any((start <= minute < end) if start < end else (minute >= start or minute < end) for start, end in self.ranges)
