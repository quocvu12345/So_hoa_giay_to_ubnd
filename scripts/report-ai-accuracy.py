#!/usr/bin/env python3
"""AI-10. Báo cáo độ đúng của AI từ việc CÁN BỘ ĐÃ ĐỐI CHIẾU, đọc view `hoso.v_ai_accuracy` (migration 042).

    python3 scripts/report-ai-accuracy.py                    # mọi mô hình trừ `fake`, từ 5 mẫu mỗi trường
    python3 scripts/report-ai-accuracy.py --model classifier --min 10 --out data/reports/ai-accuracy.md
    python3 scripts/report-ai-accuracy.py --db hoso_dev --include-fake

Mỗi giá trị cán bộ đã xác nhận được so với giá trị AI gợi ý: accepted (giữ nguyên), edited (sửa), cleared (xóa trống: AI đọc cái không có),
missed (AI bỏ sót, người điền). Tỉ lệ chấp nhận = accepted / (AI có giá trị hoặc người điền).

ĐỌC KỸ trước khi dùng con số:
- Chỉ tính gợi ý ĐÃ ĐƯỢC chấp nhận sao sang bảng chính và có người xác nhận. Gợi ý bị bỏ qua không tính.
- Dữ liệu do E2E hay smoke tự bấm "đã kiểm" mà không sửa gì sẽ cho 100% chấp nhận: đó KHÔNG phải độ đúng. Số có ý nghĩa chỉ khi cán bộ thật đã đối chiếu.
- Trường có ít mẫu (dưới --min) bị gom riêng, không xếp hạng.
Chỉ dùng thư viện chuẩn và `psql`.
"""
from __future__ import annotations

import argparse
import csv
import io
import os
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

QUERY = """
SELECT model_key, work_group_code, document_type_code, field_definition_code, field_label, suggested, accepted, edited, cleared, missed
FROM hoso.v_ai_accuracy ORDER BY model_key, document_type_code, field_definition_code
"""


def fetch(db: str, host: str, user: str) -> list[dict]:
    result = subprocess.run(["psql", "-h", host, "-U", user, "-d", db, "-v", "ON_ERROR_STOP=1", "--csv", "-c", QUERY], capture_output=True, text=True)
    if result.returncode != 0:
        sys.exit(f"Không đọc được v_ai_accuracy ({result.stderr.strip()[:300]}). Đã áp migration 042 vào {db} chưa?")
    rows = []
    for row in csv.DictReader(io.StringIO(result.stdout)):
        for key in ("suggested", "accepted", "edited", "cleared", "missed"):
            row[key] = int(row[key])
        rows.append(row)
    return rows


def rate(accepted: int, suggested: int, missed: int) -> float | None:
    """Cùng công thức với cột accepted_rate của view, nhưng tính được cho nhóm nhiều trường."""
    base = suggested + missed
    return accepted / base if base else None


def pct(value: float | None) -> str:
    return "—" if value is None else f"{value * 100:.1f}%"


def table(headers: list[str], rows: list[list[str]]) -> str:
    return "\n".join(["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|", *("| " + " | ".join(r) + " |" for r in rows)])


def totals(rows: list[dict]) -> dict:
    return {k: sum(r[k] for r in rows) for k in ("suggested", "accepted", "edited", "cleared", "missed")}


def report(rows: list[dict], minimum: int) -> str:
    out = ["# Độ đúng của AI theo đối chiếu của cán bộ", ""]
    if not rows:
        return "\n".join(out + ["Chưa có trường nào được cán bộ đối chiếu từ gợi ý AI (hoặc đã lọc hết).", ""])

    by_model: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_model[r["model_key"]].append(r)
    out += ["## Theo mô hình", "", table(["Mô hình", "Trường đã đối chiếu", "Giữ nguyên", "Sửa", "Xóa trống", "Bỏ sót", "Chấp nhận"],
            [[m, str(t["suggested"] + t["missed"]), str(t["accepted"]), str(t["edited"]), str(t["cleared"]), str(t["missed"]), pct(rate(t["accepted"], t["suggested"], t["missed"]))]
             for m, rs in sorted(by_model.items()) for t in [totals(rs)]]), ""]

    by_type: dict[tuple, list[dict]] = defaultdict(list)
    for r in rows:
        by_type[(r["model_key"], r["document_type_code"])].append(r)
    out += ["## Theo loại giấy tờ (thấp nhất trước)", ""]
    ranked = sorted(((k, totals(v)) for k, v in by_type.items()), key=lambda kv: (rate(kv[1]["accepted"], kv[1]["suggested"], kv[1]["missed"]) or 0, kv[0]))
    out += [table(["Mô hình", "Loại giấy tờ", "Trường", "Chấp nhận", "Sửa", "Xóa trống", "Bỏ sót"],
            [[k[0], k[1], str(t["suggested"] + t["missed"]), pct(rate(t["accepted"], t["suggested"], t["missed"])), str(t["edited"]), str(t["cleared"]), str(t["missed"])] for k, t in ranked]), ""]

    enough = [r for r in rows if r["suggested"] + r["missed"] >= minimum]
    few = len(rows) - len(enough)
    out += [f"## Trường khó nhất (từ {minimum} mẫu trở lên, thấp nhất trước)", ""]
    if enough:
        worst = sorted(enough, key=lambda r: (rate(r["accepted"], r["suggested"], r["missed"]) or 0, r["field_definition_code"]))[:15]
        out += [table(["Mô hình", "Loại", "Trường", "Mẫu", "Chấp nhận", "Sửa", "Xóa trống", "Bỏ sót"],
                [[r["model_key"], r["document_type_code"], r["field_label"], str(r["suggested"] + r["missed"]), pct(rate(r["accepted"], r["suggested"], r["missed"])), str(r["edited"]), str(r["cleared"]), str(r["missed"])] for r in worst]), ""]
    else:
        out += [f"Chưa có trường nào đủ {minimum} mẫu.", ""]
    if few:
        out += [f"{few} trường có dưới {minimum} mẫu nên không xếp hạng.", ""]
    out += ["> Lưu ý: số liệu chỉ có ý nghĩa khi do cán bộ thật đối chiếu. Dữ liệu E2E/smoke tự bấm \"đã kiểm\" cho 100% chấp nhận.", ""]
    return "\n".join(out)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--db", default=os.environ.get("HOSO_DEV_DB", "hoso_dev"))
    parser.add_argument("--host", default=os.environ.get("HOSO_DEV_PG_HOST", "127.0.0.1"))
    parser.add_argument("--user", default=os.environ.get("HOSO_DEV_PG_ADMIN", "quoc"))
    parser.add_argument("--model", help="chỉ một mô hình (ví dụ classifier)")
    parser.add_argument("--min", type=int, default=5, dest="minimum", help="số mẫu tối thiểu để một trường được xếp hạng")
    parser.add_argument("--include-fake", action="store_true", help="tính cả AI giả (mặc định bỏ: không nói gì về chất lượng)")
    parser.add_argument("--out", type=Path, help="ghi ra tệp Markdown thay vì in ra màn hình")
    args = parser.parse_args()
    rows = fetch(args.db, args.host, args.user)
    if args.model:
        rows = [r for r in rows if r["model_key"] == args.model]
    elif not args.include_fake:
        rows = [r for r in rows if r["model_key"] != "fake"]
    text = report(rows, args.minimum)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(text + "\n", encoding="utf-8")
        print(f"Đã ghi {args.out}")
    else:
        print(text)


if __name__ == "__main__":
    main()
