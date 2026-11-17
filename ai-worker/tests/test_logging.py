import json
import logging

from hoso_ai import logging as log


def test_bo_dem_so_khong_bi_an_nhung_noi_dung_giay_to_van_bi_an(capsys):
    line = json.loads(log.JsonFormatter().format(logging.LogRecord("hoso_ai", logging.INFO, __file__, 1, "job_completed", None, None, None)))
    assert line  # định dạng chạy được
    clean = log._sanitize({"pages_text": 3, "ocr_seconds": 1.5, "text": "Nguyễn Văn A, số 012345678901", "value": "x", "token": "abc", "quote": ["a"], "nested": {"password": "p", "count_text": 2}})
    assert clean["pages_text"] == 3 and clean["ocr_seconds"] == 1.5 and clean["nested"]["count_text"] == 2
    assert clean["text"] == "[đã ẩn]" and clean["value"] == "[đã ẩn]" and clean["token"] == "[đã ẩn]" and clean["quote"] == "[đã ẩn]" and clean["nested"]["password"] == "[đã ẩn]"
