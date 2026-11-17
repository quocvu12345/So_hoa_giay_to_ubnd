"""Đường dẫn và hàm dùng chung cho các bước huấn luyện/đánh giá model trích trường."""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path[:0] = [str(HERE.parent / "src"), str(REPO)]

AI_HOME = Path(os.environ.get("DOCUMENT_AI_HOME", "/Volumes/quocDisk/AI/paddleocr"))
WORK = AI_HOME / "training"          # dữ liệu huấn luyện nằm ngoài repo
DATASET = REPO / "data/tuliem-dossiers-full"
MODELS = {
    "qwen3-4b": AI_HOME / "models/Qwen3-4B-Instruct-2507-4bit",
    "qwen3-4b-ifstruct": AI_HOME / "models/Qwen3-4B-Instruct-2507-ifstruct-4bit",
    "qwen3-4b-bkee": AI_HOME / "models/Qwen3-4B-BKEE-Entity-Extraction-4bit",
    "qwen3.5-4b": AI_HOME / "models/Qwen3.5-4B-4bit",
    "qwen3.5-2b": AI_HOME / "models/Qwen3.5-2B-4bit",   # KHÔNG huấn luyện được trên 16 GB: hết bộ nhớ GPU ở ~1.000 token
    "qwen3-1.7b": AI_HOME / "models/Qwen3-1.7B-4bit",
}


def procedure_of(document_id: str) -> str:
    """mock-hn87-076-02-<hash> → 076. Tách train/eval theo thủ tục để không rò rỉ mẫu giữa hai tập."""
    match = re.match(r"(?:mock|pkt)-hn87-(\d+)-", document_id)
    if not match:
        raise ValueError(document_id)
    return match.group(1)


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def append_jsonl(path: Path, row: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=False) + "\n")
