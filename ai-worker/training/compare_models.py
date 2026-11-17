"""So sánh hai kết quả bench_pipeline llm đã chạy xong với cùng dữ liệu và cấu hình.

Ví dụ: python compare_models.py --baseline OLD.json --candidate NEW.json --catalog CATALOG.json --output REPORT.md
Chỉ đọc kết quả có sẵn; không nạp model hoặc ghi CSDL.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from bench_pipeline import folded


def validate_pair(baseline, candidate, categories):
    for data in (baseline, candidate):
        meta = data["metadata"]
        if not meta.get("complete") or len(data["documents"]) != len(meta["document_ids"]):
            raise ValueError("Không so sánh lượt đo chưa hoàn tất")
        if [d["id"] for d in data["documents"]] != meta["document_ids"]:
            raise ValueError("Thứ tự tài liệu không khớp metadata")
    for key in ("input_sha256", "catalog_sha256", "document_ids", "prompt", "shortlist", "restrict_types_to_group", "thinking", "temperature", "versions"):
        if baseline["metadata"][key] != candidate["metadata"][key]:
            raise ValueError(f"Hai lượt đo không cùng {key}")
    digest = hashlib.sha256(json.dumps(categories, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    if baseline["metadata"]["catalog_sha256"] != digest:
        raise ValueError("Danh mục dùng chấm không khớp danh mục đã chạy")
    for a, b in zip(baseline["documents"], candidate["documents"]):
        truth = lambda d: [(f["label"], f["truth"], f["in_ocr"]) for f in d["fields"]]
        if a["expected_type_id"] != b["expected_type_id"] or truth(a) != truth(b):
            raise ValueError(f"Đáp án không khớp: {a['id']}")


def field_counts(data, categories):
    types = {t["id"]: t for c in categories for t in c["documentTypes"]}
    eligible, excluded = [], []
    for doc in data["documents"]:
        for f in doc["fields"]:
            if not f["truth"]:
                continue
            if f["label"] in types[doc["expected_type_id"]]["fields"]:
                eligible.append(f)
            else:
                excluded.append(f"{doc['id']}: {f['label']}")
    correct = lambda f: folded(f["truth"]) == folded(f["pred"])
    readable = [f for f in eligible if f["in_ocr"]]
    return {"n": len(eligible), "correct": sum(map(correct, eligible)),
            "wrong": sum(bool(f["pred"]) and not correct(f) for f in eligible),
            "missing": sum(not f["pred"] for f in eligible),
            "readable": len(readable), "correct_readable": sum(map(correct, readable)), "excluded": excluded}


def ratio(n, d):
    return f"{n}/{d} ({n / d:.1%})" if d else "—"


def render(baseline, candidate, categories):
    validate_pair(baseline, candidate, categories)
    data = (baseline, candidate)
    fields = [field_counts(d, categories) for d in data]
    names = [d["metadata"]["identity"]["name"] for d in data]
    docs = baseline["documents"]
    counts = {k: sum(d["kind"] == k for d in docs) for k in ("filled", "citizen")}
    labelled = sum(bool(d["fields"]) for d in docs)
    truths = sum(bool(f["truth"]) for d in docs for f in d["fields"])
    date = baseline["summary"]["date"].split()[0]
    meta = baseline["metadata"]
    type_count = sum(len(c["documentTypes"]) for c in categories)
    activity = [d["metadata"].get("gpu_activity") for d in data]
    if all(activity):
        clean = all(not a["other_model_processes_detected"] and not a.get("monitoring_errors") for a in activity)
        activity_note = ("Giám sát mỗi giây không phát hiện worker/model khác trong cả hai lượt đo." if clean
                         else "Có tiến trình mô hình khác hoặc lỗi giám sát; thời gian chỉ để tham khảo, không kết luận tăng tốc.")
    else:
        activity_note = "Artifact cũ chưa ghi giám sát tiến trình mô hình khác; cần đối chiếu nhật ký khi đánh giá tốc độ."
    lines = [f"# So sánh {names[1]} với {names[0]}", "", f"Ngày đo: {date}. Mac M4 16 GB, MLX 4-bit, chỉ xử lý văn bản OCR; không đưa ảnh vào Qwen.", "",
             "## Kết quả ghép cặp", "", f"| Chỉ số | {names[0]} | {names[1]} |", "|---|---:|---:|"]
    def row(label, values):
        lines.append(f"| {label} | {values[0]} | {values[1]} |")
    row("Đúng nhóm", [ratio(sum(x["predicted_group"] == x["expected_type_id"].split("-")[0] for x in d["documents"]), len(d["documents"])) for d in data])
    row("Đúng loại", [ratio(sum(x["predicted_type_id"] == x["expected_type_id"] for x in d["documents"]), len(d["documents"])) for d in data])
    row("Loại được shortlist quyết định theo tiêu đề", [ratio(sum(x.get("result", {}).get("type_chosen_by") == "document_title" for x in d["documents"]), len(d["documents"])) for d in data])
    for kind in ("filled", "citizen"):
        row(f"Đúng loại — {kind}", [ratio(sum(x["predicted_type_id"] == x["expected_type_id"] for x in d["documents"] if x["kind"] == kind), sum(x["kind"] == kind for x in d["documents"])) for d in data])
    row("Trường đúng (nhãn có trong schema)", [ratio(f["correct"], f["n"]) for f in fields])
    row("Trường sai giá trị", [ratio(f["wrong"], f["n"]) for f in fields])
    row("Trường bỏ sót", [ratio(f["missing"], f["n"]) for f in fields])
    row("Trường đúng trong số OCR đọc được", [ratio(f["correct_readable"], f["readable"]) for f in fields])
    for label, key in (("Thời gian trung vị (giây/tài liệu)", "seconds_median"), ("Thời gian p90 (giây/tài liệu)", "seconds_p90"), ("Lỗi phân loại/JSON", "errors"), ("Tài liệu có lỗi trích nhóm trường", "documents_with_field_warnings")):
        row(label, [d["summary"]["all"][key] for d in data])
    row("Thời gian nạp (giây)", [d["summary"]["load_seconds"] for d in data])
    row("Bộ nhớ MLX đỉnh (GiB)", [d["summary"]["peak_memory_gb"] for d in data])
    lines += ["", "## Phương pháp và giới hạn", "",
              f"- {len(docs)} tài liệu: {counts['filled']} mẫu điền font và {counts['citizen']} biểu mẫu citizen; {labelled} tài liệu có đáp án trường, tổng cộng {truths} giá trị. Đây là dữ liệu giả lập/biểu mẫu công khai, chưa đánh giá trên giấy tờ thật.",
              f"- Cùng OCR đã lưu, cùng snapshot PostgreSQL {len(categories)} nhóm/{type_count} loại; không cung cấp đáp án cho model. restrict_types_to_group={meta['restrict_types_to_group']}, shortlist={meta['shortlist']}, prompt={meta['prompt']}, temperature={meta['temperature']}, thinking={meta['thinking']}. MLX-LM xử lý văn bản OCR.",
              "- " + activity_note + " Các ứng dụng khác trên máy vẫn chạy; swap có sẵn không có nghĩa là toàn bộ do model.",
              "- Tốc độ chỉ gồm phân loại và trích trường; không gồm OCR, tải model hay thời gian nạp. P90 theo nearest rank. Bộ nhớ MLX đỉnh không phải tổng RAM cả máy.",
              "- Shortlist có thể quyết định loại theo tiêu đề; kết quả là chất lượng toàn pipeline với cấu hình này, không phải năng lực model khi tự chọn trong toàn danh mục.",
              "- Chấm giá trị bằng nhãn và chuỗi chuẩn hóa Unicode/hoa-thường/khoảng trắng, giữ dấu tiếng Việt. Không đủ nhãn để tính tỷ lệ điền nhầm ô trống trên toàn bộ form. Trích dẫn có trong OCR không đảm bảo chọn đúng vai trò/người.",
              "- Loại khỏi mẫu số trường những nhãn đáp án không có trong schema hiện tại: " + "; ".join(fields[0]["excluded"]) + ".", "", "## Chi tiết từng tài liệu", "",
              f"| Tài liệu | Loại đáp án | {names[0]} | {names[1]} | Giây baseline / candidate |", "|---|---|---|---|---:|"]
    for a, b in zip(baseline["documents"], candidate["documents"]):
        lines.append(f"| {a['id']} | {a['expected_type_id']} | {a['predicted_type_id']} | {b['predicted_type_id']} | {a['seconds']} / {b['seconds']} |")
    lines += ["", "## Phiên bản và khả năng chạy lại", ""]
    for d in data:
        m=d["metadata"]
        lines += [f"- `{m['identity']['repo']}@{m['identity']['revision']}`; thời điểm kết thúc `{d['summary']['date']}`.",
                  f"  Bộ nhớ hệ thống trước/sau: `{json.dumps(m['system_before'])}` → `{json.dumps(m['system_after'])}`."]
    m=baseline["metadata"]
    lines += [f"- Thư viện: `{json.dumps(m['versions'])}`.", f"- SHA-256 dữ liệu: `{m['input_sha256']}`.", f"- SHA-256 danh mục: `{m['catalog_sha256']}`."]
    return "\n".join(lines)+"\n"


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ("baseline", "candidate", "catalog", "output"):
        parser.add_argument(f"--{name}", type=Path, required=True)
    args=parser.parse_args()
    args.output.write_text(render(*(json.loads(p.read_text()) for p in (args.baseline,args.candidate,args.catalog))), encoding="utf-8")
    print(args.output)


if __name__ == "__main__":
    main()
