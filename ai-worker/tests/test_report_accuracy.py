"""AI-10: báo cáo độ đúng từ v_ai_accuracy (scripts/report-ai-accuracy.py), phần tính toán và trình bày; không cần CSDL."""
from __future__ import annotations

import importlib.util
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "scripts/report-ai-accuracy.py"
spec = importlib.util.spec_from_file_location("report_ai_accuracy", SCRIPT)
report_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(report_module)


def row(model, type_code, field, suggested, accepted, edited=0, cleared=0, missed=0):
    return {"model_key": model, "work_group_code": "U15", "document_type_code": type_code, "field_definition_code": f"{type_code}-{field}",
            "field_label": f"Trường {field}", "suggested": suggested, "accepted": accepted, "edited": edited, "cleared": cleared, "missed": missed}


def test_ty_le_chap_nhan_tinh_ca_truong_ai_bo_sot_va_khong_chia_cho_khong():
    assert report_module.rate(8, 10, 0) == 0.8
    assert report_module.rate(8, 8, 2) == 0.8                 # 2 trường AI bỏ sót kéo tỉ lệ xuống
    assert report_module.rate(0, 0, 0) is None
    assert report_module.pct(None) == "—" and report_module.pct(0.5) == "50.0%"


def test_bao_cao_xep_loai_va_truong_kem_nhat_len_truoc_va_bo_qua_truong_it_mau():
    rows = [
        row("classifier", "U15-D07", "F01", 20, 19, edited=1),
        row("classifier", "U15-D07", "F02", 20, 8, edited=10, cleared=2),          # trường khó: 40%
        row("classifier", "U02-D01", "F01", 12, 12),
        row("classifier", "U02-D01", "F09", 2, 0, edited=2),                       # ít mẫu: không xếp hạng
    ]
    text = report_module.report(rows, 10)
    assert "| classifier | 54 | 39 | 13 | 2 | 0 | 72.2% |" in text            # tổng theo mô hình
    types = text.split("## Theo loại giấy tờ")[1].split("## Trường khó nhất")[0]
    assert types.index("U15-D07") < types.index("U02-D01")                     # loại kém hơn đứng trước
    worst = text.split("## Trường khó nhất")[1]
    assert worst.index("Trường F02") < worst.index("Trường F01")
    assert "Trường F09" not in worst and "1 trường có dưới 10 mẫu nên không xếp hạng" in worst
    assert "E2E/smoke" in text                                                  # cảnh báo dữ liệu tự động luôn có


def test_khong_co_du_lieu_thi_noi_ro_khong_ra_bang_rong():
    assert "Chưa có trường nào được cán bộ đối chiếu" in report_module.report([], 5)
    assert "Chưa có trường nào đủ 50 mẫu" in report_module.report([row("classifier", "U15-D07", "F01", 3, 3)], 50)
