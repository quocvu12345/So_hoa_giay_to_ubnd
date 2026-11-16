"""Chạy lệnh `once` trên PDF công khai có thật của dự án, với mô hình giả (không cần MLX)."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from hoso_ai.__main__ import main

SAMPLE = Path(__file__).resolve().parents[2] / "database/samples/public-019.pdf"


@pytest.mark.skipif(not SAMPLE.is_file(), reason="Không có PDF mẫu")
def test_once_doc_pdf_that_voi_mo_hinh_gia(tmp_path, monkeypatch, capsys):
    pytest.importorskip("pypdfium2")
    monkeypatch.setenv("HOSO_AI_PROFILE", "fake")
    monkeypatch.setenv("HOSO_AI_WORK_ROOT", str(tmp_path))
    assert main(["once", "--pdf", str(SAMPLE)]) == 0
    output = capsys.readouterr().out
    result = json.loads(output[output.index("{\n"):])
    assert result["outcome"]["status"] == "completed"
    assert result["outcome"]["page_count"] == len(result["pages"]) > 0
    assert {p["method"] for p in result["pages"]} <= {"pdf_text", "ocr"}
