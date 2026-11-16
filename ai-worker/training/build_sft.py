"""Dựng dữ liệu huấn luyện LoRA (định dạng messages của mlx_lm) từ văn bản OCR + đáp án.
Nhãn là đoạn chữ tìm thấy trong văn bản OCR; trường mà OCR không đọc được thì nhãn là "" (dạy model không bịa)."""
from __future__ import annotations

import json
import random
from collections import Counter

from common import DATASET, WORK, read_jsonl

from document_ai.classify import classification_context, folded
from prompts import SYSTEM_SHORT, locate_in_text, short_user

BATCH = 10


def document_text(row: dict) -> str:
    pages = [{"page": p["page"], "text": p["text"]} for p in row["pages"]]
    return classification_context(pages)[0]


def target_value(value: str, text: str) -> str:
    """Giá trị mô hình cần chép. Ưu tiên khớp nguyên văn (đúng 97% trường); OCR trả bảng HTML nên tìm theo từ chỉ là phương án phụ."""
    if not value:
        return ""
    if folded(value) in folded(text):
        return value
    return locate_in_text(value, text)


def fields_of(document_id: str) -> tuple[list[tuple[str, str]], int]:
    """(label, value) không trùng nhãn; nhãn lặp trong cùng tài liệu bị bỏ vì không biết khớp với giá trị nào."""
    truth = json.loads((DATASET / "ground-truth" / f"{document_id}.json").read_text(encoding="utf-8"))
    counts = Counter(f["label"] for f in truth["fields"])
    kept = [(f["label"], str(f.get("value", "")).strip()) for f in truth["fields"] if counts[f["label"]] == 1]
    return kept, sum(1 for c in counts.values() if c > 1)


def main() -> None:
    rows = [r for r in read_jsonl(WORK / "ocr.jsonl") if r["split"] == "train" and not r["error"] and r["pages"]]
    rng = random.Random(11)
    procedures = sorted({r["procedure"] for r in rows})
    rng.shuffle(procedures)
    valid_procedures = set(procedures[:max(1, len(procedures) // 10)])
    out = {"train": [], "valid": []}
    stats = Counter()
    for row in rows:
        text = document_text(row)
        fields, dropped = fields_of(row["document_id"])
        stats["nhãn lặp bị bỏ"] += dropped
        if not fields:
            continue
        split = "valid" if row["procedure"] in valid_procedures else "train"
        variants = [fields] if split == "valid" else [fields, rng.sample(fields, len(fields))]
        type_name = "Giấy tờ trong hồ sơ"
        for variant in variants:
            for start in range(0, len(variant), BATCH):
                chunk = variant[start:start + BATCH]
                answer = []
                for label, value in chunk:
                    found = target_value(value, text)
                    stats["trường có giá trị"] += bool(value)
                    stats["…tìm thấy trong OCR"] += bool(found)
                    stats["trường trống"] += not value
                    answer.append({"label": label, "value": found})
                out[split].append({"messages": [
                    {"role": "system", "content": SYSTEM_SHORT},
                    {"role": "user", "content": short_user(type_name, [l for l, _ in chunk], text)},
                    {"role": "assistant", "content": json.dumps({"fields": answer}, ensure_ascii=False)}]})
    directory = WORK / "sft"
    directory.mkdir(parents=True, exist_ok=True)
    for name, items in out.items():
        rng.shuffle(items)
        (directory / f"{'valid' if name == 'valid' else 'train'}.jsonl").write_text(
            "".join(json.dumps(i, ensure_ascii=False) + "\n" for i in items), encoding="utf-8")
    (directory / "test.jsonl").write_text((directory / "valid.jsonl").read_text(encoding="utf-8"), encoding="utf-8")
    print("mẫu train:", len(out["train"]), "| valid:", len(out["valid"]), "| tài liệu:", len(rows), dict(stats))
    if stats["trường có giá trị"]:
        print(f"OCR đọc được {stats['…tìm thấy trong OCR'] / stats['trường có giá trị']:.1%} giá trị đáp án (trần của model)")


if __name__ == "__main__":
    main()
