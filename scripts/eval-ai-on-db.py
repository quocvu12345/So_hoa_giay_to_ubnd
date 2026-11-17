#!/usr/bin/env python3
"""Đánh giá AI trên dữ liệu ĐÃ NẠP vào hoso_dev: 850 bộ hồ sơ giả (`backend/scripts/import_synthetic_dossiers.py`), 3.560 giấy tờ thành phần
(3.156 giấy tờ tự dựng "mock" + 404 biểu mẫu nguồn đã điền "pkt") và 850 PDF gộp. Đáp án (giá trị từng trường) nằm ở
`data/tuliem-dossiers-full/ground-truth/<document_id>.json`, KHÔNG nạp vào mô hình.

Làm gì: chọn mẫu (mỗi loại giấy tờ thành phần một bản, ngẫu nhiên theo --seed), tạo việc đọc `read_classify` ở khay nền như một lần tải lên,
chờ worker xử lý, rồi chấm.

  /Volumes/quocDisk/AI/paddleocr/venv/bin/python scripts/eval-ai-on-db.py --mock 30 --pkt 20 --packets 3
  ... --dry-run          chỉ liệt kê mẫu, không tạo việc
  ... --report <tệp>     chấm lại kết quả đã lưu

GHI VÀO hoso_dev (bảng ocr_jobs, ocr_pages, ai_suggestions): sao lưu `pg_dump -Fc -n hoso -n public hoso_dev` trước. Cần worker đang chạy (`scripts/dev-up.sh start`).

Cách chấm (ĐỌC KỸ trước khi dùng số liệu):
- Giấy tờ chưa được gắn loại theo danh mục 427 loại, nên KHÔNG đo được "đúng loại". Chỉ đo "loại gợi ý có giống tên thành phần hồ sơ không" (độ giống từ
  khóa ≥ 0,5) để lọc ra các ca đáng xem; cần người xem lại bảng đối chiếu.
- Trường: nhãn của đáp án ("Họ và tên") khác nhãn danh mục ("Tên chủ xe"), nên chấm theo GIÁ TRỊ, không theo nhãn:
  recall = tỉ lệ giá trị đáp án xuất hiện trong các giá trị AI trích; precision = tỉ lệ giá trị AI trích có trong đáp án.
- "đọc được" = giá trị đáp án có trong chữ OCR (cận trên của mọi mô hình phía sau OCR).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import statistics
import sys
import time
import unicodedata
import uuid
from collections import Counter
from datetime import datetime
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]
TRUTH = ROOT / "data/tuliem-dossiers-full/ground-truth"
OUT = Path("/Volumes/quocDisk/AI/paddleocr/training/bench")
KEY = "tuliem-dossiers-full-v2:"
TERMINAL = ("completed", "failed", "cancelled")


def folded(value) -> str:
    return " ".join(unicodedata.normalize("NFC", str(value)).casefold().split())


def plain(value) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", folded(value)) if unicodedata.category(c) != "Mn").replace("đ", "d")


def tokens(value) -> set[str]:
    return {t for t in plain(value).replace("/", " ").replace(",", " ").split() if len(t) >= 2 and not t.isdigit()}


def similarity(a: str, b: str) -> float:
    ta, tb = tokens(a), tokens(b)
    return len(ta & tb) / len(ta | tb) if ta | tb else 0.0


def connect(database: str):
    return psycopg.connect(f"host=127.0.0.1 port=5432 user=quoc dbname={database}", autocommit=True)


def select(conn, mock: int, pkt: int, packets: int, seed: str) -> list[dict]:
    def pick(prefix: str, count: int) -> list[dict]:
        if count <= 0:
            return []
        # Giấy tờ thành phần: mỗi tên thành phần một bản. PDF gộp: mọi bản cùng một tên nên lấy ngẫu nhiên không lọc trùng.
        distinct = "DISTINCT ON (d.document_form)" if prefix != "full" else ""
        order = "d.document_form, md5(d.id::text || %s)" if prefix != "full" else "md5(d.id::text || %s)"
        rows = conn.execute(f"""
            SELECT {distinct} d.id, d.external_key, d.document_form, f.id, f.page_count
            FROM hoso.documents d JOIN hoso.files f ON f.document_id = d.id AND f.file_role = 'scan' AND f.storage_key IS NOT NULL
            WHERE d.external_key LIKE %s AND NOT EXISTS (SELECT 1 FROM hoso.ocr_jobs j WHERE j.file_id = f.id)
            ORDER BY {order}""", (KEY + prefix + "-%", seed)).fetchall()
        rows.sort(key=lambda r: hashlib.md5((str(r[0]) + seed + "x").encode()).hexdigest())
        return [{"document_id": str(r[0]), "key": r[1], "form": r[2], "file_id": str(r[3]), "pages": r[4] or 1, "kind": prefix} for r in rows[:count]]

    return pick("mock", mock) + pick("pkt", pkt) + pick("full", packets)


def enqueue(conn, items: list[dict], run: str) -> None:
    user = conn.execute("SELECT id FROM hoso.users WHERE username = 'dev_admin'").fetchone()[0]
    for item in items:
        row = conn.execute("""
            INSERT INTO hoso.ocr_jobs(file_id, job_type, priority, requested_by, options)
            VALUES (%s, 'read_classify', 7, %s, jsonb_build_object('classify', true, 'correlation_id', %s::text)) RETURNING id""",
                           (item["file_id"], user, f"eval-{run}")).fetchone()
        item["job_id"] = str(row[0])


def wait(conn, items: list[dict], timeout: int) -> None:
    ids = [i["job_id"] for i in items]
    started = time.monotonic()
    last = 0.0
    while time.monotonic() - started < timeout:
        counts = Counter(r[0] for r in conn.execute("SELECT status FROM hoso.ocr_jobs WHERE id = ANY(%s::uuid[])", (ids,)).fetchall())
        if sum(counts[s] for s in TERMINAL) == len(ids):
            return
        if time.monotonic() - last > 30:
            print(f"  [{time.monotonic() - started:5.0f}s] " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items())), flush=True)
            last = time.monotonic()
        time.sleep(5)
    print("  HẾT GIỜ CHỜ: chấm phần đã xong", flush=True)


def collect(conn, item: dict) -> dict:
    job = conn.execute("""SELECT status, error_message, extract(epoch FROM finished_at - started_at), attempt, preempted_count, model_version
                          FROM hoso.ocr_jobs WHERE id = %s""", (item["job_id"],)).fetchone()
    item.update(status=job[0], error=job[1], seconds=float(job[2]) if job[2] is not None else None, attempt=job[3], preempted=job[4], model_version=job[5])
    pages = conn.execute("SELECT page_no, method, status, elapsed_seconds, text FROM hoso.ocr_pages WHERE job_id = %s ORDER BY page_no", (item["job_id"],)).fetchall()
    item["ocr_text"] = "\n".join(p[4] for p in pages)
    item["ocr_pages"] = Counter(p[1] for p in pages)
    item["ocr_seconds"] = sum(float(p[3] or 0) for p in pages if p[1] == "ocr")
    s = conn.execute("""SELECT s.id, s.work_group_code, s.document_type_code, t.name, s.document_form, s.mixed_documents, s.evidence_verified
                        FROM hoso.ai_suggestions s LEFT JOIN hoso.document_types t ON t.code = s.document_type_code
                        WHERE s.job_id = %s ORDER BY s.id DESC LIMIT 1""", (item["job_id"],)).fetchone()
    item["suggestion"] = None if s is None else {"group": s[1], "type": s[2], "type_name": s[3], "form": s[4], "mixed": s[5], "evidence": s[6]}
    values = []
    if s is not None:
        values = [r[0] for r in conn.execute("SELECT value FROM hoso.ai_field_suggestions WHERE suggestion_id = %s AND value <> ''", (s[0],)).fetchall()]
    item["ai_values"] = values
    truth_file = TRUTH / (item["key"].removeprefix(KEY) + ".json")
    truth = json.loads(truth_file.read_text(encoding="utf-8")) if truth_file.is_file() else None
    item["truth_values"] = [str(f["value"]) for f in (truth or {}).get("fields", []) if f.get("expected_status") == "filled" and str(f.get("value", "")).strip()]
    return item


def score(item: dict) -> dict:
    truth, ai = item["truth_values"], item["ai_values"]
    ocr = folded(item["ocr_text"])
    ocr_plain = plain(item["ocr_text"])
    f_truth = {folded(v) for v in truth}
    p_truth = {plain(v) for v in truth}
    readable = [v for v in truth if folded(v) in ocr]
    return {
        "truth": len(truth), "readable": len(readable), "readable_lenient": sum(1 for v in truth if plain(v) in ocr_plain),
        "found": sum(1 for v in truth if folded(v) in {folded(a) for a in ai}),
        "found_lenient": sum(1 for v in truth if plain(v) in {plain(a) for a in ai}),
        "found_of_readable": sum(1 for v in readable if folded(v) in {folded(a) for a in ai}),
        "ai": len(ai), "ai_right": sum(1 for a in ai if folded(a) in f_truth), "ai_right_lenient": sum(1 for a in ai if plain(a) in p_truth),
    }


def ratio(a: int, b: int) -> str:
    return f"{a}/{b} = {a / b:.0%}" if b else "—"


def report(items: list[dict], wall: float | None) -> dict:
    done = [i for i in items if i.get("status") == "completed"]
    print(f"\n==== {len(items)} giấy tờ: {len(done)} xong, {sum(1 for i in items if i.get('status') == 'failed')} lỗi, "
          f"{sum(1 for i in items if i.get('status') not in TERMINAL)} chưa xong" + (f"; chờ {wall:.0f} giây" if wall else ""))
    for kind, label in (("mock", "giấy tờ tự dựng (mock)"), ("pkt", "biểu mẫu nguồn đã điền (pkt)"), ("full", "PDF gộp nhiều giấy tờ")):
        group = [i for i in done if i["kind"] == kind]
        if not group:
            continue
        pages = sum(i["pages"] for i in group)
        sc = [score(i) for i in group]
        total = lambda k: sum(s[k] for s in sc)
        secs = [i["seconds"] for i in group if i["seconds"] is not None]
        print(f"\n-- {label}: {len(group)} giấy tờ, {pages} trang")
        print(f"   thời gian xử lý trung vị {statistics.median(secs):.0f} giây (p90 {sorted(secs)[max(0, int(len(secs) * .9) - 1)]:.0f}); OCR {sum(i['ocr_seconds'] for i in group):.0f} giây cho {sum(i['ocr_pages'].get('ocr', 0) for i in group)} trang OCR")
        if kind != "full":
            print(f"   giá trị đáp án đọc được trong chữ OCR: {ratio(total('readable'), total('truth'))} (bỏ qua dấu: {ratio(total('readable_lenient'), total('truth'))})")
            print(f"   recall   (đáp án AI trích được):        {ratio(total('found'), total('truth'))} (bỏ qua dấu: {ratio(total('found_lenient'), total('truth'))}); trong số đọc được: {ratio(total('found_of_readable'), total('readable'))}")
            print(f"   precision (giá trị AI trích có trong đáp án): {ratio(total('ai_right'), total('ai'))} (bỏ qua dấu: {ratio(total('ai_right_lenient'), total('ai'))})")
            sim = [similarity(i["suggestion"]["type_name"] or "", i["form"]) for i in group if i["suggestion"]]
            sim_form = [similarity(i["suggestion"]["form"] or "", i["form"]) for i in group if i["suggestion"]]
            print(f"   loại gợi ý giống tên thành phần (≥ 0,5): {ratio(sum(1 for x in sim if x >= .5), len(group))} · hình thức AI đọc giống tên thành phần: {ratio(sum(1 for x in sim_form if x >= .5), len(group))}")
            print(f"   không có gợi ý loại: {ratio(sum(1 for i in group if not i['suggestion'] or not i['suggestion']['type']), len(group))} · báo gói nhiều giấy tờ: {ratio(sum(1 for i in group if i['suggestion'] and i['suggestion']['mixed']), len(group))}")
        else:
            print(f"   báo gói nhiều giấy tờ cần tách: {ratio(sum(1 for i in group if i['suggestion'] and i['suggestion']['mixed']), len(group))} (mọi PDF gộp đều gồm nhiều giấy tờ)")
    failed = [i for i in items if i.get("status") == "failed"]
    for i in failed[:10]:
        print(f"   LỖI {i['key'].removeprefix(KEY)}: {i['error']}")
    print("\n-- Loại AI gợi ý nhiều nhất:", Counter(f"{i['suggestion']['type']} {i['suggestion']['type_name']}" for i in done if i["suggestion"] and i["suggestion"]["type"]).most_common(6))
    print("\n-- Bảng đối chiếu (thành phần hồ sơ → loại AI gợi ý; ✓ nếu giống tên):")
    for i in done:
        if i["kind"] == "full":
            continue
        sug = i["suggestion"] or {}
        sim = similarity(sug.get("type_name") or "", i["form"])
        sc = score(i)
        print(f"  {'✓' if sim >= .5 else '·'} [{i['kind']}] {i['form'][:48]:48} → {str(sug.get('type')):9} {str(sug.get('type_name'))[:44]:44} | trường đúng {sc['found']}/{sc['truth']} | {i['seconds'] or 0:.0f}s")
    return {"done": len(done)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--mock", type=int, default=20, help="số giấy tờ tự dựng (mỗi loại một bản)")
    parser.add_argument("--pkt", type=int, default=10, help="số biểu mẫu nguồn đã điền")
    parser.add_argument("--packets", type=int, default=2, help="số PDF gộp nhiều giấy tờ")
    parser.add_argument("--seed", default=None, help="hạt giống chọn mẫu (mặc định: theo giờ, ghi vào tệp kết quả)")
    parser.add_argument("--timeout", type=int, default=3600, help="giây chờ tối đa")
    parser.add_argument("--db", default="hoso_dev")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--report", type=Path, help="chấm lại một tệp kết quả đã lưu")
    args = parser.parse_args()

    if args.report:
        data = json.loads(args.report.read_text(encoding="utf-8"))
        report(data["items"], data.get("wall_seconds"))
        return 0
    seed = args.seed or datetime.now().strftime("%H%M%S")
    conn = connect(args.db)
    items = select(conn, args.mock, args.pkt, args.packets, seed)
    print(f"Mẫu (seed {seed}): {Counter(i['kind'] for i in items)}, tổng {sum(i['pages'] for i in items)} trang")
    if args.dry_run:
        for i in items:
            print(f"  [{i['kind']}] {i['pages']} trang · {i['form'][:70]}")
        return 0
    run = uuid.uuid4().hex[:8]
    enqueue(conn, items, run)
    print(f"Đã tạo {len(items)} việc ở khay nền (lần chạy {run}); chờ worker…", flush=True)
    started = time.monotonic()
    wait(conn, items, args.timeout)
    wall = time.monotonic() - started
    for item in items:
        collect(conn, item)
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"db-eval-{run}.json"
    path.write_text(json.dumps({"run": run, "seed": seed, "wall_seconds": wall, "items": items}, ensure_ascii=False, default=list, indent=1), encoding="utf-8")
    report(items, wall)
    print(f"\nĐã lưu: {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
